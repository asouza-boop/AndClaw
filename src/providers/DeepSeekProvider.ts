import { ILLMProvider, LLMResponse } from './ILLMProvider';
import { config } from '../config/env';

export class DeepSeekProvider implements ILLMProvider {
  private apiKey: string;
  private endpoint: string = 'https://api.deepseek.com/chat/completions'; // Placeholder endpoint

  constructor() {
    this.apiKey = config.llm.deepseekKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('[DeepSeek] Initialization failed: DEEPSEEK_API_KEY missing.');
    }
  }

  async generateResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<LLMResponse> {
    const url = this.endpoint;
    
    const formattedMessages = [];
    if (systemPrompt) {
        formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    formattedMessages.push(...messages);

    const requestBody: any = {
      model: "deepseek-chat",
      messages: formattedMessages
    };

    if (tools && tools.length > 0) {
        // OpenAI compatible tools format mapping
        requestBody.tools = tools.map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
        requestBody.tool_choice = "auto";
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
         const errBody = await resp.text();
         throw new Error(`DeepSeek API Error: ${resp.status} - ${errBody}`);
      }

      const data = await resp.json() as any;
      const message = data.choices?.[0]?.message;
      if (!message) return { text: 'Nenhuma resposta gerada.' };

      const toolCalls = message.tool_calls?.map((tc: any) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
      }));

      return {
        text: message.content || '',
        toolCalls
      };
      
    } catch (e: any) {
      console.error('[DeepSeekProvider] Fetch error:', e.message);
      throw e;
    }
  }
}
