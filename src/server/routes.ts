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
import { listRaindropCollections, listRaindrops } from '../integrations/raindrop';
import { AgentController } from '../core/AgentController';
import { hasLLMConfig, offlineFallbackMessage } from './llm';
import { issueToken, verifyLoginPassword } from './auth';
import { config } from '../config/env';
import { setSetting, loadAuthFromDb, loadAppSettings, applyAppSettingsToConfig } from './settings';
import { hashPassword, randomSecret } from './crypto';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const agent = new AgentController();

async function listSkillsFromDisk() {
  const root = config.paths.skills;
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const file = path.join(root, slug, 'SKILL.md');
    let title = slug;
    let description = '';
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      const heading = lines.find(l => l.startsWith('#'));
      if (heading) title = heading.replace(/^#+\s*/, '').trim();
      description = lines.find(l => !l.startsWith('#')) || '';
    } catch {}
    skills.push({ slug, title, description });
  }
  return skills;
}

async function upsertTags(names: string[]) {
  const unique = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (!unique.length) return new Map<string, number>();
  const idMap = new Map<string, number>();
  for (const name of unique) {
    const rows = await query<{ id: number }>(
      `INSERT INTO tags (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name]
    );
    if (rows[0]) idMap.set(name, rows[0].id);
  }
  return idMap;
}

async function setEntityTags(entityType: string, entityId: string, tagNames: string[]) {
  await query(`DELETE FROM entity_tags WHERE entity_type = $1 AND entity_id = $2`, [entityType, entityId]);
  const idMap = await upsertTags(tagNames);
  for (const [name, tagId] of idMap.entries()) {
    await query(
      `INSERT INTO entity_tags (tag_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [tagId, entityType, entityId]
    );
  }
}

router.get('/health', async (_req: Request, res: Response) => {
  try {
    await ensureSchema();
    await query('SELECT 1 as ok');
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await query('SELECT 1 as ok');
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  const db = { ok: false };
  try {
    await query('SELECT 1 as ok');
    db.ok = true;
  } catch {}

  const settings = await loadAppSettings();
  const googleAccounts = await listConnectedAccounts().catch(() => []);
  const gitvault = Boolean(config.gitvault.repo && config.gitvault.token);
  const push = Boolean(config.push.vapidPublicKey && config.push.vapidPrivateKey);
  const raindrop = Boolean(config.raindrop.token);
  const llm = {
    gemini: Boolean(config.llm.geminiKey),
    openrouter: Boolean(config.llm.openrouterKey),
    deepseek: Boolean(config.llm.deepseekKey),
  };

  res.json({
    ok: true,
    db,
    google: { connectedAccounts: googleAccounts },
    gitvault,
    push,
    raindrop,
    llm,
    deploy: { last: settings.LAST_DEPLOY_AT || null },
  });
});

router.get('/settings', async (_req: Request, res: Response) => {
  const settings = await loadAppSettings();
  res.json({ ok: true, settings });
});

router.get('/skills', async (_req: Request, res: Response) => {
  const skills = await listSkillsFromDisk();
  res.json({ ok: true, items: skills });
});

router.get('/tags', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM tags ORDER BY name ASC`);
  res.json({ ok: true, items: rows });
});

router.post('/tags', async (req: Request, res: Response) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query(
    `INSERT INTO tags (name, color)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
     RETURNING *`,
    [name, color || null]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/agents', async (_req: Request, res: Response) => {
  const agents = await query<any>(`SELECT * FROM agents ORDER BY created_at DESC`);
  const skills = await query<any>(`SELECT agent_id, skill_slug FROM agent_skills`);
  const tags = await query<any>(
    `SELECT et.entity_id, t.name, t.color
     FROM entity_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entity_type = 'agent'`
  );

  const skillMap = new Map<string, string[]>();
  skills.forEach((row: any) => {
    const key = String(row.agent_id);
    const list = skillMap.get(key) || [];
    list.push(row.skill_slug);
    skillMap.set(key, list);
  });

  const tagMap = new Map<string, any[]>();
  tags.forEach((row: any) => {
    const key = String(row.entity_id);
    const list = tagMap.get(key) || [];
    list.push({ name: row.name, color: row.color });
    tagMap.set(key, list);
  });

  const items = agents.map((agent: any) => ({
    ...agent,
    skills: skillMap.get(String(agent.id)) || [],
    tags: tagMap.get(String(agent.id)) || [],
  }));
  res.json({ ok: true, items });
});

router.post('/agents', async (req: Request, res: Response) => {
  const { name, level, status, areas = [], description, skills = [], tags = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query<any>(
    `INSERT INTO agents (name, level, status, areas, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, level || 'Estrategico', status || 'ativo', areas, description || null]
  );
  const agent = rows[0];

  for (const skill of skills) {
    await query(
      `INSERT INTO agent_skills (agent_id, skill_slug)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [agent.id, String(skill)]
    );
  }

  await setEntityTags('agent', String(agent.id), tags);

  res.json({ ok: true, item: agent });
});

router.post('/agents/:id/tags', async (req: Request, res: Response) => {
  const id = req.params.id;
  const { tags = [] } = req.body || {};
  await setEntityTags('agent', String(id), tags);
  res.json({ ok: true });
});

router.post('/agents/:id/skills', async (req: Request, res: Response) => {
  const id = req.params.id;
  const { skills = [] } = req.body || {};
  await query(`DELETE FROM agent_skills WHERE agent_id = $1`, [id]);
  for (const skill of skills) {
    await query(
      `INSERT INTO agent_skills (agent_id, skill_slug)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, String(skill)]
    );
  }
  res.json({ ok: true });
});

router.get('/links', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM page_links ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
});

router.post('/links', async (req: Request, res: Response) => {
  const { from_type, from_id, to_type, to_id, label } = req.body || {};
  if (!from_type || !from_id || !to_type || !to_id) {
    return res.status(400).json({ error: 'from_type, from_id, to_type, to_id are required' });
  }
  const rows = await query(
    `INSERT INTO page_links (from_type, from_id, to_type, to_id, label)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [from_type, String(from_id), to_type, String(to_id), label || null]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/favorites', async (_req: Request, res: Response) => {
  const favorites = await query<any>(`SELECT * FROM favorites ORDER BY created_at DESC LIMIT 200`);
  const tags = await query<any>(
    `SELECT et.entity_id, t.name, t.color
     FROM entity_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entity_type = 'favorite'`
  );

  const tagMap = new Map<string, any[]>();
  tags.forEach((row: any) => {
    const key = String(row.entity_id);
    const list = tagMap.get(key) || [];
    list.push({ name: row.name, color: row.color });
    tagMap.set(key, list);
  });

  const items = favorites.map((fav: any) => ({
    ...fav,
    tags: tagMap.get(String(fav.id)) || []
  }));
  res.json({ ok: true, items });
});

router.post('/favorites', async (req: Request, res: Response) => {
  const { title, url, tags = [] } = req.body || {};
  if (!title || !url) return res.status(400).json({ error: 'title and url are required' });
  const rows = await query<any>(
    `INSERT INTO favorites (title, url, source)
     VALUES ($1, $2, 'manual') RETURNING *`,
    [title, url]
  );
  const fav = rows[0];
  await setEntityTags('favorite', String(fav.id), tags);
  res.json({ ok: true, item: fav });
});

router.get('/raindrop/collections', async (_req: Request, res: Response) => {
  if (!config.raindrop.token) return res.json({ ok: true, items: [] });
  const items = await listRaindropCollections();
  res.json({ ok: true, items });
});

router.get('/raindrop/items', async (req: Request, res: Response) => {
  if (!config.raindrop.token) return res.json({ ok: true, items: [] });
  const collectionId = (req.query.collectionId as string) || config.raindrop.collectionId;
  const perpage = parseInt((req.query.perpage as string) || '30', 10);
  const page = parseInt((req.query.page as string) || '0', 10);
  const items = await listRaindrops(collectionId, perpage, page);
  res.json({ ok: true, items });
});

router.post('/raindrop/sync', async (req: Request, res: Response) => {
  if (!config.raindrop.token) return res.status(400).json({ error: 'raindrop token not configured' });
  const { collectionId, perpage = 50, page = 0 } = req.body || {};
  const items = await listRaindrops(collectionId || config.raindrop.collectionId, perpage, page);
  let upserted = 0;
  for (const item of items) {
    const externalId = String(item._id || item.id || '');
    const title = item.title || item.link || 'Sem titulo';
    const link = item.link || item.url;
    if (!externalId || !link) continue;
    const rows = await query<any>(
      `INSERT INTO favorites (title, url, source, external_id)
       VALUES ($1, $2, 'raindrop', $3)
       ON CONFLICT (source, external_id)
       DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url
       RETURNING id`,
      [title, link, externalId]
    );
    if (rows[0]) upserted += 1;
  }
  res.json({ ok: true, count: upserted });
});

router.post('/settings', async (req: Request, res: Response) => {
  const allowed = [
    'GEMINI_API_KEY',
    'OPENROUTER_API_KEY',
    'DEEPSEEK_API_KEY',
    'DEFAULT_LLM_PROVIDER',
    'GITVAULT_REPO',
    'GITHUB_TOKEN',
    'GITVAULT_BASE_PATH',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REDIRECT_URI',
    'GOOGLE_EXPORT_CALENDAR_ID',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_CONTACT_EMAIL',
    'RENDER_DEPLOY_HOOK_URL',
    'RAINDROP_TOKEN',
    'RAINDROP_COLLECTION_ID'
  ];

  const payload = req.body || {};
  for (const key of Object.keys(payload)) {
    if (!allowed.includes(key)) continue;
    const value = String(payload[key] ?? '');
    await setSetting(key, value);
  }

  const settings = await loadAppSettings();
  applyAppSettingsToConfig(settings);

  res.json({ ok: true });
});

router.post('/deploy', async (_req: Request, res: Response) => {
  const settings = await loadAppSettings();
  const hook = settings.RENDER_DEPLOY_HOOK_URL;
  if (!hook) return res.status(400).json({ error: 'deploy hook not configured' });

  const resp = await fetch(hook, { method: 'POST' });
  if (!resp.ok) return res.status(500).json({ error: 'deploy failed' });

  await setSetting('LAST_DEPLOY_AT', new Date().toISOString());
  res.json({ ok: true });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const { password } = req.body || {};
  await loadAuthFromDb();
  if (!config.auth.password || !config.auth.tokenSecret) {
    return res.status(500).json({ error: 'auth not configured' });
  }
  if (!password || !verifyLoginPassword(password)) {
    return res.status(401).json({ error: 'invalid password' });
  }
  const token = issueToken('andclaw-user');
  res.json({ token });
});

router.post('/auth/bootstrap', async (req: Request, res: Response) => {
  const { password, tokenSecret } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  await loadAuthFromDb();
  if (config.auth.password || config.auth.tokenSecret) {
    return res.status(409).json({ error: 'already_configured' });
  }

  const passwordHash = hashPassword(password);
  const secret = tokenSecret || randomSecret(48);

  await setSetting('auth_password_hash', passwordHash);
  await setSetting('auth_token_secret', secret);

  config.auth.password = passwordHash;
  config.auth.tokenSecret = secret;

  const token = issueToken('andclaw-user');
  res.json({ token, tokenSecret: secret });
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
  if (!hasLLMConfig()) {
    return res.json({ ok: true, reply: offlineFallbackMessage() });
  }
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

router.post('/meetings/analyze', async (req: Request, res: Response) => {
  const { meetingId } = req.body || {};
  if (!meetingId) return res.status(400).json({ error: 'meetingId is required' });

  const rows = await query<any>('SELECT * FROM meetings WHERE id = $1', [meetingId]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'meeting not found' });

  if (!hasLLMConfig()) {
    return res.json({ ok: true, insight: offlineFallbackMessage(), offline: true });
  }

  const prompt = `Analise a transcricao a seguir e extraia:\n- Principais decisoes\n- Proximas acoes\n- Riscos e pendencias\n- Insights estrategicos\n\nTranscricao:\n${meeting.transcript_text || ''}`;

  const reply = await agent.processInput('pwa-user', prompt);
  await query(
    `INSERT INTO memory_items (type, content, source_type, source_id)
     VALUES ($1, $2, $3, $4)`,
    ['meeting_insight', reply, 'meeting', String(meetingId)]
  );

  res.json({ ok: true, insight: reply });
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
