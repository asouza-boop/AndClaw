import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { TaskService } from '@/core/agent/TaskService';

const router = Router();

router.post('/tasks', async (req: Request, res: Response) => {
  const task = await TaskService.create(req.body);
  res.status(201).json({ ok: true, item: task, id: task?.id });
});

router.get('/tasks', async (req: Request, res: Response) => {
  const { status, priority, project_id } = req.query as { status?: string; priority?: string; project_id?: string };
  let sql = 'SELECT * FROM tasks';
  const params: any[] = [];
  const conditions: string[] = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (priority) { params.push(priority); conditions.push(`priority = $${params.length}`); }
  if (project_id) { params.push(project_id); conditions.push(`project_id = $${params.length}`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';
  const rows = await query(sql, params);
  res.json({ ok: true, items: rows });
});

router.patch('/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const task = await TaskService.update(String(id), req.body);
  if (!task) return res.status(400).json({ error: 'nothing to update or task not found' });
  res.json({ ok: true, item: task });
});

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await TaskService.delete(String(id));
  res.json({ ok: true });
});

export default router;
