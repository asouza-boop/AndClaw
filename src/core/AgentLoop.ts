import { ProviderFactory } from '../providers/ProviderFactory';
import { ToolRegistry } from './ToolRegistry';
import { config } from '../config/env';

export class AgentLoop {
    private providerName: string;
    private registry: ToolRegistry;
    private maxIterations: number;

    constructor(providerName: string, registry: ToolRegistry) {
        this.providerName = providerName;
        this.registry = registry;
        this.maxIterations = config.llm.maxIterations || 5;
    }

    /**
     * Roda o Agent Loop (ReAct pattern).
     */
    public async run(
        systemPrompt: string, 
        history: Array<{role: string, content: string}>,
        userInput: string
    ): Promise<string> {
        
        const provider = ProviderFactory.getProvider(this.providerName);
        await provider.initialize();

        const messages = [...history, { role: 'user', content: userInput }];
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
                return `[Sistema] O pipeline do agente sofreu uma falha crítica na iteracão ${iterations}: ${e.message}`;
            }
        }

        return `[Sistema] Limite de iterações atingido (${this.maxIterations}). Operação abortada por segurança.`;
    }
}
