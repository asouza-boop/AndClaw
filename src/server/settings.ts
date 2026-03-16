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
