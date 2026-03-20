import { Request, Response } from 'express';
import { config } from '../config/env';

const MIN_TOKEN_LEN = 24;

/**
 * Middleware que bloqueia requests quando o sistema ainda não foi bootstrapped.
 * Retorna 409 (Conflict) com { error: 'bootstrap_required' } — estado de pré-configuração,
 * não indisponibilidade de serviço (503).
 */
export function bootstrapGuard(req: Request, res: Response, next: () => void) {
  const hasPassword = config.auth.password && config.auth.password.length >= 8;
  const hasSecret = config.auth.tokenSecret && config.auth.tokenSecret.length >= MIN_TOKEN_LEN;

  if (hasPassword && hasSecret) {
    return next();
  }

  return res.status(409).json({
    error: 'bootstrap_required',
    message: 'System not initialized. POST /api/auth/bootstrap to set admin password.',
    docs: 'POST /api/auth/bootstrap with { "password": "string (min 8)", "tokenSecret": "string (min 24)" }'
  });
}
