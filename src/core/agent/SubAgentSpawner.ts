import { AgentLoop } from '../AgentLoop';
import { ToolRegistry } from '../ToolRegistry';
import { SubTask } from './TaskDecomposer';

export interface SubAgentResult {
    taskId: number;
    description: string;
    output: string;
    success: boolean;
}

export class SubAgentSpawner {
    private registry: ToolRegistry;
    private providerName: string;

    constructor(providerName: string, registry: ToolRegistry) {
        this.providerName = providerName;
        this.registry = registry;
    }

    /**
     * Spawns isolated sub-agent instances for each sub-task, running them sequentially.
     * Each sub-agent gets a scoped system prompt and NO shared history (isolation).
     */
    public async spawnAll(subTasks: SubTask[]): Promise<SubAgentResult[]> {
        const results: SubAgentResult[] = [];

        for (const task of subTasks) {
            console.log(`[Observability] agent.subagent.spawned: Sub-agent #${task.id} - "${task.description.substring(0, 60)}"`);

            const scopedPrompt = this.buildScopedPrompt(task, results);

            const loop = new AgentLoop(this.providerName, this.registry);

            let output: string;
            let success = true;

            try {
                // Run with empty history — isolated execution context
                output = await loop.run(scopedPrompt, [], task.description);
            } catch (e: any) {
                output = `[Erro no Sub-Agente #${task.id}] ${e.message}`;
                success = false;
            }

            console.log(`[Observability] agent.subagent.completed: Sub-agent #${task.id} (success: ${success})`);

            results.push({
                taskId: task.id,
                description: task.description,
                output,
                success
            });
        }

        return results;
    }

    /**
     * Builds a scoped system prompt for a sub-agent.
     * Injects only the task context + summaries of previous sub-agent outputs (not full history).
     */
    private buildScopedPrompt(task: SubTask, previousResults: SubAgentResult[]): string {
        const userName = process.env.AGENT_USER_NAME || 'usuário';
        let prompt = `Você é um sub-agente do AndClaw executando uma tarefa específica para ${userName}.\n`;
        prompt += `Você tem acesso a ferramentas locais.\n\n`;
        prompt += `SUA TAREFA ESPECÍFICA: ${task.description}\n`;

        if (task.context) {
            prompt += `\nCONTEXTO RELEVANTE:\n${task.context}\n`;
        }

        // Pass forward summaries of previous results (not full output) for continuity
        if (previousResults.length > 0) {
            prompt += `\nRESULTADOS DE ETAPAS ANTERIORES:\n`;
            for (const prev of previousResults) {
                const summary = prev.output.substring(0, 300);
                prompt += `- Etapa ${prev.taskId}: ${prev.success ? 'OK' : 'FALHA'} - ${summary}\n`;
            }
        }

        prompt += `\nFoque EXCLUSIVAMENTE na sua tarefa. Seja direto e objetivo.`;
        return prompt;
    }
}
