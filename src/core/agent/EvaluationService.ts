import { AgentEvaluator } from '@/core/evaluation/AgentEvaluator';
import { FeedbackCollector, FeedbackEntry, OptimizationEngine } from '@/core/learning/OptimizationEngine';
import type { ExperimentVariant } from '@/core/experiments/ExperimentEngine';

export type EvaluationServiceMetrics = {
  success: boolean;
  latencyMs: number;
  toolUsageCount: number;
  errorCount: number;
  totalIterations: number;
  isFallback?: boolean;
};

export type EvaluationServiceDeps = {
  evaluateRun?: typeof AgentEvaluator.evaluateRun;
  collect?: typeof FeedbackCollector.collect;
  processFeedback?: typeof OptimizationEngine.processFeedback;
};

export type EvaluationServiceRecordOptions = {
  backgroundSafe?: boolean;
  processOptimization?: boolean;
};

export class EvaluationService {
  constructor(private readonly deps: EvaluationServiceDeps = {}) {}

  public recordRun(
    metrics: EvaluationServiceMetrics,
    variant: ExperimentVariant = 'A',
    feedbackEntry?: FeedbackEntry,
    options: EvaluationServiceRecordOptions = {},
  ): void {
    const evaluateRun = this.deps.evaluateRun || ((metrics: EvaluationServiceMetrics, activeVariant: ExperimentVariant) => {
      AgentEvaluator.evaluateRun(metrics, activeVariant);
    });
    const collect = this.deps.collect || ((entry: FeedbackEntry) => {
      FeedbackCollector.collect(entry);
    });
    const processFeedback = this.deps.processFeedback || ((entry: FeedbackEntry) => {
      OptimizationEngine.processFeedback(entry);
    });
    const backgroundSafe = options.backgroundSafe !== false;
    const processOptimization = options.processOptimization !== false;

    evaluateRun(metrics, variant);

    if (!feedbackEntry) return;

    const collectFeedback = () => {
      collect(feedbackEntry);
      if (processOptimization) {
        processFeedback(feedbackEntry);
      }
    };

    if (backgroundSafe) {
      try {
        collectFeedback();
      } catch {
        // Background-safe: telemetry errors must never break the agent
      }
      return;
    }

    collectFeedback();
  }

  public evaluateStep(toolName: string, result: unknown): { passed: boolean; reason?: string } {
    const stringifiedResult = typeof result === 'string' ? result : JSON.stringify(result);
    const lowercaseResult = stringifiedResult.toLowerCase();
    
    const blockedKeywords = ['error', 'unauthorized', 'blocked', 'forbidden'];
    for (const keyword of blockedKeywords) {
      if (lowercaseResult.includes(keyword)) {
        return { passed: false, reason: `Detecção de termo restrito no resultado: ${keyword}` };
      }
    }
    
    // Blocked tools list - currently empty as per spec
    const blockedTools: string[] = [];
    if (blockedTools.includes(toolName)) {
      return { passed: false, reason: `Ferramenta bloqueada pela governança: ${toolName}` };
    }
    
    return { passed: true };
  }
}
