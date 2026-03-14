import { ILLMProvider, LLMResponse } from './ILLMProvider';
import { config } from '../config/env';

/**
 * OpenRouter provider - free tier supports Llama, Mistral, Gemma, etc.
 * No credit card required. Sign up at openrouter.ai
 */
export class OpenRouterProvider implements ILLMProvider {
  private apiKey: string;
  private model: string;
  private endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(model = 'google/gemma-3-27b-it:free') {
    this.apiKey = config.llm.openrouterKey;
    this.model = model;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('[OpenRouter] Initialization failed: OPENROUTER_API_KEY missing.');
    }
  }

  async generateResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<LLMResponse> {
    const formattedMessages: any[] = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    formattedMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

    const requestBody: any = {
      model: this.model,
      messages: formattedMessages,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      }));
      requestBody.tool_choice = 'auto';
    }

    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/AndClaw',
          'X-Title': 'AndClaw Agent'
        },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        let msg = `OpenRouter API Error: ${resp.status}`;
        try { msg += ` - ${JSON.parse(errBody).error?.message || errBody}`; } catch { msg += ` - ${errBody}`; }
        throw new Error(msg);
      }

      const data = await resp.json() as any;
      const message = data.choices?.[0]?.message;
      if (!message) return { text: 'Nenhuma resposta gerada pelo OpenRouter.' };

      const toolCalls = message.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}')
      }));

      return { 
        text: message.content || 'Nenhuma resposta gerada pelo OpenRouter.', 
        toolCalls 
      };

    } catch (e: any) {
      console.error('[OpenRouter] Fetch error:', e.message);
      throw e;
    }
  }
}
