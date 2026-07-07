import { query } from '@/db/postgres';
import { ProviderFactory } from '@/providers/ProviderFactory';
import { saveToRaindrop } from '@/integrations/raindrop';
import { ToolRegistry } from '@/core/ToolRegistry';
import { config } from '@/config/env';
import { ProfileRepository } from '@/memory/repositories/ProfileRepository';
import { EmbeddingService } from '@/core/memory/EmbeddingService';
import { MemoryService } from '@/core/memory/MemoryService';
import { SemanticCacheService } from '@/core/cache/SemanticCacheService';
import { CacheService } from './agent/CacheService';
import { MemoryManager } from '@/memory/MemoryManager';
import { ILLMProvider } from '@/providers/ILLMProvider';
import { ContextBuilder } from '@/core/ContextBuilder';
import { IntentDetector, DetectedIntent } from '@/core/planner/IntentDetector';
import { ActionPlanner, ActionPlanStep, ToolActionPlan } from '@/core/planner/ActionPlanner';
import { AgentRunInputSchema } from '@/contracts/agent';
import { LLMClient, ILLMClient } from '@/core/llm/LLMClient';
import { ToolInputSchema, ToolExecutionResultSchema } from '@/contracts/tool';
import { logger } from '@/infra/logger';
import { metrics } from '@/infra/metrics/MetricsService';
import { SkillLoader, Skill } from '@/skills/SkillLoader';
import { z } from 'zod';

import { PromptInjectionDetector } from '../modules/tools/security/promptInjectionDetector';
import { ExecutionOrchestrator } from './execution/ExecutionOrchestrator';
import { TaskDecomposer } from './agent/TaskDecomposer';
import { TaskService } from './agent/TaskService';
import { SubAgentSpawner } from './agent/SubAgentSpawner';
import { FeedbackEntry } from './learning/OptimizationEngine';
import { MeetingService } from './agent/MeetingService';
import { ProjectService } from './agent/ProjectService';
import { ExperimentEngine, ExperimentVariant } from './experiments/ExperimentEngine';
import { ExecutionTrace, TraceStep, AgentControlState } from '@/contracts/trace';
import { EvaluationService } from './agent/EvaluationService';
import { ClassificationService } from './agent/ClassificationService';
import { DigestService } from './agent/DigestService';
import { PlannerService } from './agent/PlannerService';
import { ToolExecutor } from './agent/ToolExecutor';

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
    private cacheService: CacheService;
    private evaluationService: EvaluationService;
    private classificationService: ClassificationService;
    private digestService: DigestService;
    private plannerService: PlannerService;
    private toolExecutor: ToolExecutor;
    private providerOverride?: ILLMProvider;
    private contextBuilder: ContextBuilder;
    private intentDetector: IntentDetector;
    private skillLoader: SkillLoader;
    private pauseTimeoutMs: number;

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
        this.cacheService = new CacheService(deps.cacheService || new SemanticCacheService());
        this.evaluationService = new EvaluationService();
        this.classificationService = new ClassificationService();
        this.digestService = new DigestService({
          addSemanticMemory: this.memoryManager.addSemanticMemory ? this.memoryManager.addSemanticMemory.bind(this.memoryManager) : async () => null,
        });
        this.providerOverride = deps.provider;
        this.contextBuilder = deps.contextBuilder || new ContextBuilder();
        this.intentDetector = deps.intentDetector || new IntentDetector();
        this.plannerService = new PlannerService({
          actionPlanner: deps.actionPlanner || new ActionPlanner(),
        });
        this.toolExecutor = new ToolExecutor({
          providerName: this.providerName,
          registry: this.registry,
          providerOverride: this.providerOverride,
          maxIterations: this.maxIterations,
          memoryManager: this.memoryManager,
          contextBuilder: this.contextBuilder,
          embeddingService: this.embeddingService,
          cacheService: this.cacheService,
          plannerService: this.plannerService,
          digestService: this.digestService,
          evaluationService: this.evaluationService,
          getProvider: () => this.providerOverride || ProviderFactory.getChain(),
          buildInitialMessages: this.buildInitialMessages.bind(this),
          buildCacheInput: this.buildCacheInput.bind(this),
          composeSkillSystemPrompt: this.composeSkillSystemPrompt.bind(this),
          normalizeProfileEntries: this.normalizeProfileEntries.bind(this),
          resolvePlannedToolInput: this.resolvePlannedToolInput.bind(this),
          normalizeToolArguments: this.normalizeToolArguments.bind(this),
          handleTraceStep: () => undefined,
          checkpoint: async () => undefined,
        });
        this.skillLoader = deps.skillLoader || new SkillLoader();
        this.pauseTimeoutMs = config.llm.pauseTimeoutMs || 30_000;
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
            const pausedAt = Date.now();
            while (AgentControlState.isPaused(requestId)) {
                if (Date.now() - pausedAt >= this.pauseTimeoutMs) {
                    const err = new Error(`Pause timeout exceeded after ${this.pauseTimeoutMs}ms for request ${requestId}`);
                    err.name = 'PauseTimeoutError';
                    throw err;
                }
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

            // --- Decision Layer: Classification ---
            const classification = this.classificationService.classifyInput(parsed.userInput);
            addStep('agent.classification.result', 'success', classification);
            logger.info('agent.classification.result', { requestId, ...classification });

            // --- Routing Layer: Auto-capture ---
            const actionMessage = await this.routeToCapture(parsed.userInput, classification, requestId);

            const finalResponse = (text: string) => {
                if (actionMessage) {
                    return `${text}\n\n---\n*AndClaw OS: ${actionMessage}*`;
                }
                return text;
            };

            const decomposition = await TaskDecomposer.decompose(parsed.userInput);
            if (decomposition.isComplex && decomposition.subTasks.length > 1) {
                console.log(`[AgentLoop] Complex task detected. Spawning ${decomposition.subTasks.length} sub-agents.`);
                const spawner = new SubAgentSpawner(this.providerName, this.registry);
                const subResults = await spawner.spawnAll(decomposition.subTasks);
                
                // Track metrics for sub-agents
                const multiAgentSuccess = subResults.every(r => r.success);
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
                this.evaluationService.recordRun({
                    success: multiAgentSuccess,
                    latencyMs: Date.now() - startedAt,
                    toolUsageCount: subResults.length,
                    errorCount: subResults.filter(r => !r.success).length,
                    totalIterations: 1
                }, variant, multiAgentFeedback, {
                    backgroundSafe: false,
                    processOptimization: false,
                });

                let aggregated = '';
                if (subResults.length === 0) {
                    aggregated = '[Sistema] Nenhum resultado de sub-agente para agregar.';
                } else if (subResults.length === 1) {
                    aggregated = subResults[0].output;
                } else {
                    const successes = subResults.filter(r => r.success);
                    const failures = subResults.filter(r => !r.success);

                    if (successes.length > 0) {
                        for (const r of successes) {
                            aggregated += `**Etapa ${r.taskId}** — ${r.description}\n${r.output}\n\n`;
                        }
                    }

                    if (failures.length > 0) {
                        aggregated += `---\n⚠️ **Etapas com falha:**\n`;
                        for (const r of failures) {
                            aggregated += `- Etapa ${r.taskId} (${r.description}): ${r.output.substring(0, 200)}\n`;
                        }
                    }
                    console.log(`[Observability] agent.aggregation.complete: ${successes.length} succeeded, ${failures.length} failed.`);
                    aggregated = aggregated.trim();
                }

                return finalResponse(aggregated);
            }

        try {
            const profile = this.normalizeProfileEntries(await this.profileRepo.getAll());

            // Action message was already captured above

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

              const plan = this.plannerService.plan(intent, this.registry.getAllTools(), availableSkills, variant);
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
                      const skillResult = await this.toolExecutor.executeSkillPlan({
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
                        checkpoint,
                        onIteration: () => {
                          totalIterations++;
                        }
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
                  const actionResult = await this.toolExecutor.executeActionPlan({
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
                    return finalResponse(actionResult.output);
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
                  const fallbackReply = await this.toolExecutor.executeLLMFlow({
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
                    checkpoint,
                    onIteration: () => {
                      totalIterations++;
                    }
                  });
                  return finalResponse(fallbackReply);
                }
              }
            }


            const provider = this.providerOverride || ProviderFactory.getChain();
            const cacheInput = this.buildCacheInput(parsed.systemPrompt, parsed.history, parsed.userInput, profile, userId, parsed.options);
            let cacheEmbedding: number[] | null = null;
            try {
              cacheEmbedding = await this.embeddingService.generateEmbedding(cacheInput);
            } catch (embErr: any) {
              logger.warn('agent.cache.embedding_skipped', { reason: embErr.message });
            }

            if (cacheEmbedding) {
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
                return finalResponse(cacheHit.output);
              }
            }
            addStep('agent.cache.miss', 'miss');

            const semanticContext = await this.memoryManager.buildSemanticContext(parsed.userInput, parsed.options.memoryLimit || 5);
            const composedSystemPrompt = this.contextBuilder.build({
              systemPrompt: parsed.systemPrompt,
              profile,
              semanticContext,
            });

            const llmReply = await this.toolExecutor.executeLLMFlow({
                provider,
                composedSystemPrompt,
                availableTools,
                userId,
                parsed,
                requestId,
                startedAt,
                trace,
                addStep,
                checkpoint,
                onIteration: () => {
                  totalIterations++;
                }
            });
            return finalResponse(llmReply);
        } catch (error) {
          errorCount++;
          throw error;
        } finally {
          if (executionPath === 'unknown') {
            // Default: if no specific path was set but no errors, it was llm-flow
            if (errorCount === 0) executionPath = 'llm-flow';
          }
          success = success || errorCount === 0;
          this.evaluationService.recordRun({
              success,
              latencyMs: Date.now() - evaluationStartTime,
              toolUsageCount,
              errorCount,
              totalIterations: totalIterations || 1,
              isFallback
          }, variant, {
              requestId,
              success,
              latencyMs: Date.now() - evaluationStartTime,
              skillId: skillUsed,
              toolsUsed: [],
              executionPath,
              errorCount,
              timestamp: new Date().toISOString(),
          });
        }
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

    private async routeToCapture(input: string, classification: { type: string, confidence: number }, requestId?: string): Promise<string | null> {
        // Routing types: only handle the ones requested (or map project to task/note)
        const allowedTypes = ['link', 'task', 'note', 'meeting', 'project'];
        const type = allowedTypes.includes(classification.type) ? classification.type : 'note';
        let actionMessage: string | null = null;

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

            const capture = rows[0];
            if (capture) {
                if (type === 'task') {
                    await TaskService.createFromCapture(capture);
                    actionMessage = '✅ Tarefa registrada';
                } else if (type === 'meeting') {
                    await MeetingService.createFromCapture(capture);
                    actionMessage = '📅 Reunião agendada';
                } else if (type === 'project') {
                    const projectId = await ProjectService.createFromCapture(capture);
                    if (projectId) {
                        // Bridge shim for ProjectService breakdown
                        const bridgeAgent = {
                            processInput: async (_uid: string, prompt: string) => {
                                const provider = this.providerOverride || ProviderFactory.getProvider(this.providerName);
                                const result = await provider.generateResponse(prompt, [], []);
                                return result.text;
                            }
                        };
                        await ProjectService.decomposeProject(projectId, input, bridgeAgent);
                        actionMessage = '📁 Projeto inicializado + ⚡ Plano de ação gerado';
                    } else {
                        actionMessage = '📁 Projeto inicializado';
                    }
                } else if (type === 'link') {
                    const urlMatch = input.match(/https?:\/\/[^\s]+/);
                    if (urlMatch) {
                        const result = await saveToRaindrop(urlMatch[0], input.replace(urlMatch[0], '').trim() || undefined);
                        if (result.ok) {
                            actionMessage = '🔖 Link salvo no Raindrop';
                        } else {
                            actionMessage = '🔒 Link capturado localmente';
                        }
                    }
                } else {
                    actionMessage = '🧠 Memória armazenada';
                }
            }
            return actionMessage;
        } catch (err: any) {
            logger.warn('agent.routing.failed', { requestId, error: err.message });
            return null;
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
      const messages = parsed.history.map(m => ({ role: m.role, content: m.content.trim() })) as Array<{ role: string; content: string; audioData?: string; mimeType?: string }>;
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
