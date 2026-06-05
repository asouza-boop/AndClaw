import { AgentController } from '@/core/AgentController';
import { buildBatchInsert } from '@/db/utils';

export const agent = new AgentController();

export type SkillDiskRecord = {
  slug: string;
  title: string;
  description: string;
  allowedTools: string[];
  content: string;
};

export function parseSkillDocument(slug: string, content: string): SkillDiskRecord {
  let title = slug;
  let description = '';
  let allowedTools: string[] = [];
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    const toolsMatch = fm.match(/^allowed-tools:\s*(.+)$/m);
    if (nameMatch) title = nameMatch[1].trim();
    if (descMatch) description = descMatch[1].trim();
    if (toolsMatch) allowedTools = toolsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  }
  if (!description) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const heading = lines.find(l => l.startsWith('#'));
    if (heading) title = heading.replace(/^#+\s*/, '').trim();
    description = lines.find(l => !l.startsWith('#') && l.length > 20) || '';
  }
  return { slug, title, description, allowedTools, content };
}

export function inferActionItems(text: string) {
  const candidates = text
    .split(/\n+/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
  return candidates.map(item => ({ text: item, done: false }));
}

export function mapMeetingRow(meeting: any) {
  return {
    ...meeting,
    date: meeting.meeting_date,
    transcript: meeting.transcript_text,
    action_items: Array.isArray(meeting.action_items) ? meeting.action_items : [],
    decisions: Array.isArray(meeting.decisions) ? meeting.decisions : [],
    ideas: Array.isArray(meeting.ideas) ? meeting.ideas : [],
    key_points: Array.isArray(meeting.key_points) ? meeting.key_points : [],
    alerts: Array.isArray(meeting.alerts) ? meeting.alerts : [],
    tasks_future: Array.isArray(meeting.tasks_future) ? meeting.tasks_future : [],
    memory_highlights: Array.isArray(meeting.memory_highlights) ? meeting.memory_highlights : [],
    participants_identified: Array.isArray(meeting.participants_identified) ? meeting.participants_identified : [],
    skills_used: meeting.skills_used || [],
    participants: meeting.participants || [],
  };
}

export function maskLlmProvider(row: any) {
  if (!row) return row;
  const { api_key: _apiKey, ...safe } = row;
  return safe;
}

export async function upsertTags(
  query: <T = any>(text: string, params?: any[]) => Promise<T[]>,
  names: string[],
) {
  const unique = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (!unique.length) return new Map<string, number>();
  const idMap = new Map<string, number>();
  
  const rowsList = unique.map(name => [name]);
  const batch = buildBatchInsert('tags', ['name'], rowsList, 'ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name');
  
  await query('BEGIN');
  try {
    const rows = await query<{ id: number, name: string }>(batch.text, batch.values);
    for (const row of rows) {
      idMap.set(row.name, row.id);
    }
    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
  
  return idMap;
}

export async function setEntityTags(
  query: <T = any>(text: string, params?: any[]) => Promise<T[]>,
  entityType: string,
  entityId: string,
  tagNames: string[],
) {
  await query(`DELETE FROM entity_tags WHERE entity_type = $1 AND entity_id = $2`, [entityType, entityId]);
  const idMap = await upsertTags(query, tagNames);
  
  const rowsList = Array.from(idMap.entries()).map(([, tagId]) => [tagId, entityType, entityId]);
  if (rowsList.length > 0) {
    const batch = buildBatchInsert('entity_tags', ['tag_id', 'entity_type', 'entity_id'], rowsList, 'ON CONFLICT DO NOTHING');
    await query('BEGIN');
    try {
      await query(batch.text, batch.values);
      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }
}
