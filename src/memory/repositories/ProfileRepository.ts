import { config } from '../../config/env';
import { query } from '../../db/postgres';

export interface UserProfileEntry {
  key: string;
  value: string;
  updated_at?: string;
}

export class ProfileRepository {
  public async get(key: string): Promise<string | null> {
    if (config.db.url) {
      const rows = await query<{ value: string }>('SELECT value FROM user_profile WHERE key = $1', [key]);
      return rows[0]?.value ?? null;
    }

    return null;
  }

  public async getAll(): Promise<UserProfileEntry[]> {
    if (config.db.url) {
      const rows = await query<UserProfileEntry>('SELECT * FROM user_profile ORDER BY updated_at DESC');
      return rows;
    }

    return [];
  }

  public async set(key: string, value: string): Promise<void> {
    if (config.db.url) {
      await query(
        `INSERT INTO user_profile (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
      return;
    }
  }

  public async delete(key: string): Promise<void> {
    if (config.db.url) {
      await query('DELETE FROM user_profile WHERE key = $1', [key]);
      return;
    }
  }
}
