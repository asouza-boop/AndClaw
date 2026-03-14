import DatabaseConnection from '../Database';

export interface Message {
  id?: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export class MessageRepository {
  private db = DatabaseConnection.getInstance();

  public create(conversationId: string, role: string, content: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    );
    stmt.run(conversationId, role, content);
  }

  public getByConversationId(conversationId: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?'
    );
    return stmt.all(conversationId, limit) as Message[];
  }
}
