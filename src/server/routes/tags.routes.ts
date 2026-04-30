import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';

const router = Router();

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

export default router;
