import { Router, Request, Response } from 'express';
import { exportDailyGitVault } from '@/integrations/gitvault';

const router = Router();

router.post('/gitvault/export', async (_req: Request, res: Response) => {
  await exportDailyGitVault();
  res.json({ ok: true });
});

export default router;
