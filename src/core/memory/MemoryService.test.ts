import assert from 'assert';
import { MemoryService } from './MemoryService';
import { EmbeddingService } from './EmbeddingService';
import { config } from '@/config/env';
import * as postgres from '@/db/postgres';

async function testMemoryService() {
  console.log('Running MemoryService tests...');

  config.db.url = 'postgres://fake-db';
  const originalQuery = postgres.query;

  const mockEmbeddingService = new EmbeddingService();
  mockEmbeddingService.generateEmbedding = async () => new Array(1536).fill(0.1);
  
  const memoryService = new MemoryService(mockEmbeddingService);

  // 1. semanticSearch returns items ordered by cosine similarity
  const mockRows = [
    { id: 1, content: 'closest', similarity: 0.95 },
    { id: 2, content: 'farther', similarity: 0.70 }
  ];
  
  let queryCall = '';
  (postgres as any).query = async (sql: string) => {
    queryCall = sql;
    return mockRows;
  };

  const results = await memoryService.semanticSearch('query text', 2);
  
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].content, 'closest');
  assert.ok(queryCall.includes('ORDER BY embedding <=> $1::vector ASC'));
  assert.ok(queryCall.includes('1 - (embedding <=> $1::vector) AS similarity'));
  console.log('✅ semanticSearch returns items ordered by cosine similarity');

  // 2. semanticSearch skips items with null embedding
  (postgres as any).query = async (sql: string) => {
    queryCall = sql;
    return [];
  };

  await memoryService.semanticSearch('query text', 5);
  assert.ok(queryCall.includes('WHERE embedding IS NOT NULL'));
  console.log('✅ semanticSearch skips items with null embedding');

  (postgres as any).query = originalQuery;
}

testMemoryService().catch(e => {
  console.error('❌ MemoryService tests failed:', e);
  process.exit(1);
});

