import { Router, Request, Response, NextFunction } from 'express';
import { query as defaultQuery } from '@/db/postgres';
import { MemoryUpsertRequestSchema } from '@/contracts/api';
import { z } from 'zod';
import { EmbeddingService } from '@/core/memory/EmbeddingService';
import { toVectorLiteral } from '@/infra/db/vector';
import { logger } from '@/infra/logger';

export type MemoryRouteDeps = {
  query: typeof defaultQuery;
};

const defaultDeps: MemoryRouteDeps = {
  query: defaultQuery,
};

export function createMemoryRoutes(overrides: Partial<MemoryRouteDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const router = Router();

  router.post('/memory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, content, source_type, source_id } = MemoryUpsertRequestSchema.parse(req.body || {});
      const embeddingService = new EmbeddingService();
      let embedding: number[] | null = null;
      try {
        embedding = await embeddingService.generateEmbedding(content);
      } catch (embErr: any) {
        logger.warn('memory.route.embedding_skipped', { reason: embErr.message });
      }
      
      const rows = await deps.query(
        `INSERT INTO memory_items (type, content, source_type, source_id, embedding)
         VALUES ($1, $2, $3, $4, $5::vector) RETURNING *`,
        [type, content, source_type || null, source_id || null,
         embedding ? toVectorLiteral(embedding) : null]
      );
      return res.status(201).json({ ok: true, id: rows[0]?.id, item: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/memory', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await deps.query(`SELECT * FROM memory_items ORDER BY created_at DESC LIMIT 200`);
      return res.json({ ok: true, items: rows });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/knowledge', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await deps.query(`SELECT * FROM memory_items ORDER BY created_at DESC LIMIT 200`);
      return res.json({ ok: true, items: rows });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/knowledge', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = z.object({
        type: z.string().min(1),
        content: z.string().optional(),
        title: z.string().optional(),
        source_type: z.string().optional(),
        source_id: z.string().optional(),
      }).passthrough().refine((value) => Boolean(value.content || value.title), {
        message: 'content required',
        path: ['content'],
      }).parse(req.body || {});
      const actualContent = body.content || (body as any).title;
      const embeddingService = new EmbeddingService();
      let embedding: number[] | null = null;
      try {
        embedding = await embeddingService.generateEmbedding(actualContent);
      } catch (embErr: any) {
        logger.warn('memory.route.embedding_skipped', { reason: embErr.message });
      }

      const rows = await deps.query(
        `INSERT INTO memory_items (type, content, source_type, source_id, embedding)
         VALUES ($1, $2, $3, $4, $5::vector) RETURNING *`,
        [body.type, actualContent, body.source_type || null, body.source_id || null,
         embedding ? toVectorLiteral(embedding) : null]
      );
      return res.status(201).json({ ok: true, id: rows[0]?.id, item: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/knowledge/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, type, title } = req.body || {};
      const actualContent = content || title;
      const updates: string[] = [];
      const params: any[] = [];
      if (actualContent !== undefined) { params.push(actualContent); updates.push(`content = $${params.length}`); }
      if (type !== undefined) { params.push(type); updates.push(`type = $${params.length}`); }
      if (!updates.length) return res.status(400).json({ error: 'nothing to update' });

      if (actualContent) {
        try {
          const embeddingService = new EmbeddingService();
          const newEmbedding = await embeddingService.generateEmbedding(actualContent);
          updates.push(`embedding = $${params.length + 1}::vector`);
          params.push(toVectorLiteral(newEmbedding));
        } catch (embErr: any) {
          logger.warn('memory.route.patch_embedding_skipped', { id, reason: (embErr as any).message });
        }
      }

      params.push(id);
      const rows = await deps.query(`UPDATE memory_items SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
      return res.json({ ok: true, item: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/knowledge/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await deps.query(`DELETE FROM memory_items WHERE id = $1`, [id]);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default createMemoryRoutes();
