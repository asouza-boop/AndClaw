import { SpecService } from '@/core/spec/SpecService';
import type { DetectedIntent } from '@/core/planner/IntentDetector';
import { ActionPlanner, ActionPlan } from '@/core/planner/ActionPlanner';
import type { Skill } from '@/skills/SkillLoader';
import type { Tool } from '@/modules/tools/Tool';
import type { ExperimentVariant } from '@/core/experiments/ExperimentEngine';
import type { MemoryService } from '@/core/memory/MemoryService';

export type PlannerServiceDeps = {
  actionPlanner?: ActionPlanner;
  validatePlan?: typeof SpecService.validatePlan;
  memoryService?: MemoryService;
};

export class PlannerService {
  private readonly actionPlanner: ActionPlanner;
  private readonly validatePlan: typeof SpecService.validatePlan;
  private readonly memoryService?: MemoryService;

  constructor(deps: PlannerServiceDeps = {}) {
    this.actionPlanner = deps.actionPlanner || new ActionPlanner();
    this.validatePlan = deps.validatePlan || SpecService.validatePlan.bind(SpecService);
    this.memoryService = deps.memoryService;
  }

  public async getPlanningContext(userMessage: string, limit = 5): Promise<string> {
    if (!this.memoryService) return '';
    const results = await this.memoryService.semanticSearch(userMessage, limit);
    if (!results || results.length === 0) return '';
    
    return [
      '[CONTEXTO DA MEMÓRIA SEMÂNTICA]',
      ...results.map((memory, index) => `${index + 1}. ${memory.type}: ${memory.content}`),
      '[FIM DO CONTEXTO]'
    ].join('\n');
  }

  public plan(
    intent: DetectedIntent,
    tools: Tool[],
    skills: Skill[] = [],
    variant: ExperimentVariant = 'A',
  ): ActionPlan | null {
    return this.actionPlanner.plan(intent, tools, skills, variant);
  }

  public validate(toolCalls: Array<{ name: string; arguments?: unknown }>): ReturnType<typeof SpecService.validatePlan> {
    return this.validatePlan(toolCalls);
  }
}
