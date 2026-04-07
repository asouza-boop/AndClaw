import type { Tool } from '@/modules/tools/Tool';
import type { DetectedIntent, IntentName } from './IntentDetector';

export type ActionPlanStep = {
  tool: string;
  inputKey: string;
  outputKey: string;
};

export type ActionPlan = {
  intent: IntentName;
  steps: ActionPlanStep[];
};

function hasTool(tools: Tool[], name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

function truthy(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

export class ActionPlanner {
  public plan(intent: DetectedIntent, tools: Tool[]): ActionPlan | null {
    const toolList = Array.isArray(tools) ? tools : [];
    const steps = this.buildSteps(intent, toolList);
    if (!steps.length || steps.length > 2) return null;
    return {
      intent: intent.name,
      steps,
    };
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

