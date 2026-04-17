import { query } from '@/db/postgres';
import { ProviderFactory } from '@/providers/ProviderFactory';
import { ToolRegistry } from '@/core/ToolRegistry';
import { config } from '@/config/env';
import { ProfileRepository } from '@/memory/repositories/ProfileRepository';
import { EmbeddingService } from '@/core/embedding/EmbeddingService';
import { MemoryService } from '@/core/memory/MemoryService';
import { SemanticCacheService } from '@/core/cache/SemanticCacheService';
import { MemoryManager } from '@/memory/MemoryManager';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { ContextBuilder } from '@/core/ContextBuilder';
import { IntentDetector, DetectedIntent } from '@/core/planner/IntentDetector';
import { ActionPlanner, ActionPlanStep, ToolActionPlan } from '@/core/planner/ActionPlanner';
import { AgentRunInputSchema } from '@/contracts/agent';
import { ToolInputSchema, ToolExecutionResultSchema } from '@/contracts/tool';
import { logger } from '@/infra/logger';
import { metrics } from '@/infra/metrics/MetricsService';
import { SkillLoader, Skill } from '@/skills/SkillLoader';
import { z } from 'zod';

import { PromptInjectionDetector } from '../modules/tools/security/promptInjectionDetector';
import { ExecutionOrchestrator } from './execution/ExecutionOrchestrator';
import { SpecService } from './spec/SpecService';
import { AgentEvaluator } from './evaluation/AgentEvaluator';
import { TaskDecomposer } from './agent/TaskDecomposer';
import { TaskService } from './agent/TaskService';
import { SubAgentSpawner } from './agent/SubAgentSpawner';
import { ResultAggregator } from './agent/ResultAggregator';
import { FeedbackCollector, FeedbackEntry } from './learning/FeedbackCollector';
import { OptimizationEngine } from './learning/OptimizationEngine';
import { ExperimentEngine, ExperimentVariant } from './experiments/ExperimentEngine';
import { ExecutionTrace, TraceStep, AgentControlState } from '@/contracts/trace';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

type AgentLoopDeps = {
    provider?: ILLMProvider;
    profileRepo?: ProfileRepository;
    contextBuilder?: ContextBuilder;
    cacheService?: SemanticCacheService;
    intentDetector?: IntentDetector;
    actionPlanner?: ActionPlanner;
    skillLoader?: SkillLoader;
};

export class AgentLoop {
    private providerName: string;
    private registry: ToolRegistry;
    private maxIterations: number;
    private profileRepo: ProfileRepository;
    private embeddingService: EmbeddingService;
    private memoryService: MemoryService;
    private memoryManager: MemoryManager;
    private cacheService: SemanticCacheService;
    private providerOverride?: ILLMProvider;
    private contextBuilder: ContextBuilder;
    private intentDetector: IntentDetector;
    private actionPlanner: ActionPlanner;
    private skillLoader: SkillLoader;

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
        this.cacheService = deps.cacheService || new SemanticCacheService();
        this.providerOverride = deps.provider;
        this.contextBuilder = deps.contextBuilder || new ContextBuilder();
        this.intentDetector = deps.intentDetector || new IntentDetector();
        this.actionPlanner = deps.actionPlanner || new ActionPlanner();
        this.skillLoader = deps.skillLoader || new SkillLoader();
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
        const evaluationStartTime = Date.now();
        let toolUsageCount = 0;
        let errorCount = 0;
        let success = false;
        let totalIterations = 0;
        let executionPath: FeedbackEntry['executionPath'] = 'unknown';
        let skillUsed: string | undefined = undefined;
        let isFallback = false;
        let variant: ExperimentVariant = 'A';

        const parsed = AgentRunInputSchema.parse({ systemPrompt, history, userInput, options });
        const requestId = typeof parsed.options?.requestId === 'string' ? parsed.options.requestId : undefined;
        const userId = parsed.options.userId || 'pwa-user';
        const startedAt = Date.now();

        variant = ExperimentEngine.getVariant(requestId || userId);

        const trace: ExecutionTrace = {
            version: 'v1',
            steps: []
        };

        const addStep = (type: string, status: TraceStep['status'], data?: Record<string, any>) => {
            trace.steps.push({
                type,
                timestamp: new Date().toISOString(),
                status,
                data: data ? this.sanitizeTraceData(data) : undefined
            });
        };

        const checkpoint = async () => {
            if (!requestId) return;
            let pausedOnce = false;
            while (AgentControlState.isPaused(requestId)) {
                if (!pausedOnce) {
                    addStep('agent.control.paused', 'pending', { requestId });
                    pausedOnce = true;
                }
                await sleep(250);
            }
            if (pausedOnce) {
                addStep('agent.control.resumed', 'success', { requestId });
            }
        };

        addStep('agent.run.start', 'start', { 
            provider: this.providerName,
            variant,
            userInput: parsed.userInput.length > 100 ? parsed.userInput.slice(0, 100) + '...' : parsed.userInput
        });
        
        logger.info('agent.run.start', {
          provider: this.providerName,
          variant,
          historyLength: parsed.history.length,
          userInputLength: parsed.userInput.length,
          requestId,
        });

        // --- 1. Security Check: Prompt Injection ---
        await checkpoint();
        const injectionCheck = PromptInjectionDetector.analyze(parsed.userInput);
        if (!injectionCheck.isSafe) {
            addStep('agent.security.blocked', 'blocked', { reason: injectionCheck.reason });
            return `[Erro de Segurança] ${injectionCheck.reason || 'Sua solicitação foi bloqueada por motivos de segurança.'}`;
        }

        // --- 2. Multi-Agent Decomposition Check ---
        const decomposition = await TaskDecomposer.decompose(parsed.userInput);
        if (decomposition.isComplex && decomposition.subTasks.length > 1) {
            console.log(`[AgentLoop] Complex task detected. Spawning ${decomposition.subTasks.length} sub-agents.`);
            const spawner = new SubAgentSpawner(this.providerName, this.registry);
            const subResults = await spawner.spawnAll(decomposition.subTasks);
            
            // Track metrics for sub-agents
            const multiAgentSuccess = subResults.every(r => r.success);
            AgentEvaluator.evaluateRun({
                success: multiAgentSuccess,
                latencyMs: Date.now() - startedAt,
                toolUsageCount: subResults.length,
                errorCount: subResults.filter(r => !r.success).length,
                totalIterations: 1
            }, variant);

            // --- Passive Learning: Multi-Agent path ---
            const multiAgentFeedback: FeedbackEntry = {
                requestId,
                success: multiAgentSuccess,
                latencyMs: Date.now() - startedAt,
                toolsUsed: subResults.map(r => r.description || 'sub-agent'),
                executionPath: 'multi-agent',
                errorCount: subResults.filter(r => !r.success).length,
                timestamp: new Date().toISOString(),
            };
            FeedbackCollector.collect(multiAgentFeedback);

            return ResultAggregator.aggregate(subResults);
        }

        try {
            const profile = this.normalizeProfileEntries(await this.profileRepo.getAll());

            // --- Decision Layer: Classification ---
            const classification = this.classifyInput(parsed.userInput);
            addStep('agent.classification.result', 'success', classification);
            logger.info('agent.classification.result', { requestId, ...classification });

            // --- Routing Layer: Auto-capture ---
            await this.routeToCapture(parsed.userInput, classification, requestId);

            const intent = this.intentDetector.detect(parsed.userInput, parsed.history);
            if (intent) intent.requestId = requestId;
            const availableSkills = this.skillLoader.fetchSkills();
            const availableTools = this.registry.getAllTools().map((tool) => ({
                name: tool.name,
                description: tool.description,
                category: tool.category,
                parameters: tool.parameters,
            }));

            if (intent) {
              addStep('agent.intent.detected', 'success', { 
                name: intent.name, 
                confidence: intent.confidence,
                slots: intent.slots 
              });
              logger.info('agent.intent.detected', {
                requestId,
                intent: intent.name,
                confidence: intent.confidence,
                reason: intent.reason,
              });

              const plan = this.actionPlanner.plan(intent, this.registry.getAllTools(), availableSkills, variant);
              if (!plan) {
                  logger.warn('agent.plan.failed', { requestId, intent: intent.name });
                  addStep('agent.plan.failed', 'failure', { intent: intent.name });
                  isFallback = true;
              } else {
                addStep('agent.plan.created', 'success', { 
                  type: plan.type,
                  intent: plan.intent
                });
                logger.info('agent.plan.created', {
                  requestId,
                  intent: plan.intent,
                  type: plan.type,
                  ...(plan.type === 'skill'
                    ? { skills: plan.skills }
                    : { steps: plan.steps.map((step) => ({
                        tool: step.tool,
                        inputKey: step.inputKey,
                        outputKey: step.outputKey,
                      })) }),
                });

                if (plan.type === 'skill') {
                  let skillExecuted = false;

                  for (let i = 0; i < plan.skills.length; i++) {
                    const skillName = plan.skills[i];
                    const skill = availableSkills.find((item) => item.metadata.name === skillName) || null;

                    if (skill) {
                      const skillResult = await this.executeSkillPlan({
                        parsed,
                        intent,
                        skill,
                        profile,
                        userId,
                        availableTools,
                        requestId,
                        startedAt,
                        trace,
                        addStep,
                        checkpoint
                      });

                      if (skillResult.ok && skillResult.output) {
                        logger.info('agent.skill.executed', {
                          requestId,
                          intent: intent.name,
                          skill: skill.metadata.name,
                          answerLength: skillResult.output.length,
                        });
                        await this.memoryManager.persistTurn(userId, this.providerName, parsed.userInput, skillResult.output, {
                          source: 'skill-plan',
                          provider: this.providerName,
                          intent: intent.name,
                          skill: skill.metadata.name,
                        }, trace);
                        logger.info('agent.run.complete', {
                          provider: this.providerName,
                          answerLength: skillResult.output.length,
                          requestId,
                          mode: 'skill-plan',
                        });
                        metrics.increment('agent.run.success');
                        metrics.observe('agent.latency', Date.now() - startedAt);
                        executionPath = 'skill-plan';
                        skillUsed = skill.metadata.name;
                        success = true;
                        skillExecuted = true;
                        addStep('agent.run.complete', 'success', { mode: 'skill-plan' });
                        return skillResult.output;
                      }

                      // If we are here, the skill failed. Check if there is another one to try.
                      if (i < plan.skills.length - 1) {
                         logger.warn('planner.fallback.used', {
                            requestId,
                            failedSkill: skillName,
                            nextSkill: plan.skills[i + 1],
                            reason: 'skill_execution_returned_no_output'
                         });
                      }
                    }
                  }

                  if (!skillExecuted) {
                    isFallback = true;
                    logger.info('agent.skill.fallback', {
                      requestId,
                      intent: intent.name,
                      skills: plan.skills,
                      reason: 'all_skills_failed_or_missing',
                    });
                  }
                } else {
                  const actionPlan = plan as ToolActionPlan;
                  const actionResult = await this.executeActionPlan({
                    parsed,
                    intent,
                    plan: actionPlan,
                    requestId,
                    trace,
                    addStep
                  });

                  if (actionResult.ok && actionResult.output) {
                    await this.memoryManager.persistTurn(userId, this.providerName, parsed.userInput, actionResult.output, {
                      source: 'action-plan',
                      provider: this.providerName,
                      intent: intent.name,
                      planSteps: (plan as ToolActionPlan).steps.length,
                    }, trace);
                    logger.info('agent.run.complete', {
                      provider: this.providerName,
                      answerLength: actionResult.output.length,
                      requestId,
                      mode: 'action-plan',
                    });
                    metrics.increment('agent.run.success');
                    metrics.observe('agent.latency', Date.now() - startedAt);
                    executionPath = 'action-plan';
                    success = true;
                    addStep('agent.run.complete', 'success', { mode: 'action-plan' });
                    return actionResult.output;
                  }

                  logger.info('agent.plan.fallback', {
                    requestId,
                    intent: intent.name,
                    reason: actionResult.reason || 'plan_failed',
                  });
                  isFallback = true;
                  const provider = this.providerOverride || ProviderFactory.getChain();
                  const semanticContext = await this.memoryManager.buildSemanticContext(parsed.userInput, parsed.options.memoryLimit || 5);
                  const composedSystemPrompt = this.contextBuilder.build({
                    systemPrompt: parsed.systemPrompt,
                    profile,
                    semanticContext,
                  });
                  const fallbackReply = await this.executeLLMFlow({
                    provider,
                    composedSystemPrompt,
                    initialMessages: actionResult.messages,
                    availableTools,
                    userId,
                    parsed,
                    requestId,
                    startedAt,
                    trace,
                    addStep,
                    checkpoint
                  });
                  return fallbackReply;
                }
              }
            }


            const provider = this.providerOverride || ProviderFactory.getChain();
            const cacheInput = this.buildCacheInput(parsed.systemPrompt, parsed.history, parsed.userInput, profile, userId, parsed.options);
            const cacheEmbedding = await this.embeddingService.generateEmbedding(cacheInput);
            const cacheHit = await this.cacheService.get(cacheEmbedding, { requestId });
            if (cacheHit) {
              await this.memoryManager.persistTurn(userId, this.providerName, parsed.userInput, cacheHit.output, {
                source: 'semantic-cache',
                provider: this.providerName,
                cacheHit: true,
              }, trace);
              addStep('agent.cache.hit', 'hit', { similarity: cacheHit.distance });
              addStep('agent.run.complete', 'success', { mode: 'cache-hit' });
              logger.info('agent.run.complete', {
                provider: this.providerName,
                answerLength: cacheHit.output.length,
                requestId,
                cache: 'hit',
              });
              metrics.increment('agent.run.success');
              metrics.observe('agent.latency', Date.now() - startedAt);
              executionPath = 'cache-hit';
              success = true;
              return cacheHit.output;
            }
            addStep('agent.cache.miss', 'miss');

            const semanticContext = await this.memoryManager.buildSemanticContext(parsed.userInput, parsed.options.memoryLimit || 5);
            const composedSystemPrompt = this.contextBuilder.build({
              systemPrompt: parsed.systemPrompt,
              profile,
              semanticContext,
            });

            return this.executeLLMFlow({
                provider,
                composedSystemPrompt,
                availableTools,
                userId,
                parsed,
                requestId,
                startedAt,
                trace,
                addStep,
                checkpoint
            });
        } catch (error) {
          errorCount++;
          throw error;
        } finally {
          if (executionPath === 'unknown') {
            // Default: if no specific path was set but no errors, it was llm-flow
            if (errorCount === 0) executionPath = 'llm-flow';
          }
          success = success || errorCount === 0;
          AgentEvaluator.evaluateRun({
              success,
              latencyMs: Date.now() - evaluationStartTime,
              toolUsageCount,
              errorCount,
              totalIterations: totalIterations || 1,
              isFallback
          }, variant);

          // --- Passive Learning: collect feedback & update optimization scores ---
          try {
              const feedbackEntry: FeedbackEntry = {
                  requestId,
                  success,
                  latencyMs: Date.now() - evaluationStartTime,
                  skillId: skillUsed,
                  toolsUsed: [],
                  executionPath,
                  errorCount,
                  timestamp: new Date().toISOString(),
              };
              FeedbackCollector.collect(feedbackEntry);
              OptimizationEngine.processFeedback(feedbackEntry);
          } catch {
              // Background-safe: learning errors must never break the agent
          }
        }
    }

    private async executeSkillPlan(params: {
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
    }): Promise<{ ok: boolean; output?: string }> {
      const { parsed, intent, skill, profile, userId, availableTools, requestId, startedAt, trace, addStep, checkpoint } = params;
      const normalizedProfile = this.normalizeProfileEntries(profile);
      const semanticContext = await this.memoryManager.buildSemanticContext(parsed.userInput, parsed.options.memoryLimit || 5);
      const composedSystemPrompt = this.contextBuilder.build({
        systemPrompt: this.composeSkillSystemPrompt(parsed.systemPrompt, skill),
        profile: normalizedProfile,
        semanticContext,
      });

      const cacheInput = this.buildCacheInput(
        composedSystemPrompt,
        parsed.history,
        parsed.userInput,
        normalizedProfile,
        userId,
        parsed.options,
      );
      const cacheEmbedding = await this.embeddingService.generateEmbedding(cacheInput);
      const cacheHit = await this.cacheService.get(cacheEmbedding, { requestId });

      if (cacheHit) {
        logger.info('agent.skill.executed', {
          requestId,
          intent: intent.name,
          skill: skill.metadata.name,
          source: 'semantic-cache',
          answerLength: cacheHit.output.length,
        });
        await this.memoryManager.persistTurn(userId, this.providerName, parsed.userInput, cacheHit.output, {
          source: 'skill-cache',
          provider: this.providerName,
          intent: intent.name,
          skill: skill.metadata.name,
          cacheHit: true,
        });
        logger.info('agent.run.complete', {
          provider: this.providerName,
          answerLength: cacheHit.output.length,
          requestId,
          mode: 'skill-cache',
        });
        metrics.increment('agent.run.success');
        metrics.observe('agent.latency', Date.now() - startedAt);
        return { ok: true, output: cacheHit.output };
      }

      const provider = this.providerOverride || ProviderFactory.getChain();
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
        checkpoint
      });

      return { ok: true, output };
    }

    private async executeLLMFlow(params: {
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
        checkpoint
      } = params;

      const messages = initialMessages
        ? initialMessages.map((message) => ({ ...message }))
        : this.buildInitialMessages(parsed);
      let iterations = 0;

      while (iterations < this.maxIterations) {
        iterations++;
        logger.info('agent.loop.iteration', { iteration: iterations, maxIterations: this.maxIterations, requestId });

        try {
          const response = await provider.generateResponse(composedSystemPrompt, messages, availableTools);

          if (response.toolCalls && response.toolCalls.length > 0) {
            // --- 3. Spec Governance Verification ---
            const planValidation = SpecService.validatePlan(response.toolCalls);
            if (!planValidation.isValid) {
                logger.warn('agent.spec.violation', { reason: planValidation.reason, requestId });
                return `[Bloqueio de Governança] ${planValidation.reason}`;
            }

            for (const call of response.toolCalls) {
              logger.info('agent.tool.call', { tool: call.name, requestId });

              const tool = this.registry.getTool(call.name);
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

                  const normalizedArgs = this.normalizeToolArguments(normalizedCall.data.arguments);
                  const toolArgs = tool.inputSchema
                    ? tool.inputSchema.parse(normalizedArgs)
                    : z.object({}).passthrough().parse(normalizedArgs);

                  const orchestrator = new ExecutionOrchestrator(this.registry);
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
            await this.cacheService.set(cacheContext.cacheInput, cacheContext.cacheEmbedding, response.text, { requestId });
          }

          await this.memoryManager.persistTurn(userId, this.providerName, parsed.userInput, response.text, {
            source: cacheContext ? 'agent-loop' : 'agent-loop',
            provider: this.providerName,
          }, trace);
          addStep('agent.run.complete', 'success');
          logger.info('agent.run.complete', {
            provider: this.providerName,
            answerLength: response.text.length,
            requestId,
          });
          metrics.increment('agent.run.success');
          metrics.observe('agent.latency', Date.now() - startedAt);
          return response.text;
        } catch (e: any) {
          logger.error('agent.run.crash', { provider: this.providerName, error: e.message, requestId });
          metrics.increment('agent.run.error');
          metrics.observe('agent.latency', Date.now() - startedAt);
          return `[Sistema] O pipeline do agente sofreu uma falha crítica na iteracão ${iterations}:\n\`\`\`\n${e.message}\n\`\`\``;
        }
      }

      metrics.increment('agent.run.error');
      metrics.observe('agent.latency', Date.now() - startedAt);
      return `[Sistema] Limite de iterações atingido (${this.maxIterations}). Operação abortada por segurança.`;
    }

    private async executeActionPlan(params: {
      parsed: ReturnType<typeof AgentRunInputSchema.parse>;
      intent: DetectedIntent;
      plan: ToolActionPlan;
      requestId?: string;
      trace: ExecutionTrace;
      addStep: (type: string, status: TraceStep['status'], data?: Record<string, any>) => void;
    }): Promise<{ ok: boolean; output?: string; messages: Array<{ role: string; content: string }>; reason?: string }> {
      const { parsed, intent, plan, requestId, trace, addStep } = params;
      const messages = this.buildInitialMessages(parsed);
      const state: Record<string, any> = {
        input: parsed.userInput,
        ...intent.slots,
      };
      const outputs: string[] = [];

      const orchestrator = new ExecutionOrchestrator(this.registry);
      const steps = plan.steps.map(step => ({
        name: step.tool,
        arguments: this.resolvePlannedToolInput(step, intent, state) || {}
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

    private isFailureObservation(output: unknown): boolean {
      if (typeof output === 'string') {
        return /^(erro|falha|failed|error)\b/i.test(output.trim());
      }

      if (output && typeof output === 'object') {
        const value = output as Record<string, unknown>;
        return typeof value.error === 'string' && value.error.trim().length > 0;
      }

      return false;
    }

    private classifyInput(input: string): { type: "task" | "note" | "link" | "meeting" | "project", confidence: number } {
        const text = input.toLowerCase();

        // Heuristics
        if (text.includes('http://') || text.includes('https://') || text.includes('www.')) {
            return { type: 'link', confidence: 1.0 };
        }

        if (text.includes('reunião') || text.includes('meeting') || text.includes('call') || text.includes('agendar')) {
            return { type: 'meeting', confidence: 0.95 };
        }

        if (text.includes('fazer') || text.includes('todo') || text.includes('preciso') || text.includes('task') || text.includes('devo')) {
            return { type: 'task', confidence: 0.9 };
        }

        if (text.includes('projeto') || text.includes('project') || text.includes('roadmap') || text.includes('plano')) {
            return { type: 'project', confidence: 0.85 };
        }

        // Default to note for long text or fallback
        const isLongText = input.length > 250 || (input.match(/\n/g) || []).length >= 3;
        return { 
            type: 'note', 
            confidence: isLongText ? 0.9 : 0.7 
        };
    }

    private async routeToCapture(input: string, classification: { type: string, confidence: number }, requestId?: string): Promise<void> {
        // Routing types: only handle the ones requested (or map project to task/note)
        const allowedTypes = ['link', 'task', 'note', 'meeting'];
        const type = allowedTypes.includes(classification.type) ? classification.type : 'note';

        try {
            const rows = await query(
                `INSERT INTO captures (content, source, type, status, metadata)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [
                    input,
                    'agent-loop',
                    type,
                    'processed',
                    JSON.stringify({
                        originalInput: input,
                        classificationConfidence: classification.confidence,
                        requestId
                    })
                ]
            );
            logger.info('agent.routing.completed', { requestId, type });

            // Auto-create task if classified as task
            const capture = rows[0];
            if (capture && type === 'task') {
                await TaskService.createFromCapture(capture);
            }
        } catch (err: any) {
            logger.warn('agent.routing.failed', { requestId, error: err.message });
            // Routing failure should not block the agent run
        }
    }

    private normalizeProfileEntries(profile: Array<{ key?: string; value?: string }>): Array<{ key: string; value: string }> {
      return profile
        .filter((item): item is { key: string; value: string } => Boolean(item?.key && item?.value))
        .map((item) => ({
          key: item.key.trim(),
          value: item.value.trim(),
        }))
        .filter((item) => item.key.length > 0 && item.value.length > 0);
    }

    private composeSkillSystemPrompt(systemPrompt: string, skill: Skill): string {
      const blocks = [
        systemPrompt.trim(),
        `[HABILIDADE ATIVA] ${skill.metadata.name}`,
        skill.content.trim(),
      ].filter(Boolean);

      return blocks.join('\n\n');
    }

    private resolvePlannedToolInput(
      step: ActionPlanStep,
      intent: DetectedIntent,
      state: Record<string, unknown>,
    ): Record<string, unknown> | null {
      const slots = intent.slots || {};

      switch (step.tool) {
        case 'update_user_profile':
          return {
            key: String(slots.key || '').trim(),
            value: String(slots.value || '').trim(),
          };
        case 'delete_user_profile':
          return {
            key: String(slots.key || '').trim(),
          };
        case 'ls':
          return {
            path: String(state[step.inputKey] || slots.path || '.').trim() || '.',
          };
        case 'read_file': {
          const raw = state[step.inputKey] ?? slots.path;
          const normalized = this.resolveFirstPathLikeValue(raw);
          if (!normalized) return null;
          return {
            path: normalized,
          };
        }
        case 'write_file':
          return {
            path: String(slots.path || '').trim(),
            content: String(slots.content || '').trim(),
          };
        case 'glob':
          return {
            pattern: String(state[step.inputKey] || slots.pattern || slots.path || '').trim(),
          };
        case 'grep':
          return {
            pattern: String(slots.pattern || '').trim(),
            path: String(slots.path || '').trim(),
          };
        case 'notion_api':
          return {
            action: String(slots.action || 'create_page'),
            title: String(slots.title || '').trim() || undefined,
            content: String(slots.content || '').trim() || undefined,
            parentId: String(slots.parentId || '').trim() || undefined,
          };
        default:
          const direct = state[step.inputKey];
          if (direct && typeof direct === 'object') {
            return direct as Record<string, unknown>;
          }
          if (typeof direct === 'string') {
            return { value: direct };
          }
          return null;
      }
    }

    private resolveFirstPathLikeValue(value: unknown): string | null {
      if (typeof value !== 'string') return null;
      const candidate = value
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean);
      return candidate || null;
    }

    private buildInitialMessages(parsed: ReturnType<typeof AgentRunInputSchema.parse>): Array<{ role: string; content: string; audioData?: string; mimeType?: string }> {
      const messages = this.contextBuilder.formatHistory(parsed.history) as Array<{ role: string; content: string; audioData?: string; mimeType?: string }>;
      const lastUserMessage: { role: string; content: string; audioData?: string; mimeType?: string } = { role: 'user', content: parsed.userInput };

      if (parsed.options.audioData) {
        lastUserMessage.audioData = parsed.options.audioData;
        lastUserMessage.mimeType = parsed.options.mimeType;
      }

      messages.push(lastUserMessage);
      return messages;
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

    private buildCacheInput(
      systemPrompt: string,
      history: Array<{ role: string; content: string }>,
      userInput: string,
      profile: Array<{ key?: string; value?: string }>,
      userId: string,
      options: Record<string, any>,
    ): string {
      return JSON.stringify({
        systemPrompt,
        history,
        userInput,
        profile,
        userId,
        options: {
          audioData: Boolean(options.audioData),
          mimeType: options.mimeType || null,
        },
      });
    }

    private sanitizeTraceData(data: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' && value.length > 500) {
                result[key] = value.slice(0, 500) + '... [truncated]';
            } else {
                result[key] = value;
            }
        }
        return result;
    }
}
