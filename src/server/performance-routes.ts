import { Router, Request, Response } from 'express';
import { OptimizationEngine } from '@/core/learning/OptimizationEngine';

const router = Router();

/**
 * GET /api/learning/performance
 * Returns aggregate metrics for skill performance based on passive optimization learning.
 */
router.get('/performance', (req: Request, res: Response) => {
  const scores = OptimizationEngine.getAllScores();
  const items = Array.from(scores.values());
  
  res.json({
    ok: true,
    items,
    timestamp: new Date().toISOString()
  });
});

export default router;
