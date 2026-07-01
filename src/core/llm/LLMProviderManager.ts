import { query } from '@/db/postgres';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { ProviderFactory } from '@/providers/ProviderFactory';
import { logger } from '@/infra/logger';

export interface ProviderRecord {
  id: string;
  name: string;
  api_key: string | null;
  base_url: string | null;
  model: string;
  priority: number;
  enabled: boolean;
}

export class LLMProviderManager {
  private static readonly MAX_FALLBACK_ATTEMPTS = 8;

  /**
   * Fetches all enabled providers from the database, ordered by priority.
   */
  static async listEnabledProviders(): Promise<ProviderRecord[]> {
    try {
      const rows = await query<ProviderRecord>(
        `SELECT * FROM llm_providers WHERE enabled = TRUE ORDER BY priority DESC, created_at ASC`
      );
      return rows;
    } catch (err: any) {
      logger.error('llm.provider_manager.list.failed', { error: err.message });
      return [];
    }
  }

  /**
   * Executes an LLM call with a single-retry fallback mechanism.
   */
  static async executeWithFallback(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[],
    defaultProvider: ILLMProvider
  ): Promise<{ response: any; providerUsed: string }> {
    const enabledProviders = await this.listEnabledProviders();
    const candidates = enabledProviders.length > 0
      ? enabledProviders.map((p) => ({
          provider: this.mapToProvider(p),
          providerName: p.name,
        }))
      : [{ provider: defaultProvider, providerName: (defaultProvider as any).name || (defaultProvider as any).model || 'default' }];

    let lastError: any = null;
    for (let i = 0; i < Math.min(candidates.length, LLMProviderManager.MAX_FALLBACK_ATTEMPTS); i++) {
        const candidate = candidates[i];
        try {
            const start = Date.now();
            const response = await candidate.provider.generateResponse(systemPrompt, messages, tools);
            const latency = Date.now() - start;

            logger.info('llm.fallback.success', { 
                attempt: i + 1, 
                provider: candidate.providerName,
                latency 
            });

            return { response, providerUsed: candidate.providerName };
        } catch (err: any) {
            lastError = err;
            logger.warn('llm.fallback.attempt.failed', { 
                attempt: i + 1, 
                error: err.message 
            });
        }
    }

    throw lastError || new Error('All providers failed in fallback loop');
  }

  /**
   * Maps a DB record to an ILLMProvider instance.
   */
  private static mapToProvider(record: ProviderRecord): ILLMProvider {
    return ProviderFactory.getProvider(record.name);
  }
}
