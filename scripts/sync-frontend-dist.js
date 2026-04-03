const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'frontend', 'dist');
const publicDir = path.join(projectRoot, 'public');

if (!fs.existsSync(distDir)) {
  throw new Error(`Frontend build output not found: ${distDir}`);
}

fs.mkdirSync(publicDir, { recursive: true });

for (const entry of fs.readdirSync(publicDir)) {
  fs.rmSync(path.join(publicDir, entry), { recursive: true, force: true });
}

for (const entry of fs.readdirSync(distDir)) {
  fs.cpSync(path.join(distDir, entry), path.join(publicDir, entry), { recursive: true });
}

console.log(`Synced ${distDir} -> ${publicDir}`);
