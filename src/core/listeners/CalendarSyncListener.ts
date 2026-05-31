import { agentEvents, TASK_MUTATED, MEETING_MUTATED } from '@/core/events/AgentEvents';
import { query } from '@/db/postgres';
import { google } from 'googleapis';
import { config } from '@/config/env';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/infra/logger';

interface SyncPayload {
  taskId?: string;
  meetingId?: string;
  due_date?: string;
  start_time?: string;
  title: string;
}

/**
 * Loads Google Calendar accounts from DB.
 */
async function loadAccounts() {
  const dbAccounts = await query<any>(
    `SELECT account_email, refresh_token FROM oauth_tokens ORDER BY account_email ASC`
  );
  return dbAccounts.map(acc => ({
    email: acc.account_email,
    refreshToken: decrypt(acc.refresh_token),
    clientId: config.google.oauthClientId,
    clientSecret: config.google.oauthClientSecret,
    redirectUri: config.google.oauthRedirectUri,
    calendarId: config.google.exportCalendarId,
  }));
}

/**
 * Gets Google Calendar API client for an account.
 */
function getCalendarClient(account: any) {
  const oauth2Client = new google.auth.OAuth2(
    account.clientId,
    account.clientSecret,
    account.redirectUri
  );
  oauth2Client.setCredentials({ refresh_token: account.refreshToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Syncs a single task to Google Calendar.
 */
async function syncTaskToCalendar(payload: any) {
  const accounts = await loadAccounts();
  if (accounts.length === 0) return;

  // Use first account for task export by default
  const account = accounts[0];
  const calendar = getCalendarClient(account);
  const calendarId = account.calendarId || 'primary';

  const start = new Date(payload.due_date);
  if (isNaN(start.getTime())) {
    logger.warn('calendar.sync.invalid_date', { taskId: payload.taskId });
    return;
  }
  const end = new Date(start.getTime() + 30 * 60000);

  // Check if task already has a gcal_event_id
  const taskRows = await query<any>('SELECT gcal_event_id FROM tasks WHERE id = $1', [payload.taskId]);
  const gcalEventId = taskRows[0]?.gcal_event_id;

  if (gcalEventId) {
    // Update existing event
    await calendar.events.patch({
      calendarId,
      eventId: gcalEventId,
      requestBody: {
        summary: payload.title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
  } else {
    // Insert new event
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: payload.title,
        description: `Task ID: ${payload.taskId}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: { useDefault: true },
      },
    });
    const newEventId = event.data.id;
    if (newEventId) {
      await query(`UPDATE tasks SET gcal_event_id = $1 WHERE id = $2`, [newEventId, payload.taskId]);
    }
  }
}

/**
 * Syncs a single meeting to Google Calendar.
 */
async function syncMeetingToCalendar(payload: any) {
  const accounts = await loadAccounts();
  if (accounts.length === 0) return;

  const start = new Date(payload.start_time);
  if (isNaN(start.getTime())) {
    logger.warn('calendar.sync.invalid_date', { meetingId: payload.meetingId });
    return;
  }

  const account = accounts[0];
  const calendar = getCalendarClient(account);
  const calendarId = account.calendarId || 'primary';
  const end = new Date(start.getTime() + 60 * 60000); // Meetings default to 1h

  const meetingRows = await query<any>('SELECT gcal_event_id FROM meetings WHERE id = $1', [payload.meetingId]);
  const gcalEventId = meetingRows[0]?.gcal_event_id;

  if (gcalEventId) {
    await calendar.events.patch({
      calendarId,
      eventId: gcalEventId,
      requestBody: {
        summary: payload.title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
  } else {
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: payload.title,
        description: `Meeting ID: ${payload.meetingId}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: { useDefault: true },
      },
    });
    const newEventId = event.data.id;
    if (newEventId) {
      await query(`UPDATE meetings SET gcal_event_id = $1 WHERE id = $2`, [newEventId, payload.meetingId]);
    }
  }
}

export function registerCalendarSyncListener(): void {
  agentEvents.on(TASK_MUTATED, async (payload) => {
    try {
      await syncTaskToCalendar(payload);
    } catch (e: any) {
      logger.error('calendar.sync.task_failed', { taskId: payload?.taskId, error: e.message });
    }
  });

  agentEvents.on(MEETING_MUTATED, async (payload) => {
    try {
      await syncMeetingToCalendar(payload);
    } catch (e: any) {
      logger.error('calendar.sync.meeting_failed', { meetingId: payload?.meetingId, error: e.message });
    }
  });
}
