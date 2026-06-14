import { Router, Request, Response } from 'express';
import { query } from '@/db/postgres';
import { DailyPlannerService } from '@/core/agent/DailyPlannerService';

const router = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/daily-briefing', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'pwa-user';
  const briefing = await DailyPlannerService.getDailyBriefing(userId);
  res.json({ ok: true, briefing });
}));

router.post('/daily-briefing/generate', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.body.userId as string) || 'pwa-user';
  await query(`DELETE FROM daily_briefings WHERE user_id = $1 AND briefing_date = CURRENT_DATE`, [userId]);
  const briefing = await DailyPlannerService.getDailyBriefing(userId);
  res.json({ ok: true, briefing });
}));

export default router;
