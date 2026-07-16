import cron from 'node-cron';
import { exportDailyGitVault } from '@/integrations/gitvault';
import { syncGoogleCalendars } from '@/integrations/googleCalendar';
import { sendDailyTaskAlerts } from '@/integrations/push';
import { logger } from '@/infra/logger';

export function startSchedulers() {
  const calendarSyncInterval = process.env.CALENDAR_SYNC_INTERVAL_MIN || '30';
  cron.schedule(`*/${calendarSyncInterval} * * * *`, async () => {
    try {
      await syncGoogleCalendars();
    } catch (error) {
      logger.error('scheduler.google_sync_failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  cron.schedule('0 2 * * *', async () => {
    try {
      await exportDailyGitVault();
    } catch (error) {
      logger.error('scheduler.git_vault_export_failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });

  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDailyTaskAlerts();
    } catch (error) {
      logger.error('scheduler.push_alerts_failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
}
