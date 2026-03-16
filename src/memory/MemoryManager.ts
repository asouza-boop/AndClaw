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

  public async initConversation(userId: string, provider: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.conversationRepo.create(id, userId, provider);
    return id;
  }

  public async getOrCreateActiveConversation(userId: string, provider: string): Promise<string> {
    const active = await this.conversationRepo.getActiveConversation(userId);
    if (active) {
      await this.conversationRepo.updateTimestamp(active.id);
      return active.id;
    }
    return this.initConversation(userId, provider);
  }

  public async addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): Promise<void> {
    await this.messageRepo.create(conversationId, role, content);
    await this.conversationRepo.updateTimestamp(conversationId);
  }

  public async getHistory(userId: string, provider: string, limit: number = 20): Promise<Array<{role: string, content: string}>> {
    const conversationId = await this.getOrCreateActiveConversation(userId, provider);
    const messages = await this.messageRepo.getByConversationId(conversationId, limit);
    return messages.map(m => ({ role: m.role, content: m.content }));
  }
}
