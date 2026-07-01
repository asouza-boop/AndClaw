import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ToolRegistry } from './ToolRegistry';

async function main() {
  const originalCwd = process.cwd();
  const tmpRoot = path.join(originalCwd, 'tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(tmpRoot, 'tool-registry-'));
  const registry = new ToolRegistry();

  try {
    fs.writeFileSync(path.join(tmpDir, 'ok.txt'), 'hello', 'utf-8');
    const relativeTmpDir = path.relative(originalCwd, tmpDir);

    const readTool = registry.getTool('read_file');
    const writeTool = registry.getTool('write_file');
    const lsTool = registry.getTool('ls');
    assert(readTool && writeTool && lsTool);

    assert.strictEqual(await readTool!.execute({ path: `${relativeTmpDir}/ok.txt` }), 'hello');
    assert.match(await writeTool!.execute({ path: `${relativeTmpDir}/nested/new.txt`, content: 'x' }), /sucesso/);
    assert.strictEqual(fs.readFileSync(path.join(tmpDir, 'nested/new.txt'), 'utf-8'), 'x');
    assert.match(await readTool!.execute({ path: '../../outside.txt' }), /bloqueado|fora do workspace/i);
    assert.match(await lsTool!.execute({ path: '../../' }), /bloqueado|fora do workspace/i);

    console.log('✅ ToolRegistry workspace guard test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌ ToolRegistry test failed:', error);
  process.exit(1);
});
