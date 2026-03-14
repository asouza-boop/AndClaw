import { ILLMProvider } from './ILLMProvider';
import { GeminiProvider } from './GeminiProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { ProviderChain } from './ProviderChain';
import { config } from '../config/env';
import { LocalOllamaProvider } from './LocalOllamaProvider';

export class ProviderFactory {
  /**
   * Returns a single named provider.
   */
  static getProvider(name: string): ILLMProvider {
    switch (name.toLowerCase()) {
      case 'gemini':
      case 'gemini-flash':
        return new GeminiProvider('gemini-2.0-flash', config.llm.geminiKey);
      case 'gemini-flash-key2':
        return new GeminiProvider('gemini-2.0-flash', config.llm.geminiKey2);
      case 'gemini-flash-key3':
        return new GeminiProvider('gemini-2.0-flash', config.llm.geminiKey3);
      case 'gemini-flash-lite':
        return new GeminiProvider('gemini-2.0-flash-lite', config.llm.geminiKey);
      case 'gemini-flash-lite-key2':
        return new GeminiProvider('gemini-2.0-flash-lite', config.llm.geminiKey2);
      case 'openrouter':
        return new OpenRouterProvider();
      case 'deepseek':
        return new DeepSeekProvider();
      case 'ollama':
      case 'local-ollama':
        return new LocalOllamaProvider(config.llm.ollamaModel);
      default:
        console.warn(`[Factory] Unknown provider '${name}'. Falling back to Gemini.`);
        return new GeminiProvider('gemini-2.0-flash', config.llm.geminiKey);
    }
  }

  /**
   * Returns a ProviderChain ordered by the LLM_PROVIDER_CHAIN env variable.
   * On quota errors, the chain automatically falls through to the next provider.
   */
  static getChain(): ProviderChain {
    const providers: ILLMProvider[] = config.llm.providerChain.map(name => {
      try {
        return ProviderFactory.getProvider(name);
      } catch {
        console.warn(`[Factory] Could not create provider '${name}', skipping.`);
        return null;
      }
    }).filter((p): p is ILLMProvider => p !== null);

    if (providers.length === 0) {
      console.error('[Factory] No providers in chain! Defaulting to Gemini Flash.');
      return new ProviderChain([new GeminiProvider('gemini-1.5-flash')]);
    }

    console.log(`[Factory] Provider chain: ${config.llm.providerChain.join(' → ')}`);
    return new ProviderChain(providers);
  }
}
