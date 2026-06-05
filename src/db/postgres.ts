import { Pool } from 'pg';
import { config } from '@/config/env';

export let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!config.db.url) {
      throw new Error('DATABASE_URL is not configured.');
    }
    // Remove sslmode params from connection string to avoid Render/Node warnings
    // since we are explicitly passing ssl: { rejectUnauthorized: false }
    const parsedUrl = new URL(config.db.url);
    parsedUrl.searchParams.delete('sslmode');
    const connectionString = parsedUrl.toString();
    
    pool = new Pool({ 
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: process.env.POOL_MAX_CONNECTIONS ? parseInt(process.env.POOL_MAX_CONNECTIONS, 10) : 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
