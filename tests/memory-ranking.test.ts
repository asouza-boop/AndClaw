import assert from 'node:assert/strict';
import test from 'node:test';
import { rankSemanticMemories } from '@/core/memory/ranking';

test('rankSemanticMemories prioritizes relevance and recency deterministically', () => {
  const now = Date.parse('2026-04-07T12:00:00.000Z');
  const ranked = rankSemanticMemories([
    {
      id: 1,
      type: 'meeting',
      content: 'decisão de produto',
      created_at: '2026-04-01T12:00:00.000Z',
      distance: 0.22,
      source_type: 'meeting',
      source_id: 'm1',
    },
    {
      id: 2,
      type: 'meeting',
      content: 'decisão de produto',
      created_at: '2026-04-07T11:00:00.000Z',
      distance: 0.22,
      source_type: 'meeting',
      source_id: 'm1',
    },
    {
      id: 3,
      type: 'note',
      content: 'assunto distante',
      created_at: '2026-04-07T11:00:00.000Z',
      distance: 0.91,
      source_type: 'note',
      source_id: 'n1',
    },
  ], { now, limit: 3 });

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 2);
  assert.equal(ranked[1].id, 3);
  assert.ok(ranked[0].rankScore < ranked[1].rankScore);
});
