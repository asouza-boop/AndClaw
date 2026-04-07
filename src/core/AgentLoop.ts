import { ProviderFactory } from '@/providers/ProviderFactory';
import { ToolRegistry } from '@/core/ToolRegistry';
import { config } from '@/config/env';
import { ProfileRepository } from '@/memory/repositories/ProfileRepository';
import { EmbeddingService } from '@/core/embedding/EmbeddingService';
import { MemoryService } from '@/core/memory/MemoryService';
import { MemoryManager } from '@/memory/MemoryManager';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { ContextBuilder } from '@/core/ContextBuilder';
import { AgentRunInputSchema } from '@/contracts/agent';
import { ToolInputSchema, ToolExecutionResultSchema } from '@/contracts/tool';
import { logger } from '@/infra/logger';
import { z } from 'zod';

type AgentLoopDeps = {
    provider?: ILLMProvider;
    profileRepo?: ProfileRepository;
    contextBuilder?: ContextBuilder;
};

export class AgentLoop {
    private providerName: string;
    private registry: ToolRegistry;
    private maxIterations: number;
    private profileRepo: ProfileRepository;
    private embeddingService: EmbeddingService;
    private memoryService: MemoryService;
    private memoryManager: MemoryManager;
    private providerOverride?: ILLMProvider;
    private contextBuilder: ContextBuilder;

    constructor(
      providerName: string,
      registry: ToolRegistry,
      embeddingService = new EmbeddingService(),
      memoryService = new MemoryService(embeddingService),
      memoryManager = new MemoryManager(embeddingService, memoryService),
      deps: AgentLoopDeps = {},
    ) {
        this.providerName = providerName;
        this.registry = registry;
        this.maxIterations = config.llm.maxIterations || 5;
        this.profileRepo = deps.profileRepo || new ProfileRepository();
        this.embeddingService = embeddingService;
        this.memoryService = memoryService;
        this.memoryManager = memoryManager;
        this.providerOverride = deps.provider;
        this.contextBuilder = deps.contextBuilder || new ContextBuilder();
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
        const parsed = AgentRunInputSchema.parse({ systemPrompt, history, userInput, options });
        const requestId = parsed.options?.requestId;
        logger.info('agent.run.start', {
          provider: this.providerName,
          historyLength: parsed.history.length,
          userInputLength: parsed.userInput.length,
          requestId,
        });

        const profile = await this.profileRepo.getAll();

        const provider = this.providerOverride || ProviderFactory.getChain();
        const userId = parsed.options.userId || 'pwa-user';
        const semanticContext = await this.memoryManager.buildSemanticContext(parsed.userInput, parsed.options.memoryLimit || 5);
        const composedSystemPrompt = this.contextBuilder.build({
          systemPrompt: parsed.systemPrompt,
          profile,
          semanticContext,
        });

        const messages = this.contextBuilder.formatHistory(parsed.history);
        const lastUserMessage = { role: 'user', content: parsed.userInput } as any;

        // Se houver áudio nas opções, injeta na última mensagem do usuário (ou na atual)
        if (parsed.options.audioData) {
            lastUserMessage.audioData = parsed.options.audioData;
            lastUserMessage.mimeType = parsed.options.mimeType;
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
            logger.info('agent.loop.iteration', { iteration: iterations, maxIterations: this.maxIterations, requestId });

            try {
                const response = await provider.generateResponse(composedSystemPrompt, messages, availableTools);

                // Thought -> Action -> Observation
                if (response.toolCalls && response.toolCalls.length > 0) {
                    for (const call of response.toolCalls) {
                        logger.info('agent.tool.call', { tool: call.name, requestId });
                        
                        const tool = this.registry.getTool(call.name);
                        let observation = "";

                        if (!tool) {
                            observation = `Erro: Ferramenta '${call.name}' não existe no ToolRegistry local.`;
                        } else {
                            try {
                                const normalizedCall = ToolInputSchema.safeParse({
                                  name: call.name,
                                  arguments: call.arguments,
                                });
                                if (!normalizedCall.success) {
                                  throw new Error(normalizedCall.error.message);
                                }

                                const normalizedArgs = this.normalizeToolArguments(normalizedCall.data.arguments);
                                const toolArgs = tool.inputSchema
                                  ? tool.inputSchema.parse(normalizedArgs)
                                  : z.object({}).passthrough().parse(normalizedArgs);
                                observation = await tool.execute(toolArgs);
                                ToolExecutionResultSchema.parse(observation);
                            } catch (e: any) {
                                observation = `Falha ao executar ${call.name}: ${e.message}`;
                                logger.warn('agent.tool.error', { tool: call.name, error: e.message });
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
                        logger.info('agent.tool.observation', {
                          tool: call.name,
                          observationLength: observation.length,
                          requestId,
                        });
                    }
                    // Loop volta pro início (Thought) com mensagens novas no buffer.
                    continue; 
                }

                // If no tool calls -> Answer phase reached
                await this.memoryManager.persistTurn(userId, this.providerName, parsed.userInput, response.text, {
                  source: 'agent-loop',
                  provider: this.providerName,
                });
                logger.info('agent.run.complete', {
                  provider: this.providerName,
                  answerLength: response.text.length,
                  requestId,
                });
                return response.text;

            } catch (e: any) {
                logger.error('agent.run.crash', { provider: this.providerName, error: e.message, requestId });
                return `[Sistema] O pipeline do agente sofreu uma falha crítica na iteracão ${iterations}:\n\`\`\`\n${e.message}\n\`\`\``;
            }
        }

        return `[Sistema] Limite de iterações atingido (${this.maxIterations}). Operação abortada por segurança.`;
    }

    private normalizeToolArguments(argumentsValue: unknown): Record<string, unknown> {
      if (argumentsValue && typeof argumentsValue === 'object' && !Array.isArray(argumentsValue)) {
        return argumentsValue as Record<string, unknown>;
      }

      if (typeof argumentsValue === 'string') {
        try {
          const parsed = JSON.parse(argumentsValue);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          return { value: argumentsValue };
        }
      }

      return {};
    }
}
