import { Skill } from './SkillLoader';
import { AgentLoop } from '@/core/AgentLoop';
import { ToolRegistry } from '@/core/ToolRegistry';

export class SkillExecutor {
    private registry: ToolRegistry;

    constructor() {
        this.registry = new ToolRegistry(); // Instanciado uma única vez
    }

    public buildSkillPrompt(skill: Skill | null, userName: string, basePrompt?: string): string {
        let prompt = basePrompt?.trim() || `Você é o AndClaw, um agente assistente inteligente projetado para ${userName}. Você tem acesso a ferramentas locais.`;

        if (skill) {
            prompt += `\n\n[HABILIDADE ATIVA] ${skill.metadata.name}\n${skill.content.trim()}`;
        } else {
            prompt += "\n\nComporte-se como um assistente casual prestativo. Nenhuma habilidade específica ativa no momento.";
        }

        return prompt;
    }

    /**
     * Executes the main loop, injecting the Skill's context if a skill was identified.
     */
    public async execute(
        input: string, 
        skill: Skill | null, 
        conversationHistory: Array<{role: string, content: string}>,
        providerName: string,
        options: any = {}
    ): Promise<string> {
        const userName = process.env.AGENT_USER_NAME || 'usuário';
        const basePrompt = this.buildSkillPrompt(skill, userName);

        const loop = new AgentLoop(providerName, this.registry);
        const finalAnswer = await loop.run(basePrompt, conversationHistory, input, options);
        
        return finalAnswer;
    }
}
