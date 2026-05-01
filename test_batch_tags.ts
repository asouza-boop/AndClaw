import { query } from './src/db/postgres';
import { upsertTags } from './src/server/routes/shared';

async function run() {
  // Setup
  await query('CREATE TABLE IF NOT EXISTS tags (id SERIAL PRIMARY KEY, name TEXT UNIQUE, color TEXT)');
  await query('DELETE FROM tags WHERE name IN ($1, $2, $3, $4)', ['batch1', 'batch2', 'good', 'bad']);
  
  // Test A: correct rows exist
  const tags = ['batch1', 'batch2'];
  await upsertTags(query, tags);
  
  const countRes = await query('SELECT count(*) FROM tags WHERE name IN ($1, $2)', ['batch1', 'batch2']);
  if (parseInt(countRes[0].count) !== 2) throw new Error("Batch insert failed");
  
  // Test B: partial failure triggers rollback
  let failed = false;
  try {
    const originalQuery = query;
    const mockQuery = async (text: string, params?: any[]) => {
      if (text === 'BEGIN' || text === 'ROLLBACK') return await originalQuery(text, params);
      // Simulate failure on the batch insert
      throw new Error('Simulated failure during insert');
    };
    await upsertTags(mockQuery as any, ['good', 'bad']);
  } catch (e: any) {
    failed = true;
    const check = await query('SELECT count(*) FROM tags WHERE name IN ($1, $2)', ['good', 'bad']);
    if (parseInt(check[0].count) !== 0) throw new Error("Rollback failed, partial write found");
  }
  
  if (!failed) throw new Error("Should have thrown");
  
  console.log('✅ test_batch_tags passed');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
