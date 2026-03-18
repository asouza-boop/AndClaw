import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
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

async function getProfileValues(userId: string, prefix: string) {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM user_profile WHERE key LIKE $1`,
    [`${prefix}:${userId}:%`]
  );
  return rows.reduce<Record<string, string>>((acc, row) => {
    const parts = row.key.split(':');
    const field = parts[2];
    if (field) acc[field] = row.value;
    return acc;
  }, {});
}

async function setProfileValues(userId: string, prefix: string, values: Record<string, string>) {
  const entries = Object.entries(values);
  for (const [field, value] of entries) {
    const key = `${prefix}:${userId}:${field}`;
    await query(
      `INSERT INTO user_profile (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
  }
}

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento.' },
});

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
    let allowedTools: string[] = [];
    let content = '';
    try {
      content = await fs.readFile(file, 'utf-8');
      // Parse YAML frontmatter
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const fm = fmMatch[1];
        const nameMatch = fm.match(/^name:\s*(.+)$/m);
        const descMatch = fm.match(/^description:\s*(.+)$/m);
        const toolsMatch = fm.match(/^allowed-tools:\s*(.+)$/m);
        if (nameMatch) title = nameMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
        if (toolsMatch) allowedTools = toolsMatch[1].split(',').map(t => t.trim());
      }
      if (!description) {
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
        const heading = lines.find(l => l.startsWith('#'));
        if (heading) title = heading.replace(/^#+\s*/, '').trim();
        description = lines.find(l => !l.startsWith('#') && l.length > 20) || '';
      }
    } catch {}
    // Count sections in SKILL.md
    const sectionCount = (content.match(/^##\s/gm) || []).length;
    skills.push({ slug, title, name: slug, description, allowedTools, sectionCount, hasContent: content.length > 100 });
  }
  return skills;
}

// Create new skill on disk
async function createSkillOnDisk(slug: string, title: string, description: string, content: string, allowedTools: string[]) {
  const root = config.paths.skills;
  const skillDir = path.join(root, slug);
  await fs.mkdir(skillDir, { recursive: true });
  const toolsLine = allowedTools.length ? `allowed-tools: ${allowedTools.join(', ')}` : '';
  const md = `---
name: ${slug}
description: ${description}
${toolsLine}
---

# ${title}

${content}
`;
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), md, 'utf-8');
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
  const googleConfigured = Boolean(
    config.google.oauthClientId &&
    config.google.oauthClientSecret &&
    config.google.oauthRedirectUri
  );
  const pushCountRow = await query<{ count: string }>('SELECT COUNT(*)::text as count FROM push_subscriptions');
  const pushSubscriptions = parseInt(pushCountRow[0]?.count || '0', 10);
  const llmConfigured = Boolean(config.llm.geminiKey || config.llm.openrouterKey || config.llm.deepseekKey);
  const llm = {
    gemini: Boolean(config.llm.geminiKey),
    openrouter: Boolean(config.llm.openrouterKey),
    deepseek: Boolean(config.llm.deepseekKey),
  };

  res.json({
    ok: true,
    db,
    google: { configured: googleConfigured, connectedAccounts: googleAccounts },
    gitvault,
    push,
    raindrop,
    llm,
    llmConfigured,
    pushSubscriptions,
    deploy: { last: settings.LAST_DEPLOY_AT || null },
  });
});

router.get('/settings', async (_req: Request, res: Response) => {
  const settings = await loadAppSettings();
  const safe: Record<string, any> = {
    DEFAULT_LLM_PROVIDER: settings.DEFAULT_LLM_PROVIDER || '',
    GITVAULT_BASE_PATH: settings.GITVAULT_BASE_PATH || '',
    GOOGLE_EXPORT_CALENDAR_ID: settings.GOOGLE_EXPORT_CALENDAR_ID || 'primary',
    RAINDROP_COLLECTION_ID: settings.RAINDROP_COLLECTION_ID || '0',
    RENDER_DEPLOY_HOOK_URL: settings.RENDER_DEPLOY_HOOK_URL ? 'configured' : '',
    GEMINI_API_KEY: settings.GEMINI_API_KEY ? 'configured' : '',
    OPENROUTER_API_KEY: settings.OPENROUTER_API_KEY ? 'configured' : '',
    DEEPSEEK_API_KEY: settings.DEEPSEEK_API_KEY ? 'configured' : '',
    GITHUB_TOKEN: settings.GITHUB_TOKEN ? 'configured' : '',
    GOOGLE_OAUTH_CLIENT_ID: settings.GOOGLE_OAUTH_CLIENT_ID ? 'configured' : '',
    GOOGLE_OAUTH_CLIENT_SECRET: settings.GOOGLE_OAUTH_CLIENT_SECRET ? 'configured' : '',
    GOOGLE_OAUTH_REDIRECT_URI: settings.GOOGLE_OAUTH_REDIRECT_URI ? 'configured' : '',
    VAPID_PUBLIC_KEY: settings.VAPID_PUBLIC_KEY ? 'configured' : '',
    VAPID_PRIVATE_KEY: settings.VAPID_PRIVATE_KEY ? 'configured' : '',
    VAPID_CONTACT_EMAIL: settings.VAPID_CONTACT_EMAIL ? 'configured' : '',
    RAINDROP_TOKEN: settings.RAINDROP_TOKEN ? 'configured' : ''
  };
  res.json({ ok: true, settings: safe });
});

router.get('/skills', async (_req: Request, res: Response) => {
  const skills = await listSkillsFromDisk();
  res.json({ ok: true, items: skills });
});

router.post('/skills', async (req: Request, res: Response) => {
  const { slug, title, description, content = '', allowedTools = [] } = req.body || {};
  if (!slug || !title) return res.status(400).json({ error: 'slug and title are required' });
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  await createSkillOnDisk(safeSlug, title, description || title, content, allowedTools);
  res.json({ ok: true, slug: safeSlug });
});

router.get('/tags', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM tags ORDER BY name ASC`);
  res.json({ ok: true, items: rows });
});

router.delete('/tags/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM tags WHERE id = $1`, [id]);
  res.json({ ok: true });
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
  const { name, level, status, areas = [], description, base_doc, skills = [], tags = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query<any>(
    `INSERT INTO agents (name, level, status, areas, description, base_doc)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, level || 'Estrategico', status || 'ativo', areas, description || null, base_doc || null]
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

router.patch('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, level, status, areas, description, base_doc } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];
  if (name)        { params.push(name);        updates.push(`name = $${params.length}`); }
  if (level)       { params.push(level);       updates.push(`level = $${params.length}`); }
  if (status)      { params.push(status);      updates.push(`status = $${params.length}`); }
  if (areas)       { params.push(areas);       updates.push(`areas = $${params.length}`); }
  if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
  if (base_doc !== undefined)    { params.push(base_doc);    updates.push(`base_doc = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
  params.push(id);
  const rows = await query<any>(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  res.json({ ok: true, item: rows[0] });
});

router.delete('/agents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM agents WHERE id = $1`, [id]);
  res.json({ ok: true });
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

router.get('/profile', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const profile = await getProfileValues(userId, 'profile');
  res.json({ ok: true, profile });
});

router.post('/profile', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const { fullName = '', email = '', company = '', role = '', photoUrl = '' } = req.body || {};
  await setProfileValues(userId, 'profile', {
    fullName: String(fullName),
    email: String(email),
    company: String(company),
    role: String(role),
    photoUrl: String(photoUrl),
  });
  res.json({ ok: true });
});

router.get('/preferences', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const prefs = await getProfileValues(userId, 'pref');
  res.json({ ok: true, preferences: prefs });
});

router.post('/preferences', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const current = await getProfileValues(userId, 'pref');
  const body = req.body || {};
  const merged = {
    theme: body.theme ?? current.theme ?? 'auto',
    language: body.language ?? current.language ?? 'pt-BR',
    dateFormat: body.dateFormat ?? current.dateFormat ?? 'DD/MM/YYYY',
    notifyEmail: body.notifyEmail ?? current.notifyEmail ?? 'false',
    notifyPush: body.notifyPush ?? current.notifyPush ?? 'false',
    notifyWeekly: body.notifyWeekly ?? current.notifyWeekly ?? 'false',
    notifyAnalysis: body.notifyAnalysis ?? current.notifyAnalysis ?? 'false',
  };

  await setProfileValues(userId, 'pref', {
    theme: String(merged.theme),
    language: String(merged.language),
    dateFormat: String(merged.dateFormat),
    notifyEmail: String(merged.notifyEmail),
    notifyPush: String(merged.notifyPush),
    notifyWeekly: String(merged.notifyWeekly),
    notifyAnalysis: String(merged.notifyAnalysis),
  });

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

router.post('/skill-chat', async (req: Request, res: Response) => {
  const { system, messages } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });
  if (!hasLLMConfig()) {
    return res.json({ ok: true, reply: 'LLM não configurado. Configure GEMINI_API_KEY nas variáveis de ambiente do backend (Render).' });
  }
  try {
    // Montar input completo: system prompt + histórico da conversa
    const historyText = messages.slice(0, -1).map((m: any) =>
      `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`
    ).join('\n\n');
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const fullInput = system
      ? `${system}\n\n${historyText ? '--- Histórico da conversa ---\n' + historyText + '\n\n--- Nova mensagem do usuário ---\n' : ''}${lastUserMsg}`
      : lastUserMsg;

    const reply = await agent.processInput('skill-creator', fullInput, {});
    res.json({ ok: true, reply });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || 'Erro no LLM' });
  }
});

router.post('/agent', agentLimiter, async (req: Request, res: Response) => {
  const { input, options = {} } = req.body || {};
  const userId = (req as any).user?.sub || 'pwa-user';
  if (!input) return res.status(400).json({ error: 'input is required' });
  if (!hasLLMConfig()) {
    return res.json({ ok: true, reply: offlineFallbackMessage() });
  }
  const reply = await agent.processInput(userId, input, options);
  res.json({ ok: true, reply });
});

router.post('/captures', async (req: Request, res: Response) => {
  const { content, source = 'pwa', type = 'note', tags = [], project_id, due_date } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });
  const rows = await query(
    `INSERT INTO captures (content, source, type, tags, project_id, due_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [content, source, type, tags, project_id || null, due_date || null]
  );
  res.json({ ok: true, item: rows[0] });
});

router.get('/captures', async (req: Request, res: Response) => {
  const { type, status } = req.query as { type?: string; status?: string };
  let sql = `SELECT * FROM captures WHERE 1=1`;
  const params: any[] = [];
  if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  sql += ` ORDER BY created_at DESC LIMIT 200`;
  const rows = await query(sql, params);
  res.json({ ok: true, items: rows });
});

router.patch('/captures/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, type, tags, project_id, due_date } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];

  if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
  if (type !== undefined) { params.push(type); updates.push(`type = $${params.length}`); }
  if (tags !== undefined) { params.push(tags); updates.push(`tags = $${params.length}`); }
  if (project_id !== undefined) { params.push(project_id); updates.push(`project_id = $${params.length}`); }
  if (due_date !== undefined) { params.push(due_date); updates.push(`due_date = $${params.length}`); }
  if (status === 'processed') { updates.push(`processed_at = NOW()`); }

  if (updates.length === 0) return res.status(400).json({ error: 'nothing to update' });

  params.push(id);
  const rows = await query(
    `UPDATE captures SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  res.json({ ok: true, item: rows[0] });
});

router.delete('/captures/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM captures WHERE id = $1`, [id]);
  res.json({ ok: true });
});

router.post('/captures/bulk', async (req: Request, res: Response) => {
  const { ids, action, type } = req.body || {};
  if (!ids?.length || !action) return res.status(400).json({ error: 'ids and action required' });

  if (action === 'delete') {
    await query(`DELETE FROM captures WHERE id = ANY($1)`, [ids]);
  } else if (action === 'archive') {
    await query(`UPDATE captures SET status = 'archived', processed_at = NOW() WHERE id = ANY($1)`, [ids]);
  } else if (action === 'convert_task') {
    const items = await query<any>(`SELECT * FROM captures WHERE id = ANY($1)`, [ids]);
    for (const item of items) {
      await query(
        `INSERT INTO tasks (title, status, priority) VALUES ($1, 'open', 'normal')`,
        [item.content]
      );
    }
    await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = ANY($1)`, [ids]);
  } else if (action === 'set_type' && type) {
    await query(`UPDATE captures SET type = $1 WHERE id = ANY($2)`, [type, ids]);
  }

  res.json({ ok: true });
});

router.post('/tasks', async (req: Request, res: Response) => {
  const { title, status = 'open', priority = 'normal', due_date, project_id, meeting_id } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO tasks (title, status, priority, due_date, project_id, meeting_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, status, priority, due_date || null, project_id || null, meeting_id || null]
  );

  res.json({ ok: true, item: rows[0] });
  exportTasksToGoogle().catch(e => console.error('[tasks] gcal sync failed:', e.message));
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
  // Redirecionar para o frontend correto
  // Usa FRONTEND_URL se definido, senão a própria origin do request
  const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  res.redirect(`${frontendUrl}/?google=connected`);
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
