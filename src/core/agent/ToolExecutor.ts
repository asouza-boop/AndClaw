import { z } from 'zod';
import { logger } from '@/infra/logger';
import { metrics } from '@/infra/metrics/MetricsService';
import { LLMClient, ILLMClient } from '@/core/llm/LLMClient';
import { ToolInputSchema, ToolExecutionResultSchema } from '@/contracts/tool';
import { ExecutionOrchestrator } from '@/core/execution/ExecutionOrchestrator';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { ToolRegistry } from '@/core/ToolRegistry';
import { AgentRunInputSchema } from '@/contracts/agent';
import type { DetectedIntent } from '@/core/planner/IntentDetector';
import type { Skill } from '@/skills/SkillLoader';
import { ContextBuilder } from '@/core/ContextBuilder';
import { EmbeddingService } from '@/core/memory/EmbeddingService';
import { MemoryManager } from '@/memory/MemoryManager';
import { PlannerService } from '@/core/agent/PlannerService';
import { CacheService } from '@/core/agent/CacheService';
import { DigestService } from '@/core/agent/DigestService';
import { EvaluationService } from '@/core/agent/EvaluationService';
import type { ExecutionTrace, TraceStep } from '@/contracts/trace';
import type { ActionPlanStep, ToolActionPlan } from '@/core/planner/ActionPlanner';

function estimateTokens(messages: any[]): number {
  return messages.reduce((total, m) => {
    const content = typeof m.content === 'string'
      ? m.content
      : JSON.stringify(m.content);
    return total + Math.ceil(content.length / 4);
  }, 0);
}

const MAX_CONTEXT_TOKENS = parseInt(process.env.MAX_CONTEXT_TOKENS || '28000', 10);

export type ToolExecutorDeps = {
  providerName: string;
  registry: ToolRegistry;
  providerOverride?: ILLMProvider;
  maxIterations: number;
  memoryManager: MemoryManager;
  contextBuilder: ContextBuilder;
  embeddingService: EmbeddingService;
  cacheService: CacheService;
  plannerService: PlannerService;
  digestService: DigestService;
  evaluationService: EvaluationService;
  getProvider: () => ILLMProvider;
  buildInitialMessages: (parsed: ReturnType<typeof AgentRunInputSchema.parse>) => Array<{ role: string; content: string; audioData?: string; mimeType?: string }>;
  buildCacheInput: (systemPrompt: string, history: Array<{ role: string; content: string }>, userInput: string, profile: Array<{ key: string; value: string }>, userId: string, options: any) => string;
  composeSkillSystemPrompt: (systemPrompt: string, skill: Skill) => string;
  normalizeProfileEntries: (profile: Array<{ key?: string; value?: string }>) => Array<{ key: string; value: string }>;
  resolvePlannedToolInput: (step: ActionPlanStep, intent: DetectedIntent, state: Record<string, unknown>) => Record<string, unknown> | null;
  normalizeToolArguments: (arguments_: unknown) => Record<string, unknown>;
  handleTraceStep: (type: string, status: TraceStep['status'], data?: Record<string, any>) => void;
  checkpoint: () => Promise<void>;
};

export class ToolExecutor {
  constructor(private readonly deps: ToolExecutorDeps) {}

  public async executeSkillPlan(params: {
    parsed: ReturnType<typeof AgentRunInputSchema.parse>;
    intent: DetectedIntent;
    skill: Skill;
    profile: Array<{ key?: string; value?: string }>;
    userId: string;
    availableTools: Array<{ name: string; description: string; category: string; parameters: any }>;
    requestId?: string;
    startedAt: number;
    trace: ExecutionTrace;
    addStep: (type: string, status: TraceStep['status'], data?: Record<string, any>) => void;
    checkpoint: () => Promise<void>;
    onIteration?: () => void;
  }): Promise<{ ok: boolean; output?: string }> {
    const { parsed, intent, skill, profile, userId, availableTools, requestId, startedAt, trace, addStep, checkpoint, onIteration } = params;
    const normalizedProfile = this.deps.normalizeProfileEntries(profile);
    const semanticContext = await this.deps.memoryManager.buildSemanticContext(parsed.userInput, parsed.options.memoryLimit || 5);
    const composedSystemPrompt = this.deps.contextBuilder.build({
      systemPrompt: this.deps.composeSkillSystemPrompt(parsed.systemPrompt, skill),
      profile: normalizedProfile,
      semanticContext,
    });

    const cacheInput = this.deps.buildCacheInput(
      composedSystemPrompt,
      parsed.history,
      parsed.userInput,
      normalizedProfile,
      userId,
      parsed.options,
    );
    const cacheEmbedding = await this.deps.embeddingService.generateEmbedding(cacheInput);
    const cacheHit = await this.deps.cacheService.get(cacheEmbedding, { requestId });

    if (cacheHit) {
      logger.info('agent.skill.executed', {
        requestId,
        intent: intent.name,
        skill: skill.metadata.name,
        source: 'semantic-cache',
        answerLength: cacheHit.output.length,
      });
      await this.deps.memoryManager.persistTurn(userId, this.deps.providerName, parsed.userInput, cacheHit.output, {
        source: 'skill-cache',
        provider: this.deps.providerName,
        intent: intent.name,
        skill: skill.metadata.name,
        cacheHit: true,
      });
      logger.info('agent.run.complete', {
        provider: this.deps.providerName,
        answerLength: cacheHit.output.length,
        requestId,
        mode: 'skill-cache',
      });
      metrics.increment('agent.run.success');
      metrics.observe('agent.latency', Date.now() - startedAt);
      return { ok: true, output: cacheHit.output };
    }

    const provider = this.deps.providerOverride || this.deps.getProvider();
    const output = await this.executeLLMFlow({
      provider,
      composedSystemPrompt,
      availableTools,
      userId,
      parsed,
      requestId,
      startedAt,
      cacheContext: { cacheInput, cacheEmbedding },
      trace,
      addStep,
      checkpoint,
      onIteration,
    });

    return { ok: true, output };
  }

  public async executeLLMFlow(params: {
    provider: ILLMProvider;
    composedSystemPrompt: string;
    availableTools: Array<{ name: string; description: string; category: string; parameters: any }>;
    userId: string;
    parsed: ReturnType<typeof AgentRunInputSchema.parse>;
    requestId?: string;
    startedAt: number;
    cacheContext?: { cacheInput: string; cacheEmbedding: number[] };
    initialMessages?: Array<{ role: string; content: string; audioData?: string; mimeType?: string }>;
    trace: ExecutionTrace;
    addStep: (type: string, status: TraceStep['status'], data?: Record<string, any>) => void;
    checkpoint: () => Promise<void>;
    onIteration?: () => void;
  }): Promise<string> {
    const {
      provider,
      composedSystemPrompt,
      availableTools,
      userId,
      parsed,
      requestId,
      startedAt,
      cacheContext,
      initialMessages,
      trace,
      addStep,
      checkpoint,
      onIteration,
    } = params;

    const messages = initialMessages
      ? initialMessages.map((message) => ({ ...message }))
      : this.deps.buildInitialMessages(parsed);
    const llmClient = new LLMClient(provider);
    const seenToolCalls = new Set<string>();
    let iterations = 0;
    while (iterations < this.deps.maxIterations) {
      iterations++;
      onIteration?.();
      logger.info('agent.loop.iteration', { iteration: iterations, maxIterations: this.deps.maxIterations, requestId });

      try {
        const MAX_LLM_RETRIES = 2;
        const TRANSIENT_PATTERNS = ['429', '503', 'rate limit', 'timeout', 'network', 'ECONNRESET'];

        let response: any = null;
        let lastError: any = null;

        // Trim oldest messages if context window is approaching limit
        while (estimateTokens(messages) > MAX_CONTEXT_TOKENS && messages.length > 2) {
          // Always keep system message (index 0) and latest user message
          messages.splice(1, 1);
        }
        if (estimateTokens(messages) > MAX_CONTEXT_TOKENS) {
          logger.warn('agent.context.overflow', {
            estimatedTokens: estimateTokens(messages),
            messageCount: messages.length
          });
        }

        for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
          try {
            response = await llmClient.generate(composedSystemPrompt, messages, availableTools, parsed.options);
            break; // success
          } catch (err: any) {
            lastError = err;
            const isTransient = TRANSIENT_PATTERNS.some(p =>
              err.message?.toLowerCase().includes(p.toLowerCase())
            );
            if (isTransient && attempt < MAX_LLM_RETRIES) {
              const backoff = Math.pow(2, attempt) * 1000;
              logger.warn('agent.llm.retry', { attempt: attempt + 1, backoff, error: err.message });
              await new Promise(r => setTimeout(r, backoff));
              continue;
            }
            break; // non-transient or max retries reached
          }
        }

        if (!response) {
          throw lastError;
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          const planValidation = this.deps.plannerService.validate(response.toolCalls);
          if (!planValidation.isValid) {
              logger.warn('agent.spec.violation', { reason: planValidation.reason, requestId });
              return `[Bloqueio de Governança] ${planValidation.reason}`;
          }

          for (const call of response.toolCalls) {
            logger.info('agent.tool.call', { tool: call.name, requestId });

            const toolName = call.name;
            const toolArgs = call.arguments;
            const callSignature = `${toolName}:${JSON.stringify(toolArgs)}`;
            if (seenToolCalls.has(callSignature)) {
              logger.warn('agent.tool.duplicate_call_detected', { toolName, iterations });
              messages.push({
                role: 'user',
                content: `[Sistema] Você já executou ${toolName} com esses mesmos argumentos. Por favor, avance para a próxima etapa ou forneça a resposta final.`
              });
              break;
            }
            seenToolCalls.add(callSignature);

            const tool = this.deps.registry.getTool(call.name);
            let observation = '';

            if (!tool) {
              observation = `Erro: Ferramenta '${call.name}' não existe no ToolRegistry local.`;
            } else {
              let attempts = 0;
              const maxAttempts = 3;
              while (attempts < maxAttempts) {
                try {
                  const normalizedCall = ToolInputSchema.safeParse({
                    name: call.name,
                    arguments: call.arguments,
                  });
                  if (!normalizedCall.success) {
                    throw new Error(normalizedCall.error.message);
                  }

                  const normalizedArgs = this.deps.normalizeToolArguments(normalizedCall.data.arguments);
                  const toolArgs = tool.inputSchema
                    ? tool.inputSchema.parse(normalizedArgs)
                    : z.object({}).passthrough().parse(normalizedArgs);

                  const orchestrator = new ExecutionOrchestrator(this.deps.registry);
                  const executionResults = await orchestrator.executeSteps([{
                    name: call.name,
                    arguments: toolArgs
                  }]);
                  
                  observation = executionResults[0]?.observation || 'No output';
                  ToolExecutionResultSchema.parse(observation);
                  metrics.increment('tool.execution.count');
                  break;
                } catch (e: any) {
                  if (this.isTransientError(e) && attempts < maxAttempts - 1) {
                    const delay = 500 * Math.pow(2, attempts);
                    logger.warn('agent.tool.retry', { tool: call.name, error: e.message, attempt: attempts + 1, delay, requestId });
                    await new Promise(r => setTimeout(r, delay));
                    attempts++;
                  } else {
                    observation = `Falha ao executar ${call.name}: ${e.message}`;
                    logger.warn('agent.tool.error', { tool: call.name, error: e.message, requestId });
                    metrics.increment('tool.execution.error');
                    break;
                  }
                }
              }

              if (!observation.startsWith('Falha ao executar')) {
                const check = this.deps.evaluationService.evaluateStep(call.name, observation);
                if (!check.passed) {
                  observation = `[Bloqueio de Governança] ${check.reason}`;
                  logger.warn('agent.governance.block', { tool: call.name, reason: check.reason, requestId });
                }
              }
            }

            const stringifiedArgs = typeof call.arguments === 'string'
              ? call.arguments
              : JSON.stringify(call.arguments);

            messages.push({
              role: 'assistant',
              content: `Eu decidi usar a ferramenta ${call.name} com os argumentos: ${stringifiedArgs}`,
            });
            messages.push({
              role: 'user',
              content: `Resultado da Ferramenta (Observation): ${observation}`,
            });
            logger.info('agent.tool.observation', {
              tool: call.name,
              observationLength: observation.length,
              requestId,
            });
          }
          continue;
        }

        if (cacheContext) {
          await this.deps.cacheService.set(cacheContext.cacheInput, cacheContext.cacheEmbedding, response.text, { requestId });
        }

        await this.deps.memoryManager.persistTurn(userId, this.deps.providerName, parsed.userInput, response.text, {
          source: cacheContext ? 'agent-loop' : 'agent-loop',
          provider: this.deps.providerName,
        }, trace);

        void this.deps.digestService.process(parsed.userInput, response.text, provider, {
          requestId,
          userId,
        });
        addStep('agent.run.complete', 'success', { 
          provider: response?.providerUsed || this.deps.providerName 
        });
        logger.info('agent.run.complete', {
          provider: this.deps.providerName,
          answerLength: response.text.length,
          requestId,
        });
        metrics.increment('agent.run.success');
        metrics.observe('agent.latency', Date.now() - startedAt);
        const finalText = response?.text?.trim();
        if (!finalText) {
          logger.warn('agent.llm.empty_response', { iterations });
          return '[Sistema] O modelo não retornou uma resposta. Por favor, tente novamente.';
        }
        return finalText;
      } catch (e: any) {
        logger.error('agent.run.crash', { provider: this.deps.providerName, error: e.message, requestId });
        metrics.increment('agent.run.error');
        metrics.observe('agent.latency', Date.now() - startedAt);
        return `[Sistema] O pipeline do agente sofreu uma falha crítica na iteracão ${iterations}:\n\`\`\`\n${e.message}\n\`\`\``;
      }
    }

    metrics.increment('agent.run.error');
    metrics.observe('agent.latency', Date.now() - startedAt);
    return `[Sistema] Limite de iterações atingido (${this.deps.maxIterations}). Operação abortada por segurança.`;
  }

  public async executeActionPlan(params: {
    parsed: ReturnType<typeof AgentRunInputSchema.parse>;
    intent: DetectedIntent;
    plan: ToolActionPlan;
    requestId?: string;
    trace: ExecutionTrace;
    addStep: (type: string, status: TraceStep['status'], data?: Record<string, any>) => void;
  }): Promise<{ ok: boolean; output?: string; messages: Array<{ role: string; content: string }>; reason?: string }> {
    const { parsed, intent, plan, requestId, trace } = params;
    const messages = this.deps.buildInitialMessages(parsed);
    const state: Record<string, any> = {
      input: parsed.userInput,
      ...intent.slots,
    };
    const outputs: string[] = [];

    const orchestrator = new ExecutionOrchestrator(this.deps.registry);
    const steps = plan.steps.map(step => ({
      name: step.tool,
      arguments: this.deps.resolvePlannedToolInput(step, intent, state) || {}
    }));

    const executionResults = await orchestrator.executeSteps(steps);
    
    for (let i = 0; i < executionResults.length; i++) {
      const result = executionResults[i];
      const step = plan.steps[i];
      if (!result.success) {
        return { ok: false, reason: `step_failed:${step.tool}:${result.observation}`, messages };
      }
      state[step.outputKey] = result.observation;
      outputs.push(result.observation);
      messages.push({ role: 'assistant', content: `Resultado da ferramenta ${step.tool}: ${result.observation}` });
      messages.push({ role: 'user', content: `Resultado da Ferramenta (Observation): ${result.observation}` });
    }

    const summary = outputs.length === 1
      ? outputs[0]
      : ['[Ação executada]', ...outputs.map((output, index) => `${index + 1}. ${output}`)].join('\n');

    logger.info('agent.plan.result', {
      requestId,
      intent: intent.name,
      stepCount: plan.steps.length,
      outputLength: summary.length,
    });

    return { ok: true, output: summary, messages };
  }

  private isTransientError(error: unknown): boolean {
    if (!error) return false;
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    
    // Network/Transient Errors
    const transientCodes = ['econoreset', 'etimedout', 'enotfound', 'fetch failed'];
    if (transientCodes.some(code => message.includes(code))) return true;
    
    // Transient HTTP Status
    if (message.includes('429') || message.includes('503') || message.includes('504')) return true;
    
    // Transient Keywords
    const transientKeywords = ['timeout', 'rate limit', 'temporarily'];
    if (transientKeywords.some(kw => message.includes(kw))) return true;
    
    // Explicit Non-transient
    const fatalCodes = ['400', '401', '403', '404'];
    if (fatalCodes.some(code => message.includes(code))) return false;
    
    const fatalKeywords = ['not found', 'unauthorized', 'forbidden'];
    if (fatalKeywords.some(kw => message.includes(kw))) return false;
    
    return false;
  }
}
