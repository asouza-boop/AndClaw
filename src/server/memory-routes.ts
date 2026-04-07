import { Router, Request, Response, NextFunction } from 'express';
import { query as defaultQuery } from '@/db/postgres';
import { MemoryUpsertRequestSchema } from '@/contracts/api';
import { z } from 'zod';

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
      const rows = await deps.query(
        `INSERT INTO memory_items (type, content, source_type, source_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [type, content, source_type || null, source_id || null]
      );
      return res.json({ ok: true, item: rows[0] });
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
      const body = MemoryUpsertRequestSchema.extend({
        title: z.string().optional(),
      }).passthrough().parse(req.body || {});
      const actualContent = body.content || (body as any).title;
      const rows = await deps.query(
        `INSERT INTO memory_items (type, content, source_type, source_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [body.type, actualContent, body.source_type || null, body.source_id || null]
      );
      return res.json({ ok: true, item: rows[0] });
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
