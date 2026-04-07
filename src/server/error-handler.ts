import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/infra/logger';
import { getRequestId } from '@/server/http';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.context?.requestId || getRequestId(res);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'Invalid request payload.',
        details: err.flatten(),
      },
      requestId,
    });
  }

  const status = typeof err?.status === 'number' ? err.status : 500;
  const code = typeof err?.code === 'string' ? err.code : 'internal_error';
  const message = err?.message || 'Unexpected server error.';

  logger.error('server.error', {
    requestId,
    code,
    message,
    stack: err?.stack,
  });

  return res.status(status).json({
    error: {
      code,
      message,
      details: err?.details || undefined,
    },
    requestId,
  });
}

