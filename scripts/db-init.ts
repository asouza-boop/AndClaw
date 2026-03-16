import { ensureSchema } from '../src/db/schema';

async function main() {
  await ensureSchema();
  console.log('[db:init] Schema ensured.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[db:init] Failed:', err);
  process.exit(1);
});
