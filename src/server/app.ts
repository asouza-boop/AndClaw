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
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
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
