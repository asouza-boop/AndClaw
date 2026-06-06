import { ILLMProvider, LLMResponse } from '@/providers/ILLMProvider';
import { logger } from '@/infra/logger';
import { LLMProviderManager } from './LLMProviderManager';

export interface ILLMClient {
  generate(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[],
    options?: any
  ): Promise<LLMResponse>;
}

/**
 * Standard LLM Client that wraps the provider logic.
 * This acts as the single gateway for all LLM interactions in AndClaw.
 */
export class LLMClient implements ILLMClient {
  private defaultProvider: ILLMProvider;

  constructor(provider: ILLMProvider) {
    this.defaultProvider = provider;
  }

  async generate(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[],
    options: any = {}
  ): Promise<LLMResponse> {
    const start = Date.now();
    try {
      // PHASE 2 & 3: Multi-LLM and Fallback
      if (options.featureFlags?.MULTI_LLM === true) {
        const { response, providerUsed } = await LLMProviderManager.executeWithFallback(
          systemPrompt,
          messages,
          tools,
          this.defaultProvider
        );
        
        logger.info('llm.client.generate.success', { 
            latency: Date.now() - start, 
            providerUsed,
            hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0)
        });

        return { ...response, providerUsed, latency: Date.now() - start };
      }

      // Default single provider behavior (Phase 1)
      const TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT: provider did not respond within ' + TIMEOUT_MS + 'ms')), TIMEOUT_MS)
      );

      const responsePromise = this.defaultProvider.generateResponse(systemPrompt, messages, tools);
      const response = await Promise.race([responsePromise, timeoutPromise]);
      const latency = Date.now() - start;
      const providerUsed = (this.defaultProvider as any).model || 'default';
      
      logger.info('llm.client.generate.success', { 
        latency, 
        providerUsed,
        answerLength: response.text.length,
        hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0)
      });
      
      return { ...response, providerUsed, latency };
    } catch (error: any) {
      const latency = Date.now() - start;
      logger.error('llm.client.generate.failed', { 
        latency, 
        error: error.message 
      });
      throw error;
    }
  }
}
