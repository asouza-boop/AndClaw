import { ILLMProvider, LLMResponse } from './ILLMProvider';
import { config } from '../config/env';

export class GeminiProvider implements ILLMProvider {
  private apiKey: string;
  private endpoint: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor() {
    this.apiKey = config.llm.geminiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('[GeminiProvider] Initialization failed: GEMINI_API_KEY missing.');
    }
  }

  async generateResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    tools: any[]
  ): Promise<LLMResponse> {
    const url = `${this.endpoint}?key=${this.apiKey}`;
    
    // Simplistic formatting from role-playing array to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user', // System handled outside
      parts: [{ text: msg.content }]
    }));

    // Inject system instruction if present
    const requestBody: any = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    // If tools exist, format them according to Google format...
    // Note: Tool mapping implementation is kept abstract for MVP setup
    if (tools && tools.length > 0) {
      requestBody.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }];
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
         const errBody = await resp.text();
         throw new Error(`Google API Error: ${resp.status} - ${errBody}`);
      }

      const data = await resp.json() as any;
      const candidate = data.candidates?.[0];
      if (!candidate) return { text: 'Nenhuma resposta viável gerada pelo modelo.' };

      const parts = candidate.content?.parts || [];
      const textPart = parts.find((p: any) => p.text)?.text || '';
      
      const functionCall = parts.find((p: any) => p.functionCall)?.functionCall;
      
      const toolCalls = functionCall ? [{ name: functionCall.name, arguments: functionCall.args }] : undefined;

      return {
        text: textPart,
        toolCalls
      };
      
    } catch (e: any) {
      console.error('[GeminiProvider] Fetch error:', e.message);
      throw e;
    }
  }
}
