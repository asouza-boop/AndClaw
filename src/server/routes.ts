import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { TaskService } from '@/core/agent/TaskService';
import { ensureSchema } from '@/db/schema';
import {
  syncGoogleCalendars,
  exportTasksToGoogle,
  importGoogleEvents,
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
  listConnectedAccounts,
} from '@/integrations/googleCalendar';
import { exportDailyGitVault } from '@/integrations/gitvault';
import { registerPushSubscription, sendPushTest, getVapidPublicKey } from '@/integrations/push';
import { listRaindropCollections, listRaindrops } from '@/integrations/raindrop';
import { AgentController } from '@/core/AgentController';
import { hasLLMConfig, offlineFallbackMessage } from '@/server/llm';
import { config } from '@/config/env';
import { setSetting, loadAuthFromDb, loadAppSettings, applyAppSettingsToConfig } from '@/server/settings';
import { getRequestId, sendApiError, setRetryHeaders } from '@/server/http';
import { metrics } from '@/infra/metrics/MetricsService';
import fs from 'fs/promises';
import path from 'path';
import authRoutes from '@/server/auth-routes';
import systemRoutes from '@/server/system-routes';
import agentRoutes from '@/server/agent-routes';
import { AgentEvaluator } from '@/core/evaluation/AgentEvaluator';
import { MetricsService } from '@/core/metrics/MetricsService';
import { ParameterStore } from '@/core/optimization/ParameterStore';
import memoryRoutes from '@/server/memory-routes';
import toolRoutes from '@/server/tool-routes';
import performanceRoutes from '@/server/performance-routes';

const router = Router();
const agent = new AgentController();

type SkillDiskRecord = {
  slug: string;
  title: string;
  description: string;
  allowedTools: string[];
  content: string;
};

function parseSkillDocument(slug: string, content: string): SkillDiskRecord {
  let title = slug;
  let description = '';
  let allowedTools: string[] = [];
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    const toolsMatch = fm.match(/^allowed-tools:\s*(.+)$/m);
    if (nameMatch) title = nameMatch[1].trim();
    if (descMatch) description = descMatch[1].trim();
    if (toolsMatch) allowedTools = toolsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  }
  if (!description) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const heading = lines.find(l => l.startsWith('#'));
    if (heading) title = heading.replace(/^#+\s*/, '').trim();
    description = lines.find(l => !l.startsWith('#') && l.length > 20) || '';
  }
  return { slug, title, description, allowedTools, content };
}

function inferActionItems(text: string) {
  const candidates = text
    .split(/\n+/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
  return candidates.map(item => ({ text: item, done: false }));
}

function mapMeetingRow(meeting: any) {
  return {
    ...meeting,
    date: meeting.meeting_date,
    transcript: meeting.transcript_text,
    action_items: Array.isArray(meeting.action_items) ? meeting.action_items : [],
    skills_used: meeting.skills_used || [],
    participants: meeting.participants || [],
  };
}

router.use(authRoutes);
router.use(systemRoutes);
router.use(agentRoutes);
router.use(memoryRoutes);
router.use(toolRoutes);
router.use('/learning', performanceRoutes);

router.get('/admin/metrics', async (_req: Request, res: Response) => {
  res.json({ ok: true, metrics: metrics.getMetrics(), history: metrics.getHistory() });
});

router.get('/api/experiments', async (_req: Request, res: Response) => {
  res.json({ ok: true, ...AgentEvaluator.getExperimentStats() });
});

router.get('/api/learning/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await MetricsService.getDashboardSnapshot();
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/learning/params', (_req: Request, res: Response) => {
  res.json({ ok: true, params: ParameterStore.getAll() });
});

router.post('/api/learning/params/reset', (_req: Request, res: Response) => {
  ParameterStore.resetAll();
  res.json({ ok: true, message: 'Parâmetros resetados para padrões de fábrica.' });
});

async function listSkillsFromDisk() {
  const root = config.paths.skills;
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const file = path.join(root, slug, 'SKILL.md');
    let content = '';
    try {
      content = await fs.readFile(file, 'utf-8');
      const parsed = parseSkillDocument(slug, content);
      const sectionCount = (content.match(/^##\s/gm) || []).length;
      skills.push({
        slug,
        id: slug,
        title: parsed.title,
        name: slug,
        description: parsed.description,
        allowedTools: parsed.allowedTools,
        tools: parsed.allowedTools,
        content,
        sectionCount,
        hasContent: content.length > 100,
      });
    } catch {}
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

async function updateSkillOnDisk(slug: string, content: string) {
  const file = path.join(config.paths.skills, slug, 'SKILL.md');
  await fs.writeFile(file, content, 'utf-8');
}

async function deleteSkillOnDisk(slug: string) {
  const skillDir = path.join(config.paths.skills, slug);
  await fs.rm(skillDir, { recursive: true, force: true });
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

router.get('/notifications', async (_req: Request, res: Response) => {
  await ensureSchema();
  const items = [
    ...(await query<any>(`SELECT id::text, 'task' as type, 'Nova tarefa' as title, title as body, false as read, created_at FROM tasks ORDER BY created_at DESC LIMIT 5`)),
    ...(await query<any>(`SELECT id::text, 'meeting' as type, 'Reunião registrada' as title, title as body, false as read, created_at FROM meetings ORDER BY created_at DESC LIMIT 5`)),
    ...(await query<any>(`SELECT id::text, 'alert' as type, 'Inbox atualizado' as title, content as body, false as read, created_at FROM captures ORDER BY created_at DESC LIMIT 5`)),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((item) => ({
      ...item,
      createdAt: item.created_at,
      link:
        item.type === 'task' ? '/projetos' :
        item.type === 'meeting' ? '/reunioes' :
        '/inbox',
    }));

  res.json({ ok: true, items });
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
  const body = req.body || {};
  const slug = body.slug || body.name;
  const title = body.title || body.name || slug;
  const { description, content = '', allowedTools = [] } = body;
  if (!slug || !title) return res.status(400).json({ error: 'slug/name and title are required', required_fields: ['slug (or name)', 'title'], optional_fields: ['description', 'content', 'allowedTools'] });
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  await createSkillOnDisk(safeSlug, title, description || title, content, allowedTools);
  res.status(201).json({ ok: true, slug: safeSlug, name: safeSlug, title, id: safeSlug });
});

router.put('/skills/:id', async (req: Request, res: Response) => {
  const slug = String(req.params.id);
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content is required' });
  await updateSkillOnDisk(slug, String(content));
  res.json({ ok: true, id: slug });
});

router.delete('/skills/:id', async (req: Request, res: Response) => {
  const slug = String(req.params.id);
  await deleteSkillOnDisk(slug);
  res.json({ ok: true, id: slug });
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
  res.status(201).json({ ok: true, item: rows[0], id: rows[0]?.id });
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
  // Return raw array for REST clients; PWA handles both formats
  res.json(items);
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

  res.status(201).json({
    ok: true,
    item: agent,
    id: agent?.id,
    name: agent?.name,
    level: agent?.level,
    status: agent?.status,
  });
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

router.post('/agents/:id/execute', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { skill_id, skill_ids, task_id, task_title, task_description } = req.body || {};

  const agentRows = await query<any>(`SELECT * FROM agents WHERE id = $1`, [id]);
  const agentRow = agentRows[0];
  if (!agentRow) return res.status(404).json({ error: 'agent not found' });

  const taskRows = task_id
    ? await query<any>(`SELECT * FROM tasks WHERE id = $1`, [task_id])
    : [];
  const task = taskRows[0];

  const requestedSkillIds = Array.isArray(skill_ids) && skill_ids.length
    ? skill_ids
    : skill_id
      ? [skill_id]
      : Array.isArray(task?.skill_ids) && task.skill_ids.length
        ? task.skill_ids
        : [];

  if (!requestedSkillIds.length) {
    return res.status(400).json({ error: 'skill_id is required' });
  }

  const availableSkills = await listSkillsFromDisk();
  const outputs: any[] = [];
  const scopedUserId = `automation:${id}:${task?.id || task_id || 'manual'}`;
  const taskLabel = task?.title || task_title || 'Tarefa';
  const taskNotes = task?.description || task_description || '';

  for (const rawSkillId of requestedSkillIds) {
    const normalizedSkillId = String(rawSkillId);
    const skill = availableSkills.find((s: any) =>
      s.slug === normalizedSkillId ||
      s.id === normalizedSkillId ||
      s.name === normalizedSkillId ||
      s.title === normalizedSkillId
    );

    if (!skill) {
      outputs.push({
        skill_id: normalizedSkillId,
        ok: false,
        error: 'skill not found',
      });
      continue;
    }

    if (!hasLLMConfig()) {
      outputs.push({
        skill_id: normalizedSkillId,
        ok: true,
        offline: true,
        reply: offlineFallbackMessage(),
        skill: { id: skill.id, slug: skill.slug, title: skill.title },
      });
      continue;
    }

    const prompt = [
      `Você é o agente "${agentRow.name || agentRow.title || 'Agente'}".`,
      `Execute a skill "${skill.title}" com foco na tarefa concluída abaixo.`,
      '',
      `Tarefa: ${taskLabel}`,
      taskNotes ? `Descrição: ${taskNotes}` : '',
      '',
      'Conteúdo da skill:',
      skill.content,
      '',
      'Responda de forma objetiva com resultado, próximos passos e riscos.',
    ].filter(Boolean).join('\n');

    const reply = await agent.processInput(scopedUserId, prompt, {
      source: 'task_done_automation',
      agentId: id,
      taskId: task?.id || task_id || null,
      skillId: skill.slug,
    });

    outputs.push({
      skill_id: normalizedSkillId,
      ok: true,
      reply,
      skill: { id: skill.id, slug: skill.slug, title: skill.title },
    });
  }

  res.json({
    ok: true,
    agent: { id: agentRow.id, name: agentRow.name, level: agentRow.level, status: agentRow.status },
    task: task ? { id: task.id, title: task.title, status: task.status } : null,
    items: outputs,
    offline: !hasLLMConfig(),
  });
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
  res.status(201).json({ ok: true, item: rows[0], id: rows[0]?.id });
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
  res.status(201).json({ ok: true, item: fav, id: fav?.id });
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

router.get('/messages/:id/trace', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await query<any>(`SELECT trace FROM messages WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'message not found' });
  res.json({ ok: true, trace: rows[0].trace });
});

router.get('/conversations/:id/latest-trace', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await query<any>(
    `SELECT trace FROM messages 
     WHERE conversation_id = $1 AND role = 'assistant' 
     ORDER BY created_at DESC LIMIT 1`, 
    [id]
  );
  res.json({ ok: true, trace: rows[0]?.trace || null });
});
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

router.post('/captures', async (req: Request, res: Response) => {
  const body = req.body || {};
  // Accept 'title' as alias for 'content' (REST convention compatibility)
  const content = body.content || body.title;
  const { source = 'pwa', type = 'note', tags = [], project_id, due_date, metadata = {}, status = 'pending' } = body;
  if (!content) return res.status(400).json({ error: 'content is required', note: 'Also accepts title as alias for content' });
  const rows = await query(
    `INSERT INTO captures (content, source, type, tags, project_id, due_date, metadata, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [content, source, type, tags, project_id || null, due_date || null, JSON.stringify(metadata), status]
  );
  const row = rows[0];

  // Auto-create task if capture type is 'task'
  if (row && type === 'task') {
    await TaskService.createFromCapture(row);
  }

  res.status(201).json({
    ok: true,
    item: row,
    id: row?.id,
    title: body.title || row?.content,  // echo back for REST clients
    content: row?.content,
    type: row?.type,
    status: row?.status,
  });
});

router.get('/captures', async (req: Request, res: Response) => {
  const { type, status } = req.query as { type?: string; status?: string };
  let sql = `SELECT * FROM captures WHERE 1=1`;
  const params: any[] = [];
  if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  sql += ` ORDER BY created_at DESC LIMIT 200`;
  const rows = await query(sql, params);
  const fmt = (req as any).query?.format;
  if (fmt === 'array') return res.json(rows);
  res.json({ ok: true, items: rows, captures: rows });
});

router.patch('/captures/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, type, tags, project_id, due_date, metadata } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];

  if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
  if (type !== undefined) { params.push(type); updates.push(`type = $${params.length}`); }
  if (tags !== undefined) { params.push(tags); updates.push(`tags = $${params.length}`); }
  if (project_id !== undefined) { params.push(project_id); updates.push(`project_id = $${params.length}`); }
  if (due_date !== undefined) { params.push(due_date); updates.push(`due_date = $${params.length}`); }
  if (metadata !== undefined) { params.push(JSON.stringify(metadata)); updates.push(`metadata = $${params.length}`); }
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
  if (!ids?.length && action !== 'extract') return res.status(400).json({ error: 'ids and action required' });

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
  } else if (action === 'extract') {
    // Process all unprocessed or specific IDs
    const targetIds = ids?.length ? ids : null;
    let items;
    if (targetIds) {
      items = await query<any>(`SELECT * FROM captures WHERE id = ANY($1) AND status != 'processed'`, [targetIds]);
    } else {
      items = await query<any>(`SELECT * FROM captures WHERE status != 'processed' LIMIT 20`);
    }

    if (!items.length) return res.json({ ok: true, message: 'Nada para processar' });

    if (!hasLLMConfig()) {
      return res.status(500).json({ error: 'LLM não configurada para extração automática' });
    }

    const inputData = items.map((it: any, idx: number) => `${idx + 1}. [ID:${it.id}] ${it.content}`).join('\n');
    const prompt = `Analise os itens capturados abaixo e categorize cada um. 
Responda APENAS em JSON no formato: [{"id": x, "category": "task"|"knowledge", "title": "título curto", "content": "conteúdo formatado markdown", "priority": "high"|"normal"|"low"}]

Contexto:
- "task": Algo acionável (Gerar tarefa).
- "knowledge": Informação, ideia ou nota (Gerar item de memória/conhecimento).

Itens:
${inputData}`;

    const reply = await agent.processInput('pwa-user', prompt);
    let results;
    try {
      const jsonStr = reply.replace(/```json|```/g, '').trim();
      results = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[extract] Failed to parse agent JSON:', reply);
      return res.status(500).json({ error: 'Falha na análise estruturada do agente', raw: reply });
    }

    for (const resItem of results) {
      if (resItem.category === 'task') {
        await query(
          `INSERT INTO tasks (title, status, priority) VALUES ($1, 'open', $2)`,
          [resItem.title || 'Nova Tarefa', resItem.priority || 'normal']
        );
      } else {
        await query(
          `INSERT INTO memory_items (type, content, source_type, source_id)
           VALUES ($1, $2, $3, $4)`,
          ['ai_extraction', resItem.content || resItem.title, 'capture', String(resItem.id)]
        );
      }
      await query(`UPDATE captures SET status = 'processed', processed_at = NOW() WHERE id = $1`, [resItem.id]);
    }
  }

  res.json({ ok: true });
});

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

router.post('/meetings', async (req: Request, res: Response) => {
  const {
    title,
    meeting_date,
    date,
    transcript_text,
    transcript,
    status = 'scheduled',
    duration = null,
    participants = [],
    summary = null,
    action_items = [],
    skills_used = [],
    notes = null,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const rows = await query(
    `INSERT INTO meetings (title, meeting_date, transcript_text, status, duration, participants, summary, action_items, skills_used, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) RETURNING *`,
    [
      title,
      meeting_date || date || null,
      transcript_text || transcript || null,
      status,
      duration,
      participants,
      summary,
      JSON.stringify(action_items || []),
      skills_used,
      notes,
    ]
  );
  res.status(201).json({ ok: true, item: mapMeetingRow(rows[0]), id: rows[0]?.id });
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
  await query(`UPDATE meetings SET summary = $1 WHERE id = $2`, [reply, meetingId]);
  await query(
    `INSERT INTO memory_items (type, content, source_type, source_id)
     VALUES ($1, $2, $3, $4)`,
    ['meeting_insight', reply, 'meeting', String(meetingId)]
  );

  res.json({ ok: true, insight: reply });
});

router.get('/meetings/:id', async (req: Request, res: Response) => {
  const rows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'meeting not found' });
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
});

router.put('/meetings/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, date, meeting_date, transcript, transcript_text, status, duration, participants, summary, action_items, skills_used, notes } = req.body || {};
  const updates: string[] = [];
  const params: any[] = [];
  if (title !== undefined) { params.push(title); updates.push(`title = $${params.length}`); }
  if (date !== undefined || meeting_date !== undefined) { params.push(meeting_date || date || null); updates.push(`meeting_date = $${params.length}`); }
  if (transcript !== undefined || transcript_text !== undefined) { params.push(transcript_text || transcript || null); updates.push(`transcript_text = $${params.length}`); }
  if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
  if (duration !== undefined) { params.push(duration); updates.push(`duration = $${params.length}`); }
  if (participants !== undefined) { params.push(participants); updates.push(`participants = $${params.length}`); }
  if (summary !== undefined) { params.push(summary); updates.push(`summary = $${params.length}`); }
  if (action_items !== undefined) { params.push(JSON.stringify(action_items)); updates.push(`action_items = $${params.length}::jsonb`); }
  if (skills_used !== undefined) { params.push(skills_used); updates.push(`skills_used = $${params.length}`); }
  if (notes !== undefined) { params.push(notes); updates.push(`notes = $${params.length}`); }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
  params.push(id);
  const rows = await query<any>(`UPDATE meetings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
});

router.post('/meetings/:id/upload-audio', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rows = await query<any>(
    `UPDATE meetings
     SET audio_file_name = COALESCE(audio_file_name, 'upload-received'), status = 'in_progress'
     WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'meeting not found' });
  res.json({ ok: true, item: mapMeetingRow(rows[0]) });
});

router.post('/meetings/:id/process', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action = 'summarize' } = req.body || {};
  const rows = await query<any>(`SELECT * FROM meetings WHERE id = $1`, [id]);
  const meeting = rows[0];
  if (!meeting) return res.status(404).json({ error: 'meeting not found' });

  if (action === 'transcribe') {
    const transcript = meeting.transcript_text || `Áudio recebido para "${meeting.title}". Transcrição automática ainda não está configurada no backend.`;
    const updated = await query<any>(`UPDATE meetings SET transcript_text = $1, status = 'in_progress' WHERE id = $2 RETURNING *`, [transcript, id]);
    return res.json({ ok: true, item: mapMeetingRow(updated[0]) });
  }

  if (!meeting.transcript_text) {
    return res.status(400).json({ error: 'meeting transcript not available' });
  }

  if (!hasLLMConfig()) {
    if (action === 'extract_actions') {
      const actionItems = inferActionItems(meeting.transcript_text);
      const updated = await query<any>(`UPDATE meetings SET action_items = $1::jsonb WHERE id = $2 RETURNING *`, [JSON.stringify(actionItems), id]);
      return res.json({ ok: true, item: mapMeetingRow(updated[0]), offline: true });
    }
    const summary = offlineFallbackMessage();
    const updated = await query<any>(`UPDATE meetings SET summary = $1, status = 'completed' WHERE id = $2 RETURNING *`, [summary, id]);
    return res.json({ ok: true, item: mapMeetingRow(updated[0]), offline: true });
  }

  if (action === 'extract_actions') {
    const prompt = `Extraia próximas ações objetivas da transcrição abaixo. Responda em lista markdown.\n\n${meeting.transcript_text}`;
    const reply = await agent.processInput('pwa-user', prompt);
    const actionItems = reply
      .split('\n')
      .map(line => line.replace(/^[-*0-9.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 10)
      .map(text => ({ text, done: false }));
    const updated = await query<any>(`UPDATE meetings SET action_items = $1::jsonb, status = 'completed' WHERE id = $2 RETURNING *`, [JSON.stringify(actionItems), id]);
    return res.json({ ok: true, item: mapMeetingRow(updated[0]) });
  }

  const prompt = `Resuma a reunião abaixo em markdown com decisões, riscos e próximos passos.\n\n${meeting.transcript_text}`;
  const reply = await agent.processInput('pwa-user', prompt);
  const updated = await query<any>(`UPDATE meetings SET summary = $1, status = 'completed' WHERE id = $2 RETURNING *`, [reply, id]);
  res.json({ ok: true, item: mapMeetingRow(updated[0]) });
});

router.get('/meetings', async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM meetings ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows.map(mapMeetingRow) });
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
