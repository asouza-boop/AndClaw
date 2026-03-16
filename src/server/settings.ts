import { query } from '../db/postgres';
import { ensureSchema } from '../db/schema';
import { config } from '../config/env';

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const rows = await query<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

export async function loadAuthFromDb(): Promise<void> {
  if (config.auth.password && config.auth.password.startsWith('scrypt$') && config.auth.tokenSecret) return;

  let passwordHash = await getSetting('auth_password_hash');
  const tokenSecret = await getSetting('auth_token_secret');

  if (config.auth.password && !config.auth.password.startsWith('scrypt$')) {
    const { hashPassword } = await import('./crypto');
    config.auth.password = hashPassword(config.auth.password);
  }

  if (passwordHash) {
    config.auth.password = passwordHash;
  }
  if (tokenSecret) {
    config.auth.tokenSecret = tokenSecret;
  }
}

export function applyAppSettingsToConfig(settings: Record<string, string>): void {
  config.llm.geminiKey = settings.GEMINI_API_KEY || config.llm.geminiKey;
  config.llm.openrouterKey = settings.OPENROUTER_API_KEY || config.llm.openrouterKey;
  config.llm.deepseekKey = settings.DEEPSEEK_API_KEY || config.llm.deepseekKey;
  config.llm.defaultProvider = settings.DEFAULT_LLM_PROVIDER || config.llm.defaultProvider;

  config.gitvault.repo = settings.GITVAULT_REPO || config.gitvault.repo;
  config.gitvault.token = settings.GITHUB_TOKEN || config.gitvault.token;
  config.gitvault.basePath = settings.GITVAULT_BASE_PATH || config.gitvault.basePath;

  config.google.oauthClientId = settings.GOOGLE_OAUTH_CLIENT_ID || config.google.oauthClientId;
  config.google.oauthClientSecret = settings.GOOGLE_OAUTH_CLIENT_SECRET || config.google.oauthClientSecret;
  config.google.oauthRedirectUri = settings.GOOGLE_OAUTH_REDIRECT_URI || config.google.oauthRedirectUri;
  config.google.exportCalendarId = settings.GOOGLE_EXPORT_CALENDAR_ID || config.google.exportCalendarId;

  config.push.vapidPublicKey = settings.VAPID_PUBLIC_KEY || config.push.vapidPublicKey;
  config.push.vapidPrivateKey = settings.VAPID_PRIVATE_KEY || config.push.vapidPrivateKey;
  config.push.contactEmail = settings.VAPID_CONTACT_EMAIL || config.push.contactEmail;

  config.raindrop.token = settings.RAINDROP_TOKEN || config.raindrop.token;
  config.raindrop.collectionId = settings.RAINDROP_COLLECTION_ID || config.raindrop.collectionId;
}

export async function loadAppSettings(): Promise<Record<string, string>> {
  await ensureSchema();
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}
