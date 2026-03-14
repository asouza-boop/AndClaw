import { ILLMProvider, LLMResponse } from './ILLMProvider';

export class LocalOllamaProvider implements ILLMProvider {
  private model: string;
  private endpoint: string;

  constructor(model = 'llama3.2') {
    this.model = model;
    this.endpoint = 'http://localhost:11434/api/chat';
  }

  async initialize(): Promise<void> {
    try {
      const resp = await fetch('http://localhost:11434/api/tags');
      if (!resp.ok) throw new Error();
      console.log(`[Ollama] Conectado com sucesso ao servidor local.`);
    } catch (e) {
      console.warn(`[Ollama] Servidor local não detectado em localhost:11434. Verifique se o Ollama está rodando.`);
      // We don't throw here to allow the chain to continue if it's just one provider failing
    }
  }

  async generateResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<LLMResponse> {
    
    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: 0.7
          }
        })
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Ollama Error: ${resp.status} - ${err}`);
      }

      const data = await resp.json() as any;
      const content = data.message?.content || '';

      return {
        text: content || 'Nenhuma resposta gerada pelo Ollama local.',
      };

    } catch (e: any) {
      console.error('[Ollama] Erro ao gerar resposta:', e.message);
      throw e;
    }
  }
}
