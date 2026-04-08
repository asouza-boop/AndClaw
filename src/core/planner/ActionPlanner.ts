import type { Tool } from '@/modules/tools/Tool';
import type { DetectedIntent, IntentName } from './IntentDetector';
import type { Skill } from '@/skills/SkillLoader';

export type ActionPlanStep = {
  tool: string;
  inputKey: string;
  outputKey: string;
};

export type SkillActionPlan = {
  type: 'skill';
  intent: IntentName;
  skill: string;
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
  public plan(intent: DetectedIntent, tools: Tool[], skills: Skill[] = []): ActionPlan | null {
    const toolList = Array.isArray(tools) ? tools : [];
    const skillList = Array.isArray(skills) ? skills : [];
    const matchedSkillName = this.resolveSkill(intent, skillList);

    if (matchedSkillName) {
      return {
        type: 'skill',
        intent: intent.name,
        skill: matchedSkillName,
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

  private resolveSkill(intent: DetectedIntent, skills: Skill[]): string | null {
    const desiredSkillName = INTENT_TO_SKILL[intent.name];
    if (!desiredSkillName) return null;

    const matchedSkill = skills.find((skill) => skill.metadata.name === desiredSkillName);
    return matchedSkill?.metadata.name || null;
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
