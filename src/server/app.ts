import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import routes from '@/server/routes';
import { authMiddleware } from '@/server/auth';
import { bootstrapGuard } from '@/server/admin';
import { attachRequestContext } from '@/server/http';
import { errorHandler } from '@/server/error-handler';
import { config } from '@/config/env';
import { metrics } from '@/infra/metrics/MetricsService';
import eventsRouter from '@/server/routes/events.routes';
import { registerCalendarSyncListener } from '@/core/listeners/CalendarSyncListener';

export function createApp() {
  const app = express();
  const allowedOrigins = [
    ...config.server.allowedOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
    'https://and-claw.vercel.app',
    'https://andclaw-command-ui.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'X-Retryable', 'Retry-After'],
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '5mb' }));
  app.use(attachRequestContext);
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Aguarde um momento.' },
  }));
  app.use('/api/agent/run', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Aguarde um momento.' },
  }));

  const frontendDistDir = path.join(process.cwd(), 'frontend', 'dist');
  if (!fs.existsSync(frontendDistDir)) {
    console.warn('[frontend] frontend/dist not found. Run `npm run frontend:build` before starting the server.');
  }
  app.use(express.static(frontendDistDir));

  app.use('/api', (req, res, next) => {
    const openPaths = ['/health', '/health/db', '/health/runtime', '/auth/login', '/auth/bootstrap', '/google/oauth/callback', '/api/auth/google', '/api/auth/google/callback'];
    if (openPaths.includes(req.path) || openPaths.includes(req.originalUrl.split('?')[0])) return next();

    return bootstrapGuard(req, res, () => authMiddleware(req, res, next));
  });

  app.use('/api', routes);
  app.use('/api/events', eventsRouter);
  registerCalendarSyncListener();
  app.get('/admin/metrics', (req, res, next) => {
    bootstrapGuard(req, res, () => authMiddleware(req, res, next));
  }, (_req, res) => {
    res.json({ ok: true, metrics: metrics.getMetrics(), history: metrics.getHistory() });
  });
  app.use(errorHandler);

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });

  return app;
}
