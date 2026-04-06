import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function attachRequestContext(_req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function getRequestId(res: Response) {
  return typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
}

export function setRetryHeaders(res: Response, retryable: boolean, retryAfterMs?: number) {
  res.setHeader('X-Retryable', retryable ? 'true' : 'false');
  if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
    res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
  }
}

export function sendApiError(
  res: Response,
  status: number,
  error: string,
  message: string,
  extras: Record<string, unknown> = {}
) {
  const retryable = typeof extras.retryable === 'boolean' ? extras.retryable : status >= 500 || status === 409;
  const retryAfterMs = typeof extras.retryAfterMs === 'number' ? extras.retryAfterMs : undefined;
  setRetryHeaders(res, retryable, retryAfterMs);

  return res.status(status).json({
    ok: false,
    error,
    message,
    retryable,
    retryAfterMs,
    requestId: getRequestId(res),
    ...extras,
  });
}

