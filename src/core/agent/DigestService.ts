import { ILLMProvider } from '@/providers/ILLMProvider';
import { logger } from '@/infra/logger';
import { MemoryDigestionService } from '@/core/agent/MemoryDigestionService';

export type DigestServiceDeps = {
  isMemorable?: typeof MemoryDigestionService.isMemorable;
  digest?: typeof MemoryDigestionService.digest;
  addSemanticMemory?: (fact: string, metadata: Record<string, any>) => Promise<any>;
  logger?: Pick<typeof logger, 'info' | 'error'>;
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

    if (!isMemorable(input, output)) return;

    digest(input, output, provider).then((fact: string | null) => {
      if (fact && addSemanticMemory) {
        addSemanticMemory(fact, {
          type: 'digested_fact',
          source_type: 'chat',
          source_id: context.requestId || 'chat',
          userId: context.userId,
        }).then(() => {
          telemetry.info('memory.digestion.completed', { requestId: context.requestId, factLength: fact.length });
        });
      }
    }).catch((err: Error) => {
      telemetry.error('memory.digestion.async.failed', { requestId: context.requestId, error: err.message });
    });
  }
}
