import { google } from 'googleapis';
import { config } from '../config/env';
import { ensureSchema } from '../db/schema';
import { query } from '../db/postgres';

interface GoogleAccountConfig {
  email: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  calendarId?: string;
  exportTasks?: boolean;
}

function loadAccounts(): GoogleAccountConfig[] {
  try {
    const raw = JSON.parse(config.google.accountsJson || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function getClient(account: GoogleAccountConfig) {
  const oauth2Client = new google.auth.OAuth2(
    account.clientId,
    account.clientSecret,
    account.redirectUri
  );
  oauth2Client.setCredentials({ refresh_token: account.refreshToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function importGoogleEvents(): Promise<void> {
  await ensureSchema();
  const accounts = loadAccounts();
  if (accounts.length === 0) return;

  const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString();

  for (const account of accounts) {
    const calendar = getClient(account);
    const calendarId = account.calendarId || 'primary';
    const events = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const items = events.data.items || [];
    for (const event of items) {
      const externalId = event.id || '';
      if (!externalId) continue;

      await query(
        `INSERT INTO calendar_events (account_email, calendar_id, external_event_id, summary, start_time, end_time, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (account_email, calendar_id, external_event_id)
         DO UPDATE SET summary = EXCLUDED.summary, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = NOW()`,
        [
          account.email,
          calendarId,
          externalId,
          event.summary || '',
          event.start?.dateTime || event.start?.date || null,
          event.end?.dateTime || event.end?.date || null,
        ]
      );
    }
  }
}

export async function exportTasksToGoogle(): Promise<void> {
  await ensureSchema();
  const accounts = loadAccounts();
  if (accounts.length === 0) return;

  const tasks = await query<any>(
    `SELECT * FROM tasks WHERE due_date IS NOT NULL AND gcal_event_id IS NULL ORDER BY created_at ASC LIMIT 50`
  );

  const exportAccounts = accounts.filter((account, idx) => account.exportTasks ?? idx === 0);

  for (const account of exportAccounts) {
    const calendar = getClient(account);
    const calendarId = account.calendarId || 'primary';

    for (const task of tasks) {
      const start = new Date(task.due_date);
      const end = new Date(start.getTime() + 30 * 60000);

      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: task.title,
          description: `Task ID: ${task.id}`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          reminders: { useDefault: true },
        },
      });

      const eventId = event.data.id || null;
      if (eventId) {
        await query(`UPDATE tasks SET gcal_event_id = $1 WHERE id = $2`, [eventId, task.id]);
      }
    }
  }
}

export async function syncGoogleCalendars(): Promise<void> {
  await importGoogleEvents();
  await exportTasksToGoogle();
}
