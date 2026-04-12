import type { AgentHistoryItem } from '@/contracts/agent';

export type IntentName =
  | 'profile.upsert'
  | 'profile.delete'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'filesystem.list'
  | 'filesystem.search'
  | 'notion.create_page'
  | 'notion.append_block';

export type DetectedIntent = {
  name: IntentName;
  confidence: number;
  reason: string;
  slots: Record<string, string>;
  requestId?: string;
};

type DetectorInput = {
  input: string;
  history?: AgentHistoryItem[];
};

function normalizeText(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractPathCandidate(text: string): string | null {
  const quoted = firstMatch(text, [/"([^"]+\.[\w-]+)"/, /'([^']+\.[\w-]+)'/]);
  if (quoted) return quoted;

  const explicitPath = firstMatch(text, [
    /\b([./]?[a-z0-9_\-./]+\.[a-z0-9]+)\b/i,
    /\b((?:[a-z0-9_\-]+\/)+[a-z0-9_\-./]+\.[a-z0-9]+)\b/i,
  ]);
  if (explicitPath) return explicitPath;

  const fallback = firstMatch(text, [
    /\b(?:arquivo|file|path|caminho|pasta|folder)\s+(?:de\s+)?([a-z0-9_\-./*?]+\.[a-z0-9]+)\b/i,
    /\b(?:arquivo|file|path|caminho|pasta|folder)\s+([a-z0-9_\-./*?]+)\b/i,
  ]);
  return fallback;
}

function extractKeyValue(text: string): { key?: string; value?: string } {
  const explicit = text.match(/\b([a-z0-9_\-]+)\s*(?:=|:|é|eh)\s*(.+)$/i);
  if (explicit?.[1] && explicit?.[2]) {
    return { key: explicit[1].trim(), value: explicit[2].trim() };
  }

  const nome = firstMatch(text, [
    /\bmeu nome (?:é|eh)\s+(.+)$/i,
    /\bnome (?:é|eh)\s+(.+)$/i,
  ]);
  if (nome) return { key: 'nome', value: nome };

  const preference = firstMatch(text, [
    /\b(prefiro|quero|gosto de)\s+(.+)$/i,
  ]);
  if (preference) return { key: 'preferencia', value: preference };

  return {};
}

function extractNotionTitle(text: string): string | undefined {
  return firstMatch(text, [
    /\b(?:titulo|título|title)\s*(?:é|:|=)\s*"([^"]+)"/i,
    /\b(?:titulo|título|title)\s*(?:é|:|=)\s*'([^']+)'/i,
    /\b(?:titulo|título|title)\s*(?:é|:|=)\s*(.+)$/i,
    /\b(?:crie|criar|nova|novo)\s+(?:pagina|página)\s+(?:para\s+)?(.+)$/i,
  ]) || undefined;
}

function extractContent(text: string): string | undefined {
  return firstMatch(text, [
    /\b(?:conteudo|conteúdo|content)\s*(?:é|:|=)\s*"([^"]+)"/i,
    /\b(?:conteudo|conteúdo|content)\s*(?:é|:|=)\s*'([^']+)'/i,
    /\b(?:conteudo|conteúdo|content)\s*(?:é|:|=)\s*(.+)$/i,
  ]) || undefined;
}

export class IntentDetector {
  public detect(input: string, _history: AgentHistoryItem[] = []): DetectedIntent | null {
    const text = normalizeText(input);
    if (!text) return null;

    const path = extractPathCandidate(text) || '';
    const keyValue = extractKeyValue(text);
    const title = extractNotionTitle(text);
    const content = extractContent(text);

    if (/\bnotion\b/.test(text)) {
      if (/\b(listar|mostrar|ver|quais)\b/.test(text)) {
        return {
          name: 'notion.append_block',
          confidence: 0.82,
          reason: 'notion reference with listing/append wording',
          slots: {
            action: 'list_pages',
            title: title || 'Itens do Notion',
            content: content || '',
          },
        };
      }

      if (/\b(adicionar|inserir|append|acrescentar|anexar|bloco|block)\b/.test(text)) {
        return {
          name: 'notion.append_block',
          confidence: 0.91,
          reason: 'notion append wording',
          slots: {
            action: 'append_block',
            title: title || 'Insight',
            content: content || input,
          },
        };
      }

      return {
        name: 'notion.create_page',
        confidence: 0.9,
        reason: 'notion reference with create wording',
        slots: {
          action: 'create_page',
          title: title || 'Nova Página',
          content: content || input,
        },
      };
    }

    if (/\b(perfil|perfil do usuario|profile|preferencia|preferencias)\b/.test(text)) {
      if (/\b(remover|apagar|deletar|delete|esquecer|forget)\b/.test(text)) {
        const key = keyValue.key || path || firstMatch(text, [
          /\b(?:perfil|chave|campo)\s+(?:de\s+)?([a-z0-9_\-]+)/i,
        ]) || '';
        if (!key) return null;
        return {
          name: 'profile.delete',
          confidence: 0.93,
          reason: 'profile deletion wording',
          slots: { key },
        };
      }

      let key = keyValue.key || 'preferencia';
      let value = keyValue.value || extractContent(text) || firstMatch(text, [
        /\b(?:atualize|salve|defina|registre|adicione)\s+(?:meu\s+)?perfil\s+(?:com\s+)?(.+)$/i,
        /\b(?:meu nome é|nome é)\s+(.+)$/i,
      ]) || '';
      if (/\blinguagem\b/.test(text)) {
        key = 'linguagem_favorita';
        value = firstMatch(text, [
          /\blinguagem(?: favorita| preferida)?\s*(?:é|eh|:|=)?\s*(.+)$/i,
          /\bcom linguagem\s+(.+)$/i,
        ]) || value;
      } else if (/\bemail\b/.test(text)) {
        key = 'email';
      } else if (/\bnome\b/.test(text)) {
        key = 'nome';
      }
      if (!value) return null;

      return {
        name: 'profile.upsert',
        confidence: 0.95,
        reason: 'profile update wording',
        slots: { key, value },
      };
    }

    if (/\b(arquivo|file|path|caminho|pasta|folder|diretorio|diretório|dir)\b/.test(text)) {
      if (/\b(escreva|escrever|salve|gravar|crie|criar|write|generate)\b/.test(text)) {
        if (!path && !content) return null;
        return {
          name: 'filesystem.write',
          confidence: 0.86,
          reason: 'filesystem write wording',
          slots: {
            path,
            content: content || input,
          },
        };
      }

      if (/\b(listar|liste|mostre|exiba|mostrar)\b/.test(text)) {
        return {
          name: 'filesystem.list',
          confidence: 0.88,
          reason: 'filesystem listing wording',
          slots: { path: path || '.' },
        };
      }

      if (/\b(procure|buscar|busque|encontre|grep|glob|search)\b/.test(text)) {
        const pattern = path || firstMatch(text, [
          /\b(?:por|sobre|com)\s+([a-z0-9_\-./*?]+\.[a-z0-9]+)\b/i,
          /\b(?:por|sobre|com)\s+(.+)$/i,
        ]) || '';
        if (!pattern) return null;
        return {
          name: 'filesystem.search',
          confidence: 0.9,
          reason: 'filesystem search wording',
          slots: { pattern },
        };
      }

      const readPath = path || firstMatch(text, [
        /\b(?:leia|ler|abra|open|mostre o conteudo|mostre o conteúdo)\s+(?:do\s+)?(.+)$/i,
      ]) || '';
      if (!readPath) return null;
      return {
        name: 'filesystem.read',
        confidence: 0.84,
        reason: 'filesystem read wording',
        slots: { path: readPath },
      };
    }

    return null;
  }
}
