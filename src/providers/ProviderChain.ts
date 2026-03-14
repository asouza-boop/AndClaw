import { ILLMProvider, LLMResponse } from './ILLMProvider';

/**
 * ProviderChain - wraps multiple providers and automatically retries on quota errors (429).
 * Implements ILLMProvider so it can be a drop-in replacement anywhere a provider is used.
 */
export class ProviderChain implements ILLMProvider {
  private providers: ILLMProvider[];

  constructor(providers: ILLMProvider[]) {
    this.providers = providers;
  }

  async initialize(): Promise<void> {
    // Initialization happens lazily per provider when it's tried
  }

  async generateResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const providerName = provider.constructor.name;

      try {
        await provider.initialize();
        let response = await provider.generateResponse(systemPrompt, messages, tools);
        
        // Se falhou o primeiro (provavelmente Gemini) e estamos num fallback,
        // mas o input tinha áudio, avisamos o usuário que a transcrição falhou.
        const hasAudio = messages.some(m => (m as any).audioData);
        if (i > 0 && hasAudio && !providerName.includes('Gemini')) {
          response.text = `⚠️ [Aviso de Sistema] Não foi possível transcrever seu áudio (Cota Gemini esgotada). Responding apenas ao contexto de texto:\n\n${response.text}`;
        }

        if (i > 0) {
          console.log(`[ProviderChain] ✅ Succeeded with fallback provider #${i + 1}: ${providerName}`);
        }
        return response;

      } catch (e: any) {
        lastError = e;
        const msg = e.message || '';
        
        const isQuotaError = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED');
        const isAuthError = msg.includes('401') || msg.includes('API_KEY') || msg.includes('missing');
        const isBalanceError = msg.includes('402') || msg.includes('Insufficient Balance') || msg.includes('insufficient_balance');
        const isPolicyError = msg.includes('guardrail') || msg.includes('data policy') || msg.includes('No endpoints');
        const isProviderError = msg.includes('400') || msg.includes('Provider returned error');

        if (isQuotaError) {
          console.warn(`[ProviderChain] ⚠️ Provider #${i + 1} (${providerName}) hit quota limit. Trying next...`);
          continue;
        }

        if (isAuthError) {
          console.warn(`[ProviderChain] ⚠️ Provider #${i + 1} (${providerName}) not configured (missing/invalid key). Skipping...`);
          continue;
        }

        if (isBalanceError) {
          console.warn(`[ProviderChain] ⚠️ Provider #${i + 1} (${providerName}) has no balance/credits. Skipping...`);
          continue;
        }

        if (isPolicyError || isProviderError) {
          console.warn(`[ProviderChain] ⚠️ Provider #${i + 1} (${providerName}) error (400/Policy). Skipping...`);
          continue;
        }

        // Other errors - log and try next 
        console.error(`[ProviderChain] ❌ Provider #${i + 1} (${providerName}) failed:`, msg);
        continue;
      }
    }

    throw new Error(`[ProviderChain] All providers exhausted. Last error: ${lastError?.message}`);
  }
}
