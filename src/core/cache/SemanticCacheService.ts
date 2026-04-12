import { config } from '@/config/env';
import { query as defaultQuery } from '@/db/postgres';
import { toVectorLiteral } from '@/infra/db/vector';
import { logger } from '@/infra/logger';
import { metrics } from '@/infra/metrics/MetricsService';
import { ParameterStore } from '@/core/optimization/ParameterStore';
import { z } from 'zod';

const SemanticCacheSaveSchema = z.object({
  input: z.string().min(1),
  embedding: z.array(z.number()).min(1),
  output: z.string().min(1),
});

const SemanticCacheSearchSchema = z.object({
  embedding: z.array(z.number()).min(1),
  threshold: z.number().min(0).max(1).default(0.1),
});

export type SemanticCacheRecord = {
  id?: number;
  input: string;
  output: string;
  embedding?: number[] | string;
  distance?: number;
  created_at?: string;
};

export type SemanticCacheDeps = {
  query: typeof defaultQuery;
  similarityThreshold: number;
};

export type SemanticCacheContext = {
  requestId?: string;
  threshold?: number;
};

export class SemanticCacheService {
  private readonly query: typeof defaultQuery;
  private readonly similarityThreshold: number;

  constructor(deps: Partial<SemanticCacheDeps> = {}) {
    this.query = deps.query || defaultQuery;
    this.similarityThreshold = deps.similarityThreshold ?? 0.1;
  }

  public async get(embedding: number[], context: SemanticCacheContext = {}): Promise<SemanticCacheRecord | null> {
    const threshold = context.threshold ?? ParameterStore.get('cacheThreshold');
    const parsed = SemanticCacheSearchSchema.parse({ embedding, threshold });
    if (!config.db.url) return null;

    const startedAt = Date.now();
    const rows = await this.query<SemanticCacheRecord & { distance?: number }>(
      `SELECT id, input, output, embedding, created_at, (embedding <-> $1::vector) AS distance
       FROM cache
       WHERE embedding IS NOT NULL
       ORDER BY embedding <-> $1::vector ASC, created_at DESC, id DESC
       LIMIT 1`,
      [toVectorLiteral(parsed.embedding)]
    );

    const row = rows[0];
    if (!row) {
      metrics.increment('cache.miss');
      logger.info('cache.miss', {
        reason: 'empty',
        threshold: parsed.threshold,
        latencyMs: Date.now() - startedAt,
        requestId: context.requestId,
      });
      return null;
    }

    const distance = Number(row.distance ?? Number.POSITIVE_INFINITY);
    const similarity = Number.isFinite(distance) ? Math.max(0, 1 - distance) : 0;
    if (distance > parsed.threshold) {
      metrics.increment('cache.miss');
      logger.info('cache.miss', {
        reason: 'threshold',
        distance,
        similarity,
        threshold: parsed.threshold,
        latencyMs: Date.now() - startedAt,
        requestId: context.requestId,
      });
      return null;
    }

    metrics.increment('cache.hit');
    logger.info('cache.hit', {
      distance,
      similarity,
      threshold: parsed.threshold,
      latencyMs: Date.now() - startedAt,
      requestId: context.requestId,
    });

    return row;
  }

  public async set(input: string, embedding: number[], output: string, context: SemanticCacheContext = {}): Promise<SemanticCacheRecord | null> {
    const parsed = SemanticCacheSaveSchema.parse({ input, embedding, output });
    if (!config.db.url) return null;

    const startedAt = Date.now();
    const rows = await this.query<SemanticCacheRecord>(
      `INSERT INTO cache (input, embedding, output)
       VALUES ($1, $2::vector, $3)
       RETURNING id, input, output, created_at`,
      [parsed.input, toVectorLiteral(parsed.embedding), parsed.output]
    );

    logger.info('cache.save', {
      inputLength: parsed.input.length,
      outputLength: parsed.output.length,
      latencyMs: Date.now() - startedAt,
      requestId: context.requestId,
    });
    metrics.increment('cache.save');

    return rows[0] || null;
  }
}
