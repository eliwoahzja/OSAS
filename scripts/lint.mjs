import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = readdirSync('js').filter((f) => f.endsWith('.js'));
for (const f of files) {
  execFileSync(process.execPath, ['--check', 'js/' + f], { stdio: 'inherit' });
}
console.log(`lint OK (${files.length} files)`);
