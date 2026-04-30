import { Router, Request, Response } from 'express';
import { getGoogleAuthUrl, handleGoogleOAuthCallback, listConnectedAccounts, importGoogleEvents } from '@/integrations/googleCalendar';

const router = Router();

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
  const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  res.redirect(`${frontendUrl}/?google=connected`);
});

router.post('/jobs/import-google', async (_req: Request, res: Response) => {
  await importGoogleEvents();
  res.json({ ok: true });
});

export default router;
