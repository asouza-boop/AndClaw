import { ILLMProvider } from '@/providers/ILLMProvider';
import { logger } from '@/infra/logger';
import { MemoryDigestionService } from '@/core/agent/MemoryDigestionService';
import { agentEvents, MEMORY_DIGESTED } from '../events/AgentEvents';

import { EmbeddingService } from '@/core/memory/EmbeddingService';

export type DigestServiceDeps = {
  isMemorable?: typeof MemoryDigestionService.isMemorable;
  digest?: typeof MemoryDigestionService.digest;
  addSemanticMemory?: (fact: string, metadata: Record<string, any>, embedding?: number[]) => Promise<any>;
  logger?: Pick<typeof logger, 'info' | 'error'>;
  embeddingService?: EmbeddingService;
};

export type DigestServiceContext = {
  requestId?: string;
  userId: string;
};

export class DigestService {
  constructor(private readonly deps: DigestServiceDeps = {}) {}

  public async process(input: string, output: string, provider: ILLMProvider, context: DigestServiceContext): Promise<void> {
    const isMemorable = this.deps.isMemorable || MemoryDigestionService.isMemorable;
    const digest = this.deps.digest || MemoryDigestionService.digest;
    const addSemanticMemory = this.deps.addSemanticMemory;
    const telemetry = this.deps.logger || logger;
    const embeddingService = this.deps.embeddingService;

    if (!isMemorable(input, output)) return;

    digest(input, output, provider).then(async (fact: string | null) => {
      if (fact && addSemanticMemory) {
        let embedding: number[] | undefined;
        if (embeddingService) {
          try {
            embedding = await embeddingService.generateEmbedding(fact);
          } catch (e: any) {
            telemetry.error('memory.digestion.embedding.failed', { requestId: context.requestId, error: e.message });
            return;
          }
        }

        addSemanticMemory(fact, {
          type: 'digested_fact',
          source_type: 'chat',
          source_id: context.requestId || 'chat',
          userId: context.userId,
        }, embedding).then(() => {
          telemetry.info('memory.digestion.completed', { requestId: context.requestId, factLength: fact.length });
          agentEvents.emit(MEMORY_DIGESTED, { timestamp: new Date().toISOString() });
        });
      }
    }).catch((err: Error) => {
      telemetry.error('memory.digestion.async.failed', { requestId: context.requestId, error: err.message });
    });
  }
}
