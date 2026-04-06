import { config } from '../../config/env';
import { query } from '../../db/postgres';
import { EmbeddingService } from '../embedding/EmbeddingService';
import { toVectorLiteral } from '../../infra/db/vector';

export interface SemanticMemoryRecord {
  id?: number;
  type: string;
  content: string;
  source_type?: string | null;
  source_id?: string | null;
  metadata?: Record<string, any> | null;
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
    if (!config.db.url) return null;
    const rows = await query<SemanticMemoryRecord>(
      `INSERT INTO memory_items (type, content, source_type, source_id, metadata, embedding)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector)
       RETURNING *`,
      [
        String(metadata.type || 'semantic'),
        content,
        metadata.source_type || null,
        metadata.source_id || null,
        JSON.stringify(metadata),
        toVectorLiteral(embedding),
      ]
    );
    return rows[0] || null;
  }

  public async search(embedding: number[], limit = 5): Promise<SemanticMemoryRecord[]> {
    if (!config.db.url) return [];
    const rows = await query<SemanticMemoryRecord>(
      `SELECT *, (embedding <-> $1::vector) AS distance
       FROM memory_items
       WHERE embedding IS NOT NULL
       ORDER BY embedding <-> $1::vector
       LIMIT $2`,
      [toVectorLiteral(embedding), limit]
    );
    return rows;
  }

  public async searchByText(text: string, limit = 5): Promise<SemanticMemoryRecord[]> {
    const embedding = await this.embeddings.generateEmbedding(text);
    return this.search(embedding, limit);
  }
}
