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
   * Gets the primary provider (highest priority).
   * Fallback to the default system provider if none found in DB.
   */
  static async getPrimaryProvider(): Promise<ILLMProvider | null> {
    const providers = await this.listEnabledProviders();
    if (providers.length > 0) {
      const p = providers[0];
      return this.mapToProvider(p);
    }
    return null;
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
      ? enabledProviders.map(p => this.mapToProvider(p))
      : [defaultProvider];

    let lastError: any = null;
    const maxRetries = 1; // Try primary + 1 fallback

    for (let i = 0; i <= maxRetries && i < candidates.length; i++) {
        const provider = candidates[i];
        try {
            const start = Date.now();
            const response = await provider.generateResponse(systemPrompt, messages, tools);
            const latency = Date.now() - start;
            
            const providerName = (provider as any).model || 'unknown';
            logger.info('llm.fallback.success', { 
                attempt: i + 1, 
                provider: providerName,
                latency 
            });

            return { response, providerUsed: providerName };
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
    // We leverage the existing ProviderFactory logic but override config as needed
    // This assumes names in DB match factory cases (gemini, deepseek, etc.)
    return ProviderFactory.getProvider(record.id || record.name);
  }
}
