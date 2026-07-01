import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { maskLlmProvider } from './shared';
import { ProviderFactory } from '@/providers/ProviderFactory';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/llm/providers', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await query(`SELECT * FROM llm_providers ORDER BY priority DESC, created_at ASC`);
  res.json({ ok: true, items: rows.map(maskLlmProvider) });
}));

router.post('/llm/providers', asyncHandler(async (req: Request, res: Response) => {
  const { id, name, api_key, base_url, model, priority } = req.body;
  const supportedNames = ProviderFactory.getSupportedProviderNames();
  if (!name || !supportedNames.includes(String(name).toLowerCase())) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_provider_name',
      message: `Provider name must be one of: ${supportedNames.join(', ')}`,
    });
  }
  const rows = await query(
    `INSERT INTO llm_providers (id, name, api_key, base_url, model, priority)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, name, api_key, base_url, model, priority || 0]
  );
  res.status(201).json({ ok: true, item: maskLlmProvider(rows[0]), id: rows[0]?.id });
}));

router.patch('/llm/providers/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled, priority, api_key, model, base_url } = req.body;
  const rows = await query(
    `UPDATE llm_providers 
     SET enabled = COALESCE($1, enabled),
         priority = COALESCE($2, priority),
         api_key = COALESCE($3, api_key),
         model = COALESCE($4, model),
         base_url = COALESCE($5, base_url),
         updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [enabled, priority, api_key, model, base_url, id]
  );
  res.json({ ok: true, item: maskLlmProvider(rows[0]) });
}));

router.delete('/llm/providers/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await query(`DELETE FROM llm_providers WHERE id = $1`, [id]);
  res.json({ ok: true });
}));

// Has explicit try/catch — not double-wrapped
router.post('/llm/providers/test', async (req: Request, res: Response) => {
  const { name } = req.body;
  try {
    const { ProviderFactory } = await import('@/providers/ProviderFactory');
    const provider = ProviderFactory.getProvider(name);
    await provider.initialize();
    res.json({ ok: true, message: `Conexão com ${name} estabelecida com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
