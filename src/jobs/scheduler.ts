import cron from 'node-cron';
import { exportDailyGitVault } from '../integrations/gitvault';
import { syncGoogleCalendars } from '../integrations/googleCalendar';
import { sendDailyTaskAlerts } from '../integrations/push';

export function startSchedulers() {
  const calendarSyncInterval = process.env.CALENDAR_SYNC_INTERVAL_MIN || '30';
  cron.schedule(`*/${calendarSyncInterval} * * * *`, async () => {
    try {
      await syncGoogleCalendars();
    } catch (error) {
      console.error('[Scheduler] Google sync failed', error);
    }
  });

  cron.schedule('0 2 * * *', async () => {
    try {
      await exportDailyGitVault();
    } catch (error) {
      console.error('[Scheduler] GitVault export failed', error);
    }
  });

  cron.schedule('0 8 * * *', async () => {
    try {
      await sendDailyTaskAlerts();
    } catch (error) {
      console.error('[Scheduler] Push alerts failed', error);
    }
  });
}
