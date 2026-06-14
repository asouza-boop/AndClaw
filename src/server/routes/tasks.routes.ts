import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { TaskService } from '@/core/agent/TaskService';

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

router.post('/tasks', asyncHandler(async (req: Request, res: Response) => {
  const task = await TaskService.create(req.body);
  res.status(201).json({ ok: true, item: task, id: task?.id });
}));

router.get('/tasks', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const cursor = req.query.cursor as string | undefined;
  const status = req.query.status as string | undefined;
  const project_id = req.query.project_id as string | undefined;

  const params: any[] = [];
  const conditions: string[] = [];

  if (cursor) {
    params.push(cursor);
    conditions.push(`created_at < $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (project_id) {
    params.push(project_id);
    conditions.push(`project_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1);
  const rows = await query<any>(
    `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  res.json({ ok: true, items, nextCursor, hasMore });
}));

router.patch('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const task = await TaskService.update(String(id), req.body);
  if (!task) return res.status(400).json({ error: 'nothing to update or task not found' });
  res.json({ ok: true, item: task });
}));

router.delete('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await TaskService.delete(String(id));
  if (!deleted) return res.status(404).json({ error: 'task not found' });
  res.json({ ok: true });
}));

export default router;
