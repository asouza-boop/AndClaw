import { AgentLoop } from '@/core/AgentLoop';
import { ToolRegistry } from '@/core/ToolRegistry';
import { MemoryManager } from '@/memory/MemoryManager';
import { SkillLoader } from '@/skills/SkillLoader';
import { config } from '@/config/env';

import { SuggestionService } from '@/core/agent/SuggestionService';

export class AgentController {
    private memoryManager: MemoryManager;
    private skillLoader: SkillLoader;
    private registry: ToolRegistry;

    constructor() {
        this.memoryManager = new MemoryManager();
        this.skillLoader = new SkillLoader();
        this.registry = new ToolRegistry();
    }

    /**
     * Ponto de entrada processando requisicoes do Telegram ou PWA.
     */
    public async processInput(userId: string, input: string, options: any = {}): Promise<any> {
        try {
            console.log(`\n[Controller] Novo input de ${userId}`);
            
            // 1. Carregar habilidades do Disco (.agents/skills)
            const availableSkills = this.skillLoader.fetchSkills();
            console.log(`[Controller] ${availableSkills.length} skills carregadas do sistema.`);

            // 2. Pegar Histórico da Conversa Ativa
            const providerName = config.llm.defaultProvider;
            const history = await this.memoryManager.getHistory(userId, providerName);

            // 3. Salvar query atual
            const conversationId = await this.memoryManager.getOrCreateActiveConversation(userId, providerName);
            await this.memoryManager.addMessage(conversationId, 'user', input);

            // 4. Executar Agent Loop unificado
            const loop = new AgentLoop(providerName, this.registry);
            const result = await loop.run(
              options.systemPrompt || `Você é o AndClaw, um agente assistente inteligente projetado para ${process.env.AGENT_USER_NAME || 'usuário'}. Você tem acesso a ferramentas locais.`,
              history,
              input,
              { ...options, userId }
            );

            // 5. Salvar mensagem do assistente
            await this.memoryManager.addMessage(conversationId, 'assistant', result);

            // 6. Proactive Intelligence
            const suggestions = SuggestionService.detect(result);
            const memorable = MemoryDigestionService.isMemorable(input, result);

            if (options.includeSuggestions) {
                return { reply: result, suggestions, memorable };
            }
            return result;
        } catch (e: any) {
            console.error(`[Controller] Falha crítica no pipeline:`, e);
            return `[Erro Crítico] Ocorreu uma falha ao processar sua solicitação: ${e.message}. Por favor, tente novamente em instantes.`;
        }
    }

    /**
     * Limpa o histórico da conversa ativa do usuário criando uma nova conversa.
     */
    public async clearHistory(userId: string): Promise<void> {
        const providerName = config.llm.defaultProvider;
        await this.memoryManager.initConversation(userId, providerName);
        console.log(`[Controller] Histórico limpo para usuário ${userId}`);
    }

    /**
     * Retorna as skills atualmente carregadas (para exibição via /skills).
     */
    public getLoadedSkills() {
        return this.skillLoader.fetchSkills();
    }
}
