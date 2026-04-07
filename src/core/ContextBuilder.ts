import { AgentHistoryItem } from '@/contracts/agent';

export type ContextProfileEntry = { key: string; value: string };

export interface ContextBuilderInput {
  systemPrompt: string;
  profile?: ContextProfileEntry[];
  semanticContext?: string;
}

export class ContextBuilder {
  public build({ systemPrompt, profile = [], semanticContext = '' }: ContextBuilderInput): string {
    const blocks: string[] = [systemPrompt.trim()];
    const sortedProfile = [...profile]
      .filter((item) => item.key && item.value)
      .sort((a, b) => a.key.localeCompare(b.key));

    if (sortedProfile.length > 0) {
      blocks.push([
        '[MEMÓRIA DE PERFIL DO USUÁRIO]',
        ...sortedProfile.map((entry) => `- ${entry.key}: ${entry.value}`),
        '[FIM DA MEMÓRIA]',
      ].join('\n'));
    }

    if (semanticContext.trim()) {
      blocks.push(semanticContext.trim());
    }

    return blocks.filter(Boolean).join('\n\n');
  }

  public formatHistory(history: AgentHistoryItem[]): AgentHistoryItem[] {
    return history.map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
  }
}
