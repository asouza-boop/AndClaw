import type { Tool } from '@/modules/tools/Tool';
import type { DetectedIntent, IntentName } from './IntentDetector';
import type { Skill } from '@/skills/SkillLoader';
import { config } from '@/config/env';
import { logger } from '@/infra/logger';
import { OptimizationEngine } from '../learning/OptimizationEngine';
import { ParameterStore } from '../optimization/ParameterStore';
import type { ExperimentVariant } from '../experiments/ExperimentEngine';

export type ActionPlanStep = {
  tool: string;
  inputKey: string;
  outputKey: string;
};

export type SkillActionPlan = {
  type: 'skill';
  intent: IntentName;
  skills: string[]; // Prioritized list of candidate skills
};

export type ToolActionPlan = {
  type: 'tool';
  intent: IntentName;
  steps: ActionPlanStep[];
};

export type ActionPlan = SkillActionPlan | ToolActionPlan;

function hasTool(tools: Tool[], name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

function truthy(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

const INTENT_TO_SKILL: Partial<Record<IntentName, string>> = {
  'profile.upsert': 'user-profiling',
  'profile.delete': 'user-profiling',
  'notion.create_page': 'notion-sync',
  'notion.append_block': 'notion-sync',
};

export class ActionPlanner {
  public plan(intent: DetectedIntent, tools: Tool[], skills: Skill[] = [], variant: ExperimentVariant = 'A'): ActionPlan | null {
    const toolList = Array.isArray(tools) ? tools : [];
    const skillList = Array.isArray(skills) ? skills : [];
    const matchedSkillNames = this.resolveSkills(intent, skillList);
    const prioritizedSkills = this.sortSkills(matchedSkillNames, skillList, intent.requestId, variant);

    if (prioritizedSkills.length > 0) {
      return {
        type: 'skill',
        intent: intent.name,
        skills: prioritizedSkills,
      };
    }

    const steps = this.buildSteps(intent, toolList);
    if (!steps.length || steps.length > 2) return null;
    return {
      type: 'tool',
      intent: intent.name,
      steps,
    };
  }

  private resolveSkills(intent: DetectedIntent, skills: Skill[]): string[] {
    const desiredByMapping = INTENT_TO_SKILL[intent.name];
    
    // Find all skills that have this intent in their triggers OR match the static mapping
    const candidates = skills.filter((skill) => {
      const matchTrigger = skill.metadata.intentTriggers?.includes(intent.name);
      const matchMapping = desiredByMapping === skill.metadata.name;
      const isEnabled = skill.metadata.plannerEnabled !== false;
      const isActive = skill.metadata.status !== 'experimental';
      
      return (matchTrigger || matchMapping) && isEnabled && isActive;
    });

    // Return unique names, preserving some notion of original priority (metadata.priority)
    return Array.from(new Set(
      candidates
        .sort((a, b) => (b.metadata.priority || 0) - (a.metadata.priority || 0))
        .map(s => s.metadata.name)
    ));
  }

  /**
   * Reorders candidate skills based on performance metrics if Optimization is enabled.
   */
  private sortSkills(skillNames: string[], availableSkills: Skill[], requestId?: string, variant: ExperimentVariant = 'A'): string[] {
    // Strategy A: Baseline (Current status-quo logic: keep metadata priority)
    if (variant === 'A') {
      return skillNames;
    }

    // Strategy B: Optimized (Prioritize successRate and Latency)
    if (!config.learning.enabled || config.learning.mode !== 'safe') {
      return skillNames;
    }

    if (skillNames.length <= 1) return skillNames;

    const originalOrder = [...skillNames];
    
    const candidatesWithScores = skillNames.map(name => {
      const scoreData = OptimizationEngine.getScore(name);
      // Safety Limit: only use score if usageCount > 5
      const hasEnoughData = scoreData && scoreData.usageCount > 5;
      
      let finalScore = 0;
      if (hasEnoughData) {
        const successWeight = ParameterStore.get('plannerBias');
        const latencyWeight = 1 - successWeight;
        const latencySec = Math.max(0.1, scoreData.avgLatencyMs / 1000);
        finalScore = (scoreData.successRate * successWeight) + (latencyWeight * (1 / latencySec));
      }

      return { name, score: finalScore, hasEnoughData };
    });

    // Only sort those that have enough data, keeping the rest in their original priority at the end
    const sortedNames = candidatesWithScores
      .sort((a, b) => {
        if (a.hasEnoughData && b.hasEnoughData) return b.score - a.score;
        if (a.hasEnoughData) return -1;
        if (b.hasEnoughData) return 1;
        return 0; // maintain relative original order
      })
      .map(item => item.name);

    const changed = JSON.stringify(originalOrder) !== JSON.stringify(sortedNames);
    if (changed) {
      logger.info('planner.optimized', {
        requestId,
        originalOrder,
        optimizedOrder: sortedNames,
        selectedSkill: sortedNames[0],
      });
    }

    return sortedNames;
  }

  private buildSteps(intent: DetectedIntent, tools: Tool[]): ActionPlanStep[] {
    const slots = intent.slots || {};

    switch (intent.name) {
      case 'profile.upsert': {
        if (!hasTool(tools, 'update_user_profile')) return [];
        if (!truthy(slots.key) || !truthy(slots.value)) return [];
        return [
          {
            tool: 'update_user_profile',
            inputKey: 'profilePayload',
            outputKey: 'profileResult',
          },
        ];
      }
      case 'profile.delete': {
        if (!hasTool(tools, 'delete_user_profile')) return [];
        if (!truthy(slots.key)) return [];
        return [
          {
            tool: 'delete_user_profile',
            inputKey: 'profileDeletePayload',
            outputKey: 'profileDeleteResult',
          },
        ];
      }
      case 'filesystem.list': {
        if (!hasTool(tools, 'ls')) return [];
        return [
          {
            tool: 'ls',
            inputKey: 'path',
            outputKey: 'directoryListing',
          },
        ];
      }
      case 'filesystem.read': {
        if (!hasTool(tools, 'read_file')) return [];
        if (!truthy(slots.path)) return [];
        return [
          {
            tool: 'read_file',
            inputKey: 'path',
            outputKey: 'fileContent',
          },
        ];
      }
      case 'filesystem.write': {
        if (!hasTool(tools, 'write_file')) return [];
        if (!truthy(slots.path) || !truthy(slots.content)) return [];
        return [
          {
            tool: 'write_file',
            inputKey: 'writePayload',
            outputKey: 'writeResult',
          },
        ];
      }
      case 'filesystem.search': {
        if (!hasTool(tools, 'glob') || !hasTool(tools, 'read_file')) return [];
        if (!truthy(slots.pattern)) return [];
        return [
          {
            tool: 'glob',
            inputKey: 'pattern',
            outputKey: 'matches',
          },
          {
            tool: 'read_file',
            inputKey: 'matches',
            outputKey: 'searchContent',
          },
        ];
      }
      case 'notion.create_page': {
        if (!hasTool(tools, 'notion_api')) return [];
        if (!truthy(slots.title) && !truthy(slots.content)) return [];
        return [
          {
            tool: 'notion_api',
            inputKey: 'notionPayload',
            outputKey: 'notionResult',
          },
        ];
      }
      case 'notion.append_block': {
        if (!hasTool(tools, 'notion_api')) return [];
        if (!truthy(slots.content)) return [];
        return [
          {
            tool: 'notion_api',
            inputKey: 'notionPayload',
            outputKey: 'notionResult',
          },
        ];
      }
      default:
        return [];
    }
  }
}
