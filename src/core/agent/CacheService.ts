import { SemanticCacheRecord, SemanticCacheService } from '@/core/cache/SemanticCacheService';
import type { SemanticCacheContext } from '@/core/cache/SemanticCacheService';

export class CacheService {
  constructor(private readonly semanticCacheService = new SemanticCacheService()) {}

  public get(embedding: number[], context: SemanticCacheContext = {}): Promise<SemanticCacheRecord | null> {
    return this.semanticCacheService.get(embedding, context);
  }

  public set(
    input: string,
    embedding: number[],
    output: string,
    context: SemanticCacheContext = {},
  ): Promise<SemanticCacheRecord | null> {
    return this.semanticCacheService.set(input, embedding, output, context);
  }
}
