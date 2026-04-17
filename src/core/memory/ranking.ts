import { SemanticMemoryRecord } from '@/core/memory/MemoryService';

export interface RankedSemanticMemory extends SemanticMemoryRecord {
  similarityScore: number;
  recencyScore: number;
  rankScore: number;
}

function parseTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recencyScore(createdAt?: string | null, now = Date.now()): number {
  const timestamp = parseTimestamp(createdAt);
  if (!timestamp) return 0;
  const ageHours = Math.max(0, (now - timestamp) / (1000 * 60 * 60));
  return 1 / (1 + ageHours / 24);
}

export function rankSemanticMemories(
  records: SemanticMemoryRecord[],
  options: { now?: number; limit?: number; similarityWeight?: number; recencyWeight?: number } = {},
): RankedSemanticMemory[] {
  const now = options.now ?? Date.now();
  const similarityWeight = options.similarityWeight ?? 1;
  const recencyWeight = options.recencyWeight ?? 0.15;
  const limit = options.limit ?? records.length;

  const ranked = records
    .filter((record) => Boolean(record.content?.trim()))
    .map((record) => {
      const similarity = Number.isFinite(record.distance) ? Number(record.distance) : Number.POSITIVE_INFINITY;
      const recency = recencyScore(record.created_at, now);
      
      // Memory type bias (lower is better)
      let typeBias = 0;
      if (record.memory_type === 'problem_solution') typeBias = -0.1;
      else if (record.memory_type === 'operational') typeBias = -0.05;

      return {
        ...record,
        similarityScore: similarity,
        recencyScore: recency,
        rankScore: (similarity * similarityWeight) - (recency * recencyWeight) + typeBias,
      };
    })
    .sort((a, b) => {
      if (a.rankScore !== b.rankScore) return a.rankScore - b.rankScore;
      if (a.similarityScore !== b.similarityScore) return a.similarityScore - b.similarityScore;
      const aTs = parseTimestamp(a.created_at);
      const bTs = parseTimestamp(b.created_at);
      if (aTs !== bTs) return bTs - aTs;
      return (b.id || 0) - (a.id || 0);
    });

  const seen = new Set<string>();
  const deduped: RankedSemanticMemory[] = [];
  for (const record of ranked) {
    const key = `${record.source_type || ''}:${record.source_id || ''}:${record.content.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
    if (deduped.length >= limit) break;
  }

  return deduped;
}
