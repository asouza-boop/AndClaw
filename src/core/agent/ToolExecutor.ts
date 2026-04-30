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
import { EmbeddingService } from '@/core/embedding/EmbeddingService';
import { MemoryManager } from '@/memory/MemoryManager';
import { PlannerService } from '@/core/agent/PlannerService';
import { CacheService } from '@/core/agent/CacheService';
import { DigestService } from '@/core/agent/DigestService';
import type { ExecutionTrace, TraceStep } from '@/contracts/trace';
import type { ActionPlanStep, ToolActionPlan } from '@/core/planner/ActionPlanner';

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
    let iterations = 0;
    while (iterations < this.deps.maxIterations) {
      iterations++;
      onIteration?.();
      logger.info('agent.loop.iteration', { iteration: iterations, maxIterations: this.deps.maxIterations, requestId });

      try {
        const response = await llmClient.generate(composedSystemPrompt, messages, availableTools, parsed.options);

        if (response.toolCalls && response.toolCalls.length > 0) {
          const planValidation = this.deps.plannerService.validate(response.toolCalls);
          if (!planValidation.isValid) {
              logger.warn('agent.spec.violation', { reason: planValidation.reason, requestId });
              return `[Bloqueio de Governança] ${planValidation.reason}`;
          }

          for (const call of response.toolCalls) {
            logger.info('agent.tool.call', { tool: call.name, requestId });

            const tool = this.deps.registry.getTool(call.name);
            let observation = '';

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
              } catch (e: any) {
                observation = `Falha ao executar ${call.name}: ${e.message}`;
                logger.warn('agent.tool.error', { tool: call.name, error: e.message, requestId });
                metrics.increment('tool.execution.error');
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
        return response.text;
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
}
