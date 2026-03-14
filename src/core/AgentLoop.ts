import { ProviderFactory } from '../providers/ProviderFactory';
import { ToolRegistry } from './ToolRegistry';
import { config } from '../config/env';
import { ProfileRepository } from '../memory/repositories/ProfileRepository';

export class AgentLoop {
    private providerName: string;
    private registry: ToolRegistry;
    private maxIterations: number;
    private profileRepo: ProfileRepository;

    constructor(providerName: string, registry: ToolRegistry) {
        this.providerName = providerName;
        this.registry = registry;
        this.maxIterations = config.llm.maxIterations || 5;
        this.profileRepo = new ProfileRepository();
    }

    /**
     * Roda o Agent Loop (ReAct pattern).
     */
    public async run(
        systemPrompt: string, 
        history: Array<{role: string, content: string}>,
        userInput: string,
        options: any = {}
    ): Promise<string> {
        
        // Fetch User Profile and inject into system prompt
        const profile = this.profileRepo.getAll();
        if (profile.length > 0) {
            const profileText = profile.map(p => `- ${p.key}: ${p.value}`).join('\n');
            systemPrompt = `${systemPrompt}\n\n[MEMÓRIA DE PERFIL DO USUÁRIO]\n${profileText}\n[FIM DA MEMÓRIA]`;
        }

        const provider = ProviderFactory.getChain();
        // No need to call initialize() here — ProviderChain handles it per-provider lazily

        const messages = [...history];
        const lastUserMessage = { role: 'user', content: userInput } as any;

        // Se houver áudio nas opções, injeta na última mensagem do usuário (ou na atual)
        if (options.audioData) {
            lastUserMessage.audioData = options.audioData;
            lastUserMessage.mimeType = options.mimeType;
        }
        
        messages.push(lastUserMessage);
        const availableTools = this.registry.getAllTools().map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }));

        let iterations = 0;

        while (iterations < this.maxIterations) {
            iterations++;
            console.log(`[AgentLoop] Iteração ${iterations}/${this.maxIterations}`);

            try {
                const response = await provider.generateResponse(systemPrompt, messages, availableTools);

                // Thought -> Action -> Observation
                if (response.toolCalls && response.toolCalls.length > 0) {
                    for (const call of response.toolCalls) {
                        console.log(`[AgentLoop] Tool Call -> ${call.name}`);
                        
                        const tool = this.registry.getTool(call.name);
                        let observation = "";

                        if (!tool) {
                            observation = `Erro: Ferramenta '${call.name}' não existe no ToolRegistry local.`;
                        } else {
                            try {
                                observation = await tool.execute(call.arguments);
                            } catch (e: any) {
                                observation = `Falha ao executar ${call.name}: ${e.message}`;
                            }
                        }

                        // Append tool call intent and the observation back to the LLM
                        const stringifiedArgs = typeof call.arguments === 'string' 
                                                ? call.arguments 
                                                : JSON.stringify(call.arguments);
                                                
                        messages.push({ 
                            role: 'assistant', 
                            content: `Eu decidi usar a ferramenta ${call.name} com os argumentos: ${stringifiedArgs}` 
                        });
                        messages.push({ 
                            role: 'user', 
                            content: `Resultado da Ferramenta (Observation): ${observation}` 
                        });
                        console.log(`[AgentLoop] Observation -> ${observation.substring(0, 100)}...`);
                    }
                    // Loop volta pro início (Thought) com mensagens novas no buffer.
                    continue; 
                }

                // If no tool calls -> Answer phase reached
                return response.text;

            } catch (e: any) {
                console.error(`[AgentLoop] Loop crash, falling back.`, e);
                return `[Sistema] O pipeline do agente sofreu uma falha crítica na iteracão ${iterations}:\n\`\`\`\n${e.message}\n\`\`\``;
            }
        }

        return `[Sistema] Limite de iterações atingido (${this.maxIterations}). Operação abortada por segurança.`;
    }
}
