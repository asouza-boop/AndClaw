import { Pool } from 'pg';
import { config } from '../config/env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!config.db.url) {
      throw new Error('DATABASE_URL is not configured.');
    }
    pool = new Pool({ connectionString: config.db.url });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
