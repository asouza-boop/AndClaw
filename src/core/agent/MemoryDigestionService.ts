import { ILLMProvider } from '@/providers/ILLMProvider';
import { logger } from '@/infra/logger';

export class MemoryDigestionService {
    /**
     * Determines if a conversation turn is "memorable" enough to be distilled into long-term memory.
     * Uses lightweight heuristics to avoid unnecessary LLM calls.
     */
    static isMemorable(input: string, output: string): boolean {
        const text = (input + ' ' + output).toLowerCase();
        
        // 1. Personal Facts
        if (/(moro em|meu nome|gosto de|prefiro|minha preferência|sou|trabalho|idade|nasci)/i.test(text)) return true;
        
        // 2. Project/Entity Names
        if (/(projeto|empresa|cliente|produto|serviço|sistema)\s+["']?\w+["']?/i.test(text)) return true;
        
        // 3. Technical Solutions / Decisions
        if (/(decidimos|escolhi|vamos usar|solução|resolvido|consertado|fix)/i.test(text)) return true;

        // 4. Learning/Instructions
        if (/(sempre que|nunca|toda vez|lembre que|não esqueça)/i.test(text)) return true;

        // 5. Length check (Complex synthesis)
        if (input.length > 500 || output.length > 800) return true;

        return false;
    }

    /**
     * Uses the LLM to distill a conversation turn into a single, atomic, searchable fact.
     */
    static async digest(input: string, output: string, provider: ILLMProvider): Promise<string | null> {
        try {
            const systemPrompt = `Você é o Módulo de Memória do AndClaw OS.
Destile a interação fornecida em um ÚNICO fato atômico e permanente. 
Ignore saudações. Responda APENAS o fato, em uma frase curta e clara em Português (PT-BR).
Se não houver nada memorável, responda "NONE".`;

            const messages = [
              { role: 'user', content: `User: "${input}"\nAssistant: "${output}"` }
            ];

            const response = await provider.generateResponse(systemPrompt, messages, []);
            const fact = response.text.trim().replace(/^["']|["']$/g, '');

            if (fact.length < 5 || fact.toUpperCase() === 'NONE' || fact.toLowerCase().includes('nenhum fato')) {
                return null;
            }

            return fact;
        } catch (err: any) {
            logger.error('memory.digestion.failed', { error: err.message });
            return null;
        }
    }
}
