import { ProviderFactory } from '../../providers/ProviderFactory';
import { logger } from '@/infra/logger';

export interface SubTask {
    id: number;
    description: string;
    context: string;
}

export interface DecompositionResult {
    isComplex: boolean;
    subTasks: SubTask[];
}

export class TaskDecomposer {
    // Heuristic complexity indicators — avoids an LLM call for simple inputs
    private static readonly COMPLEXITY_INDICATORS = [
        /\be\s+(também|depois|em seguida)\b/i,
        /\bprimeiro\b.*\bdepois\b/i,
        /\b(analise|compare|cruze|integre)\b.*\b(e|com)\b/i,
        /\bpasso\s*\d/i,
        /\betapa\s*\d/i,
        /\bmúltiplos?\b/i,
        /\bvários?\b/i,
    ];

    /**
     * Determines if a task is complex based on heuristics.
     * If complex, calls the LLM to decompose it into sub-tasks.
     */
    public static async decompose(userInput: string): Promise<DecompositionResult> {
        const isLikelyComplex = this.COMPLEXITY_INDICATORS.some(p => p.test(userInput));

        if (!isLikelyComplex || userInput.length < 80) {
            return { isComplex: false, subTasks: [] };
        }

        logger.info('agent.decomposition.analyzing', { inputLength: userInput.length });

        try {
            const provider = ProviderFactory.getChain();

            const systemPrompt = `Você é um decompositor de tarefas. Analise o input do usuário e decida:
1. Se a tarefa é SIMPLES (uma ação direta), retorne: {"isComplex": false, "subTasks": []}
2. Se a tarefa é COMPLEXA (múltiplas ações distintas), decomponha em sub-tarefas sequenciais.

Responda ESTRITAMENTE em JSON com o formato:
{
  "isComplex": true,
  "subTasks": [
    {"id": 1, "description": "...", "context": "..."},
    {"id": 2, "description": "...", "context": "..."}
  ]
}

REGRAS:
- Máximo 4 sub-tarefas
- Cada sub-tarefa deve ser autocontida
- "context" deve conter apenas informações relevantes para aquela sub-tarefa`;

            const response = await provider.generateResponse(
                systemPrompt,
                [{ role: 'user', content: userInput }],
                []
            );

            const match = response.text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('NO_JSON_BLOCK');
            const parsed = JSON.parse(match[0]);
            if (!parsed || typeof parsed !== 'object') throw new Error('INVALID_SHAPE');

            if (parsed.isComplex && Array.isArray(parsed.subTasks) && parsed.subTasks.length > 0) {
                // Cap at 4 sub-tasks for safety
                const capped = parsed.subTasks.slice(0, 4).map((st: any, idx: number) => ({
                    id: idx + 1,
                    description: String(st.description || ''),
                    context: String(st.context || '')
                }));

                logger.info('agent.decomposition.result', { subTaskCount: capped.length });
                return { isComplex: true, subTasks: capped };
            }

            return { isComplex: false, subTasks: [] };
        } catch (e: any) {
            logger.warn('agent.decomposition.failed', { error: e.message });
            return { isComplex: false, subTasks: [] };
        }
    }
}
