import { createApp } from './app';
import { config } from '../config/env';
import { ensureSchema } from '../db/schema';
import { loadAuthFromDb, loadAppSettings, applyAppSettingsToConfig } from './settings';
import { startSchedulers } from '../jobs/scheduler';

export async function startServer() {
  let schemaReady = false;
  try {
    await ensureSchema();
    schemaReady = true;
  } catch (error) {
    console.error('[Server] Failed to ensure schema during startup', error);
  }

  try {
    await loadAuthFromDb();
  } catch (error) {
    console.warn('[Server] Failed to load auth from database during startup', error);
  }

  try {
    const settings = schemaReady ? await loadAppSettings() : {};
    applyAppSettingsToConfig(settings);
  } catch (error) {
    console.warn('[Server] Failed to load app settings during startup', error);
  }

  const app = createApp();
  const port = config.server.port;

  app.listen(port, () => {
    console.log(`[Server] API running on port ${port}`);
  });

  startSchedulers();
}
