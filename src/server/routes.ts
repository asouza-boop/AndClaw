import { Router, Request, Response } from 'express';
import { query } from '../db/postgres';
import { ensureSchema } from '../db/schema';
import {
  syncGoogleCalendars,
  exportTasksToGoogle,
  importGoogleEvents,
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
  listConnectedAccounts,
} from '../integrations/googleCalendar';
import { exportDailyGitVault } from '../integrations/gitvault';
import { registerPushSubscription, sendPushTest, getVapidPublicKey } from '../integrations/push';
import { AgentController } from '../core/AgentController';
import { issueToken } from './auth';
import { config } from '../config/env';

const router = Router();
const agent = new AgentController();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    await query('SELECT 1 as ok');
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const { password } = req.body || {};
  if (!config.auth.password || !config.auth.tokenSecret) {
    return res.status(500).json({ error: 'auth not configured' });
  }
  if (!password || password !== config.auth.password) {
    return res.status(401).json({ error: 'invalid password' });
  }
  const token = issueToken('andclaw-user');
  res.json({ token });
});

router.get('/auth/me', async (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post('/messages', async (req: Request, res: Response) => {
  const { content, conversationId = 'default', client_message_id, sender, role } = req.body || {};
  const resolvedRole = role || sender || 'user';
  if (!content) return res.status(400).json({ error: 'content is required' });

  await ensureSchema();
  await query(`INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [conversationId]);

  const rows = await query(
    `INSERT INTO messages (conversation_id, role, content, client_message_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_message_id) DO NOTHING
     RETURNING *`,
    [conversationId, resolvedRole, content, client_message_id || null]
  );
  res.json({ ok: true, message: rows[0] || null });
});

router.get('/messages', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const rows = await query(
    `SELECT * FROM messages ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ ok: true, items: rows });
});

router.get('/messages/by-conversation/:id', async (req: Request, res: Response) => {
  const conversationId = req.params.id;
  const limit = Math.min(parseInt((req.query.limit as string) || '200', 10), 500);
  const rows = await query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [conversationId, limit]
  );
  res.json({ ok: true, items: rows });
});

router.post('/agent', async (req: Request, res: Response) => {
  const { input, userId = 'pwa-user', options = {} } = req.body || {};
  if (!input) return res.status(400).json({ error: 'input is required' });
  const reply = await agent.processInput(userId, input, options);
  res.json({ ok: true, reply });
});

router.post('/captures', async (req: Request, res: Response) => {
  const { content, source = 'pwa' } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });
  const rows = await query(
    `INSERT INTO captures (content, source) VALUES ($1, $2) RETURNING *`,
    [content, source]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/captures', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM captures ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
});

router.post('/tasks', async (req: Request, res: Response) => {
  const { title, status = 'open', priority = 'normal', due_date, project_id, meeting_id } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO tasks (title, status, priority, due_date, project_id, meeting_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, status, priority, due_date || null, project_id || null, meeting_id || null]
  );

  await exportTasksToGoogle();

  res.json({ ok: true, item: rows[0] });
});

router.get('/tasks', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
});

router.post('/meetings', async (req: Request, res: Response) => {
  const { title, meeting_date, transcript_text } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO meetings (title, meeting_date, transcript_text)
     VALUES ($1, $2, $3) RETURNING *`,
    [title, meeting_date || null, transcript_text || null]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/meetings', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM meetings ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
});

router.post('/memory', async (req: Request, res: Response) => {
  const { type, content, source_type, source_id } = req.body || {};
  if (!type || !content) return res.status(400).json({ error: 'type and content are required' });
  const rows = await query(
    `INSERT INTO memory_items (type, content, source_type, source_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [type, content, source_type || null, source_id || null]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/memory', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM memory_items ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
});

router.post('/projects', async (req: Request, res: Response) => {
  const { name, status = 'active', summary } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query(
    `INSERT INTO projects (name, status, summary) VALUES ($1, $2, $3) RETURNING *`,
    [name, status, summary || null]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/projects', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM projects ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
});

router.get('/calendar/events', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT * FROM calendar_events ORDER BY start_time DESC LIMIT 200`
  );
  res.json({ ok: true, items: rows });
});

router.get('/calendar/combined', async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const to = (req.query.to as string) || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const events = await query(
    `SELECT 'event' as type, summary as title, start_time as start, end_time as end
     FROM calendar_events
     WHERE start_time BETWEEN $1 AND $2
     ORDER BY start_time ASC`,
    [from, to]
  );

  const tasks = await query(
    `SELECT 'task' as type, title, due_date as start, due_date as end
     FROM tasks
     WHERE due_date BETWEEN $1 AND $2
     ORDER BY due_date ASC`,
    [from, to]
  );

  res.json({ ok: true, items: [...events, ...tasks] });
});

router.post('/calendar/sync', async (_req: Request, res: Response) => {
  await syncGoogleCalendars();
  res.json({ ok: true });
});

router.get('/google/auth/url', async (_req: Request, res: Response) => {
  const url = await getGoogleAuthUrl();
  res.json({ url });
});

router.get('/google/accounts', async (_req: Request, res: Response) => {
  const accounts = await listConnectedAccounts();
  res.json({ ok: true, accounts });
});

router.get('/google/oauth/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  if (!code) return res.status(400).send('Missing code.');
  await handleGoogleOAuthCallback(code);
  res.redirect('/?google=connected');
});

router.post('/gitvault/export', async (_req: Request, res: Response) => {
  await exportDailyGitVault();
  res.json({ ok: true });
});

router.get('/push/vapid', (_req: Request, res: Response) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/push/subscribe', async (req: Request, res: Response) => {
  const { subscription } = req.body || {};
  if (!subscription) return res.status(400).json({ error: 'subscription is required' });
  await registerPushSubscription(subscription);
  res.json({ ok: true });
});

router.post('/push/test', async (_req: Request, res: Response) => {
  await sendPushTest();
  res.json({ ok: true });
});

router.post('/jobs/import-google', async (_req: Request, res: Response) => {
  await importGoogleEvents();
  res.json({ ok: true });
});

export default router;
