import { ILLMProvider } from './ILLMProvider';
import { GeminiProvider } from './GeminiProvider';
import { DeepSeekProvider } from './DeepSeekProvider';

export class ProviderFactory {
  static getProvider(name: string): ILLMProvider {
    switch (name.toLowerCase()) {
      case 'gemini':
        return new GeminiProvider();
      case 'deepseek':
        return new DeepSeekProvider();
      default:
        console.warn(`[Factory] Unknown provider '${name}'. Falling back to Gemini.`);
        return new GeminiProvider();
    }
  }
}
