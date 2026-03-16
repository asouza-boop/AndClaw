import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { authMiddleware } from './auth';
import { bootstrapGuard } from './admin';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));

  app.use('/api', (req, res, next) => {
    const openPaths = ['/health', '/health/db', '/auth/login', '/auth/bootstrap', '/google/oauth/callback'];
    if (openPaths.includes(req.path)) return next();

    return bootstrapGuard(req, res, () => authMiddleware(req, res, next));
  });

  app.use('/api', routes);

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
