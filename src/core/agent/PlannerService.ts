import { SpecService } from '@/core/spec/SpecService';
import type { DetectedIntent } from '@/core/planner/IntentDetector';
import { ActionPlanner, ActionPlan } from '@/core/planner/ActionPlanner';
import type { Skill } from '@/skills/SkillLoader';
import type { Tool } from '@/modules/tools/Tool';
import type { ExperimentVariant } from '@/core/experiments/ExperimentEngine';

export type PlannerServiceDeps = {
  actionPlanner?: ActionPlanner;
  validatePlan?: typeof SpecService.validatePlan;
};

export class PlannerService {
  private readonly actionPlanner: ActionPlanner;
  private readonly validatePlan: typeof SpecService.validatePlan;

  constructor(deps: PlannerServiceDeps = {}) {
    this.actionPlanner = deps.actionPlanner || new ActionPlanner();
    this.validatePlan = deps.validatePlan || SpecService.validatePlan;
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
