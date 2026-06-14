import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { loadAppSettings, applyAppSettingsToConfig, setSetting } from '@/server/settings';
import { config } from '@/config/env';
import { metrics } from '@/infra/metrics/MetricsService';
import { AgentEvaluator } from '@/core/evaluation/AgentEvaluator';
import { MetricsService } from '@/core/metrics/MetricsService';
import { ParameterStore } from '@/core/optimization/ParameterStore';
import { listRaindropCollections, listRaindrops } from '@/integrations/raindrop';
import { setEntityTags } from './shared';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/admin/metrics', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ ok: true, metrics: metrics.getMetrics(), history: metrics.getHistory() });
}));

router.get('/experiments', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ ok: true, ...AgentEvaluator.getExperimentStats() });
}));

// Has explicit try/catch — not double-wrapped
router.get('/learning/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await MetricsService.getDashboardSnapshot();
    res.json({ 
      ok: true, 
      topSkills: data.skills.top.map(s => ({ ...s, avgLatencyMs: s.usageCount > 0 ? Math.round(s.totalLatencyMs / s.usageCount) : 0 })),
      worstSkills: data.skills.worst.map(s => ({ ...s, avgLatencyMs: s.usageCount > 0 ? Math.round(s.totalLatencyMs / s.usageCount) : 0 })),
      cacheEfficiency: data.cache.efficiency,
      fallbackRate: data.planner.fallbackRate,
      avgLatency: data.memory.avgSearchLatency
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/learning/params', (_req: Request, res: Response) => {
  res.json({ ok: true, params: ParameterStore.getAll() });
});

router.post('/learning/params/reset', (_req: Request, res: Response) => {
  ParameterStore.resetAll();
  res.json({ ok: true, message: 'Parâmetros resetados para padrões de fábrica.' });
});

router.get('/notifications', asyncHandler(async (_req: Request, res: Response) => {
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
}));

router.get('/settings', asyncHandler(async (_req: Request, res: Response) => {
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
}));

router.post('/settings', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.post('/deploy', asyncHandler(async (_req: Request, res: Response) => {
  const settings = await loadAppSettings();
  const hook = settings.RENDER_DEPLOY_HOOK_URL;
  if (!hook) return res.status(400).json({ error: 'deploy hook not configured' });

  const resp = await fetch(hook, { method: 'POST' });
  if (!resp.ok) return res.status(500).json({ error: 'deploy failed' });

  await setSetting('LAST_DEPLOY_AT', new Date().toISOString());
  res.json({ ok: true });
}));

router.get('/projects', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM projects ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
}));

router.post('/projects', asyncHandler(async (req: Request, res: Response) => {
  const { name, status = 'active', summary } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query(
    `INSERT INTO projects (name, status, summary) VALUES ($1, $2, $3) RETURNING *`,
    [name, status, summary || null]
  );
  res.status(201).json({ ok: true, id: rows[0]?.id, item: rows[0] });
}));

router.get('/links', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM page_links ORDER BY created_at DESC LIMIT 200`);
  res.json({ ok: true, items: rows });
}));

router.post('/links', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.get('/favorites', asyncHandler(async (_req: Request, res: Response) => {
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
}));

router.post('/favorites', asyncHandler(async (req: Request, res: Response) => {
  const { title, url, tags = [] } = req.body || {};
  if (!title || !url) return res.status(400).json({ error: 'title and url are required' });
  const rows = await query<any>(
    `INSERT INTO favorites (title, url, source)
     VALUES ($1, $2, 'manual') RETURNING *`,
    [title, url]
  );
  const fav = rows[0];
  await setEntityTags(query, 'favorite', String(fav.id), tags);
  res.status(201).json({ ok: true, item: fav, id: fav?.id });
}));

router.get('/raindrop/collections', asyncHandler(async (_req: Request, res: Response) => {
  if (!config.raindrop.token) return res.json({ ok: true, items: [] });
  const items = await listRaindropCollections();
  res.json({ ok: true, items });
}));

router.get('/raindrop/items', asyncHandler(async (req: Request, res: Response) => {
  if (!config.raindrop.token) return res.json({ ok: true, items: [] });
  const collectionId = (req.query.collectionId as string) || config.raindrop.collectionId;
  const perpage = parseInt((req.query.perpage as string) || '30', 10);
  const page = parseInt((req.query.page as string) || '0', 10);
  const items = await listRaindrops(collectionId, perpage, page);
  res.json({ ok: true, items });
}));

router.post('/raindrop/sync', asyncHandler(async (req: Request, res: Response) => {
  if (!config.raindrop.token) return res.status(400).json({ error: 'raindrop token not configured' });
  const { collectionId, perpage = 50, page = 0 } = req.body || {};
  const items = await listRaindrops(collectionId || config.raindrop.collectionId, perpage, page);
  let upserted = 0;
  for (const item of items) {
    const externalId = String((item as any)._id || (item as any).id || '');
    const title = (item as any).title || (item as any).link || 'Sem titulo';
    const link = (item as any).link || (item as any).url;
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
}));

export default router;
