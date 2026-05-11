import { startServer } from './src/server';
import { ensureSchema } from './src/db/schema';
console.log('Testing schema');
ensureSchema().then(() => console.log('Schema done')).catch(e => console.error(e));
