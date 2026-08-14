import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = readdirSync('js').filter((f) => f.endsWith('.js'));
for (const f of files) {
  execFileSync(process.execPath, ['--input-type=module', '--check'], {
    input: readFileSync('js/' + f),
  });
}
console.log(`lint OK (${files.length} files)`);
