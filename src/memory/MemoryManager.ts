import crypto from 'crypto';
import { ConversationRepository } from '@/memory/repositories/ConversationRepository';
import { MessageRepository, Message } from '@/memory/repositories/MessageRepository';
import { EmbeddingService } from '@/core/memory/EmbeddingService';
import { MemoryService, SemanticMemoryRecord } from '@/core/memory/MemoryService';
import { logger } from '@/infra/logger';

export class MemoryManager {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private embeddingService: EmbeddingService;
  private memoryService: MemoryService;

  constructor(
    embeddingService = new EmbeddingService(),
    memoryService = new MemoryService(embeddingService)
  ) {
    this.conversationRepo = new ConversationRepository();
    this.messageRepo = new MessageRepository();
    this.embeddingService = embeddingService;
    this.memoryService = memoryService;
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

  public async addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, trace?: any): Promise<void> {
    await this.messageRepo.create(conversationId, role, content, trace);
    await this.conversationRepo.updateTimestamp(conversationId);
  }

  public async getHistory(userId: string, provider: string, limit?: number): Promise<Array<{role: string, content: string}>> {
    const resolvedLimit = limit ?? parseInt(process.env.MEMORY_WINDOW_SIZE || '20', 10);
    const conversationId = await this.getOrCreateActiveConversation(userId, provider);
    const messages = await this.messageRepo.getByConversationId(conversationId, resolvedLimit);
    return messages.map(m => ({ role: m.role, content: m.content }));
  }

  public async buildSemanticContext(input: string, limit = 5): Promise<string> {
    const memories = await this.memoryService.searchByText(input, limit);
    if (!memories.length) return '';

    return [
      '[MEMÓRIA SEMÂNTICA]',
      ...memories.map((memory, index) => {
        const header = `${index + 1}. ${memory.type}${memory.source_type ? ` (${memory.source_type})` : ''}`;
        const content = memory.content.length > 700
          ? `${memory.content.slice(0, 700).trim()}...`
          : memory.content;
        return `${header}\n${content}`;
      }),
      '[FIM DA MEMÓRIA SEMÂNTICA]',
    ].join('\n');
  }

  public async persistTurn(
    userId: string,
    provider: string,
    userInput: string,
    assistantOutput: string,
    metadata: Record<string, any> = {},
    trace?: any,
  ): Promise<void> {
    const conversationId = await this.getOrCreateActiveConversation(userId, provider);
    await this.addMessage(conversationId, 'user', userInput);
    await this.addMessage(conversationId, 'assistant', assistantOutput, trace);

    try {
      const inputEmbedding = await this.embeddingService.generateEmbedding(userInput);
      const outputEmbedding = await this.embeddingService.generateEmbedding(assistantOutput);

      await this.memoryService.save(userInput, inputEmbedding, {
        type: metadata.type || 'conversation_turn',
        source_type: 'chat',
        source_id: conversationId,
        role: 'user',
        user_id: userId,
        provider,
        ...metadata,
      });

      await this.memoryService.save(assistantOutput, outputEmbedding, {
        type: metadata.type || 'conversation_turn',
        source_type: 'chat',
        source_id: conversationId,
        role: 'assistant',
        user_id: userId,
        provider,
        ...metadata,
      });
    } catch (embErr: any) {
      logger.warn('memory.persist_turn.embedding_skipped', {
        userId, reason: embErr.message
      });
      // Conversation messages are already saved above — embedding failure is non-fatal
    }
  }

  public async addSemanticMemory(
    content: string,
    metadata: Record<string, any> = {},
    preGeneratedEmbedding?: number[]
  ): Promise<SemanticMemoryRecord | null> {
    const embedding = preGeneratedEmbedding || await this.embeddingService.generateEmbedding(content);
    return this.memoryService.save(content, embedding, metadata);
  }
}
