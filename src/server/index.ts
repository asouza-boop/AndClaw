import { createApp } from './app';
import { config } from '@/config/env';
import { ensureSchema } from '@/db/schema';
import { loadAuthFromDb, loadAppSettings, applyAppSettingsToConfig } from '@/server/settings';
import { startSchedulers } from '@/jobs/scheduler';
import { logger } from '@/infra/logger';

export async function startServer() {
  const app = createApp();
  const port = config.server.port;

  app.listen(port, '0.0.0.0', () => {
    logger.info(`[Server] API running on port ${port}`);
  });

  let schemaReady = false;
  try {
    await ensureSchema();
    schemaReady = true;
  } catch (error) {
    logger.error('server.schema_startup_failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  try {
    await loadAuthFromDb();
  } catch (error) {
    logger.warn('server.auth_startup_failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  try {
    const settings = schemaReady ? await loadAppSettings() : {};
    applyAppSettingsToConfig(settings);
  } catch (error) {
    logger.warn('server.settings_startup_failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  startSchedulers();
}
