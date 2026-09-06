import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function findJs(dir) {
  let list = [];
  for (const item of readdirSync(dir)) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) {
      list = list.concat(findJs(full));
    } else if (item.endsWith('.js')) {
      list.push(full);
    }
  }
  return list;
}

const files = findJs('js');
for (const f of files) {
  execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
}
console.log(`lint OK (${files.length} files)`);

