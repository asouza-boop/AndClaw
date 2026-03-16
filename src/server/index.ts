import { createApp } from './app';
import { config } from '../config/env';
import { ensureSchema } from '../db/schema';
import { startSchedulers } from '../jobs/scheduler';

export async function startServer() {
  await ensureSchema();
  const app = createApp();
  const port = config.server.port;

  app.listen(port, () => {
    console.log(`[Server] API running on port ${port}`);
  });

  startSchedulers();
}
