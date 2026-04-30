import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { exportTasksToGoogle } from '@/integrations/googleCalendar';

const router = Router();

router.post('/tasks', async (req: Request, res: Response) => {
  const { title, description, status = 'open', priority = 'normal', due_date, project_id, meeting_id, agent_id, skill_ids = [] } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO tasks (title, description, status, priority, due_date, project_id, agent_id, skill_ids, meeting_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, description || null, status, priority, due_date || null, project_id || null, agent_id || null, skill_ids || [], meeting_id || null]
  );

  res.status(201).json({ ok: true, item: rows[0], id: rows[0]?.id });
  exportTasksToGoogle().catch(e => console.error('[tasks] gcal sync failed:', e.message));
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
  const { title, description, status, priority, due_date, agent_id, skill_ids } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];
  if (title !== undefined)    { params.push(title);    updates.push(`title = $${params.length}`); }
  if (description !== undefined) { params.push(description || null); updates.push(`description = $${params.length}`); }
  if (status !== undefined)   { params.push(status);   updates.push(`status = $${params.length}`); }
  if (priority !== undefined) { params.push(priority); updates.push(`priority = $${params.length}`); }
  if (due_date !== undefined) { params.push(due_date || null); updates.push(`due_date = $${params.length}`); }
  if (agent_id !== undefined) { params.push(agent_id || null); updates.push(`agent_id = $${params.length}`); }
  if (skill_ids !== undefined) { params.push(skill_ids || []); updates.push(`skill_ids = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
  params.push(id);
  const rows = await query<any>(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  res.json({ ok: true, item: rows[0] });
  exportTasksToGoogle().catch(() => {});
});

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await query('DELETE FROM tasks WHERE id = $1', [id]);
  res.json({ ok: true });
});

export default router;
