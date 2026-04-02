import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import routes from './routes';
import { authMiddleware } from './auth';
import { bootstrapGuard } from './admin';
import { config } from '../config/env';

export function createApp() {
  const app = express();
  const allowedOrigin = config.server.allowedOrigin;
  app.use(cors({
    origin: allowedOrigin || false,
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));

  const frontendDistDir = path.join(process.cwd(), 'frontend', 'dist');
  if (!fs.existsSync(frontendDistDir)) {
    console.warn('[frontend] frontend/dist not found. Run `npm run frontend:build` before starting the server.');
  }
  app.use(express.static(frontendDistDir));

  app.use('/api', (req, res, next) => {
    const openPaths = ['/health', '/health/db', '/auth/login', '/auth/bootstrap', '/google/oauth/callback'];
    if (openPaths.includes(req.path)) return next();

    return bootstrapGuard(req, res, () => authMiddleware(req, res, next));
  });

  app.use('/api', routes);

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });

  return app;
}
