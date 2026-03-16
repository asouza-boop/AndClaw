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

function getOAuthClient() {
  if (!config.google.oauthClientId || !config.google.oauthClientSecret || !config.google.oauthRedirectUri) {
    throw new Error('Google OAuth client is not configured.');
  }
  return new google.auth.OAuth2(
    config.google.oauthClientId,
    config.google.oauthClientSecret,
    config.google.oauthRedirectUri
  );
}

async function loadAccounts(): Promise<GoogleAccountConfig[]> {
  await ensureSchema();

  const dbAccounts = await query<any>(
    `SELECT account_email, refresh_token FROM oauth_tokens ORDER BY account_email ASC`
  );

  if (dbAccounts.length > 0) {
    return dbAccounts.map(acc => ({
      email: acc.account_email,
      refreshToken: acc.refresh_token,
      clientId: config.google.oauthClientId,
      clientSecret: config.google.oauthClientSecret,
      redirectUri: config.google.oauthRedirectUri,
      calendarId: config.google.exportCalendarId,
    }));
  }

  try {
    const raw = JSON.parse(config.google.accountsJson || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((acc: any) => ({
      ...acc,
      clientId: acc.clientId || config.google.oauthClientId,
      clientSecret: acc.clientSecret || config.google.oauthClientSecret,
      redirectUri: acc.redirectUri || config.google.oauthRedirectUri,
      calendarId: acc.calendarId || config.google.exportCalendarId,
    }));
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

export async function listConnectedAccounts(): Promise<string[]> {
  await ensureSchema();
  const rows = await query<any>('SELECT account_email FROM oauth_tokens ORDER BY account_email ASC');
  return rows.map(r => r.account_email);
}

export async function getGoogleAuthUrl(): Promise<string> {
  const oauth2Client = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

export async function handleGoogleOAuthCallback(code: string): Promise<void> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned. Ensure prompt=consent.');
  }
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const info = await oauth2.userinfo.get();
  const email = info.data.email || 'unknown@example.com';

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

  await ensureSchema();
  await query(
    `INSERT INTO oauth_tokens (account_email, refresh_token, access_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_email) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       access_token = EXCLUDED.access_token,
       expires_at = EXCLUDED.expires_at`,
    [email, tokens.refresh_token, tokens.access_token || null, expiresAt]
  );
}

export async function importGoogleEvents(): Promise<void> {
  await ensureSchema();
  const accounts = await loadAccounts();
  if (accounts.length === 0) return;

  const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString();

  for (const account of accounts) {
    const calendar = getClient(account);
    const calendars = await calendar.calendarList.list();
    const list = calendars.data.items || [];

    for (const cal of list) {
      const calendarId = cal.id || 'primary';
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
}

export async function exportTasksToGoogle(): Promise<void> {
  await ensureSchema();
  const accounts = await loadAccounts();
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
