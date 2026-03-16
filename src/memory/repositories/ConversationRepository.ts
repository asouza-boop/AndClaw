import DatabaseConnection from '../Database';
import { config } from '../../config/env';
import { query } from '../../db/postgres';

export interface Conversation {
  id: string;
  user_id: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export class ConversationRepository {
  private db = DatabaseConnection.getInstance();

  public async create(id: string, userId: string, provider: string): Promise<void> {
    if (config.db.url) {
      await query(
        'INSERT INTO conversations (id, user_id, provider) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [id, userId, provider]
      );
      return;
    }

    const stmt = this.db.prepare('INSERT INTO conversations (id, user_id, provider) VALUES (?, ?, ?)');
    stmt.run(id, userId, provider);
  }

  public async getById(id: string): Promise<Conversation | undefined> {
    if (config.db.url) {
      const rows = await query<Conversation>('SELECT * FROM conversations WHERE id = $1', [id]);
      return rows[0];
    }

    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(id) as Conversation | undefined;
  }

  public async getActiveConversation(userId: string): Promise<Conversation | undefined> {
    if (config.db.url) {
      const rows = await query<Conversation>(
        'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [userId]
      );
      return rows[0];
    }

    const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
    return stmt.get(userId) as Conversation | undefined;
  }

  public async updateTimestamp(id: string): Promise<void> {
    if (config.db.url) {
      await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);
      return;
    }

    const stmt = this.db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  }
}
