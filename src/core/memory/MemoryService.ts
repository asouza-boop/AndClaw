import { config } from '@/config/env';
import { query } from '@/db/postgres';
import { EmbeddingService } from '@/core/embedding/EmbeddingService';
import { toVectorLiteral } from '@/infra/db/vector';
import { logger } from '@/infra/logger';
import { metrics } from '@/infra/metrics/MetricsService';
import { MemorySaveSchema, MemorySearchSchema } from '@/contracts/memory';
import { rankSemanticMemories } from '@/core/memory/ranking';
import { ParameterStore } from '@/core/optimization/ParameterStore';

export interface SemanticMemoryRecord {
  id?: number;
  type: string;
  content: string;
  source_type?: string | null;
  source_id?: string | null;
  metadata?: Record<string, any> | null;
  memory_type?: string;
  created_at?: string;
  distance?: number;
}

export class MemoryService {
  private readonly embeddings: EmbeddingService;

  constructor(embeddings = new EmbeddingService()) {
    this.embeddings = embeddings;
  }

  public async save(
    content: string,
    embedding: number[],
    metadata: Record<string, any> = {},
  ): Promise<SemanticMemoryRecord | null> {
    const parsed = MemorySaveSchema.parse({ content, embedding, metadata });
    if (!config.db.url) return null;
    const start = Date.now();
    const memoryType = this.detectMemoryType(content, metadata.memoryType);
    const rows = await query<SemanticMemoryRecord>(
      `INSERT INTO memory_items (type, content, source_type, source_id, metadata, embedding, memory_type)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector, $7)
       RETURNING *`,
      [
        String(metadata.type || 'semantic'),
        content,
        metadata.source_type || null,
        metadata.source_id || null,
        JSON.stringify(metadata),
        toVectorLiteral(embedding),
        memoryType
      ]
    );
    logger.info('memory.type.assigned', { memoryType, contentLength: content.length });
    logger.info('memory.save', {
      contentLength: parsed.content.length,
      memoryType,
      metadataType: parsed.metadata.type || 'semantic',
      latencyMs: Date.now() - start,
    });
    return rows[0] || null;
  }

  private detectMemoryType(content: string, override?: string): string {
    if (override && ['operational', 'contextual', 'problem_solution'].includes(override)) {
        return override;
    }
    const text = content.toLowerCase();

    // Heuristics for problem_solution
    const solutionKeywords = ['resolveu', 'consertou', 'fix', 'solucionado', 'resultado final', 'sucesso', 'concluído com êxito'];
    if (solutionKeywords.some(k => text.includes(k))) {
        return 'problem_solution';
    }

    // Heuristics for operational
    const operationalKeywords = ['executou', 'rodou', 'ferramenta', 'skill', 'output', 'trace', 'comando'];
    if (operationalKeywords.some(k => text.includes(k))) {
        return 'operational';
    }

    return 'contextual';
  }

  public async search(embedding: number[], limit = 5): Promise<SemanticMemoryRecord[]> {
    const parsed = MemorySearchSchema.parse({ embedding, limit });
    if (!config.db.url) return [];
    const start = Date.now();
    metrics.increment('memory.search.count');
    const fetchLimit = Math.max(parsed.limit * 3, parsed.limit);
    const rows = await query<SemanticMemoryRecord>(
      `SELECT *, (embedding <-> $1::vector) AS distance
       FROM memory_items
       WHERE embedding IS NOT NULL
       ORDER BY embedding <-> $1::vector ASC, created_at DESC, id DESC
       LIMIT $2`,
      [toVectorLiteral(parsed.embedding), fetchLimit]
    );
    const ranked = rankSemanticMemories(rows, { 
      limit: parsed.limit,
      similarityWeight: ParameterStore.get('memoryWeight'),
      recencyWeight: ParameterStore.get('recencyWeight')
    });
    logger.info('memory.search', {
      requested: parsed.limit,
      scanned: rows.length,
      returned: ranked.length,
      latencyMs: Date.now() - start,
    });
    metrics.observe('memory.search.latency', Date.now() - start);
    return ranked;
  }

  public async searchByText(text: string, limit = 5): Promise<SemanticMemoryRecord[]> {
    const embedding = await this.embeddings.generateEmbedding(text);
    return this.search(embedding, limit);
  }
}
