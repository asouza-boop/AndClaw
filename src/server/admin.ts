import { Request, Response } from 'express';
import { config } from '../config/env';

const MIN_TOKEN_LEN = 24;

export function bootstrapGuard(req: Request, res: Response, next: () => void) {
  if (config.auth.password && config.auth.password.length >= 8 && config.auth.tokenSecret && config.auth.tokenSecret.length >= MIN_TOKEN_LEN) {
    return next();
  }
  return res.status(503).json({ error: 'bootstrap_required' });
}
