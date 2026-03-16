import { config } from '../config/env';

export function hasLLMConfig(): boolean {
  return Boolean(
    config.llm.geminiKey ||
    config.llm.openrouterKey ||
    config.llm.deepseekKey
  );
}

export function offlineFallbackMessage(): string {
  return '[Sistema] LLM nao configurada. Configure uma chave em Configuracoes para habilitar o agente.';
}
