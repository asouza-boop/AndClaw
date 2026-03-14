import crypto from 'crypto';
import { ConversationRepository } from './repositories/ConversationRepository';
import { MessageRepository, Message } from './repositories/MessageRepository';

export class MemoryManager {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;

  constructor() {
    this.conversationRepo = new ConversationRepository();
    this.messageRepo = new MessageRepository();
  }

  public initConversation(userId: string, provider: string): string {
    const id = crypto.randomUUID();
    this.conversationRepo.create(id, userId, provider);
    return id;
  }

  public getOrCreateActiveConversation(userId: string, provider: string): string {
    const active = this.conversationRepo.getActiveConversation(userId);
    if (active) {
      this.conversationRepo.updateTimestamp(active.id);
      return active.id;
    }
    return this.initConversation(userId, provider);
  }

  public addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): void {
    this.messageRepo.create(conversationId, role, content);
    this.conversationRepo.updateTimestamp(conversationId);
  }

  public getHistory(userId: string, provider: string, limit: number = 20): Array<{role: string, content: string}> {
    const conversationId = this.getOrCreateActiveConversation(userId, provider);
    const messages = this.messageRepo.getByConversationId(conversationId, limit);
    return messages.map(m => ({ role: m.role, content: m.content }));
  }
}
