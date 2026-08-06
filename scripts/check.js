import { readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const files = ['bin/odtu.js'];
for (const directory of ['src', 'src/commands']) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(join(directory, entry.name));
  }
}

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax checked ${files.length} files.`);
