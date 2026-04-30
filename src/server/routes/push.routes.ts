import { Router, Request, Response } from 'express';
import { registerPushSubscription, sendPushTest, getVapidPublicKey } from '@/integrations/push';

const router = Router();

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

export default router;
