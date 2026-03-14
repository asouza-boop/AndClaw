import { MemoryManager } from '../memory/MemoryManager';
import { SkillLoader } from '../skills/SkillLoader';
import { SkillRouter } from '../skills/SkillRouter';
import { SkillExecutor } from '../skills/SkillExecutor';
import { config } from '../config/env';

export class AgentController {
    private memoryManager: MemoryManager;
    private skillLoader: SkillLoader;
    private router: SkillRouter;
    private executor: SkillExecutor;

    constructor() {
        this.memoryManager = new MemoryManager();
        this.skillLoader = new SkillLoader();
        this.router = new SkillRouter();
        this.executor = new SkillExecutor();
    }

    /**
     * Ponto de entrada processando requisicoes do Telegram.
     */
    public async processInput(userId: string, input: string): Promise<string> {
        console.log(`\n[Controller] Novo input de ${userId}`);
        
        // 1. Carregar habilidades do Disco (.agents/skills)
        const availableSkills = this.skillLoader.fetchSkills();
        console.log(`[Controller] ${availableSkills.length} skills carregadas do sistema.`);

        // 2. Routing: Descobrir se Input precisa de alguma Skill "Passo Zero"
        const skill = await this.router.route(input, availableSkills);
        if (skill) {
            console.log(`[Controller] Intent resolvido para a Skill: ${skill.metadata.name}`);
        } else {
            console.log(`[Controller] Nenhuma skill detectada. Agente em modo casual.`);
        }

        // 3. Pegar Histórico da Conversa Ativa
        const providerName = config.llm.defaultProvider;
        const history = this.memoryManager.getHistory(userId, providerName);

        // 4. Salvar query atual
        const conversationId = this.memoryManager.getOrCreateActiveConversation(userId, providerName);
        this.memoryManager.addMessage(conversationId, 'user', input);

        // 5. Executar Agent Loop
        const result = await this.executor.execute(input, skill, history, providerName);

        // 6. Salvar e retornar output
        this.memoryManager.addMessage(conversationId, 'assistant', result);
        return result;
    }
}
