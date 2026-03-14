import { ILLMProvider, LLMResponse } from './ILLMProvider';
import { config } from '../config/env';

export class GeminiProvider implements ILLMProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(model = 'gemini-2.0-flash', apiKey?: string) {
    this.apiKey = apiKey || config.llm.geminiKey;
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
    const contents = messages.map(msg => {
      const parts: any[] = [{ text: msg.content }];
      
      // Se houver áudio injetado na mensagem (formato customizado para este MVP)
      if ((msg as any).audioData) {
        parts.push({
          inline_data: {
            mime_type: (msg as any).mimeType || 'audio/ogg',
            data: (msg as any).audioData
          }
        });
      }

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: parts
      };
    });

    // Inject system instruction if present
    const requestBody: any = {
      contents,
      system_instruction: { parts: [{ text: systemPrompt }] },
    };

    // If tools exist, format them according to Google format...
    // Note: Tool mapping implementation is kept abstract for MVP setup
    if (tools && tools.length > 0) {
      requestBody.tools = [{
        function_declarations: tools.map(t => ({
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
         let errorMessage = `Google API Error: ${resp.status}`;
         try {
           const parsedErr = JSON.parse(errBody);
           errorMessage += ` - ${parsedErr.error?.message || errBody}`;
         } catch {
           errorMessage += ` - ${errBody}`;
         }
         throw new Error(errorMessage);
      }

      const data = await resp.json() as any;
      const candidate = data.candidates?.[0];
      if (!candidate) return { text: 'Nenhuma resposta viável gerada pelo modelo.' };

      const parts = candidate.content?.parts || [];
      const textPart = parts.find((p: any) => p.text)?.text || '';
      
      const functionCall = parts.find((p: any) => p.functionCall)?.functionCall;
      
      const toolCalls = functionCall ? [{ name: functionCall.name, arguments: functionCall.args }] : undefined;

      return { 
        text: textPart || 'Nenhuma resposta gerada pelo Gemini.', 
        toolCalls 
      };
      
    } catch (e: any) {
      console.error('[GeminiProvider] Fetch error:', e.message);
      throw e;
    }
  }
}
