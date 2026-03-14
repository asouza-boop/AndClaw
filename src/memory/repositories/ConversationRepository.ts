import DatabaseConnection from '../Database';

export interface Conversation {
  id: string;
  user_id: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export class ConversationRepository {
  private db = DatabaseConnection.getInstance();

  public create(id: string, userId: string, provider: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO conversations (id, user_id, provider) VALUES (?, ?, ?)'
    );
    stmt.run(id, userId, provider);
  }

  public getById(id: string): Conversation | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(id) as Conversation | undefined;
  }

  public getActiveConversation(userId: string): Conversation | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
    );
    return stmt.get(userId) as Conversation | undefined;
  }

  public updateTimestamp(id: string): void {
    const stmt = this.db.prepare(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    stmt.run(id);
  }
}
