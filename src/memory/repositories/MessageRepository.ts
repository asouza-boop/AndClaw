import { config } from '@/config/env';
import { query } from '@/db/postgres';

export interface Message {
  id?: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  trace?: any;
  created_at?: string;
}

export class MessageRepository {
  public async create(conversationId: string, role: string, content: string, trace?: any): Promise<void> {
    if (config.db.url) {
      await query(
        'INSERT INTO messages (conversation_id, role, content, trace) VALUES ($1, $2, $3, $4)',
        [conversationId, role, content, trace ? JSON.stringify(trace) : '{}']
      );
      return;
    }
  }

  public async getByConversationId(conversationId: string, limit: number = 50): Promise<Message[]> {
    if (config.db.url) {
      const rows = await query<Message>(
        'SELECT id, conversation_id, role, content, trace, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2',
        [conversationId, limit]
      );
      return rows;
    }
    return [];
  }
}
