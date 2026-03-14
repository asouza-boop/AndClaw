import DatabaseConnection from '../Database';

export interface UserProfileEntry {
  key: string;
  value: string;
  updated_at?: string;
}

export class ProfileRepository {
  private db = DatabaseConnection.getInstance();

  public get(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM user_profile WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result ? result.value : null;
  }

  public getAll(): UserProfileEntry[] {
    const stmt = this.db.prepare('SELECT * FROM user_profile');
    return stmt.all() as UserProfileEntry[];
  }

  public set(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO user_profile (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  public delete(key: string): void {
    const stmt = this.db.prepare('DELETE FROM user_profile WHERE key = ?');
    stmt.run(key);
  }
}
