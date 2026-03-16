import DatabaseConnection from '../Database';
import { config } from '../../config/env';
import { query } from '../../db/postgres';

export interface Message {
  id?: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export class MessageRepository {
  private db = DatabaseConnection.getInstance();

  public async create(conversationId: string, role: string, content: string): Promise<void> {
    if (config.db.url) {
      await query(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [conversationId, role, content]
      );
      return;
    }

    const stmt = this.db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)');
    stmt.run(conversationId, role, content);
  }

  public async getByConversationId(conversationId: string, limit: number = 50): Promise<Message[]> {
    if (config.db.url) {
      const rows = await query<Message>(
        'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2',
        [conversationId, limit]
      );
      return rows;
    }

    const stmt = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?');
    return stmt.all(conversationId, limit) as Message[];
  }
}
