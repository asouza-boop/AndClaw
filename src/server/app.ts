import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));

  app.use('/api', routes);

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
