// Validates quizzes/index.json and every set it lists (used by `npm run validate`).
// Exit 0 when all pass, 1 when any check fails.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (file) => spawnSync(process.execPath, ['scripts/validate-quiz.mjs', file], { cwd: ROOT, stdio: 'inherit' }).status;

let failed = run('quizzes/index.json') !== 0;
let index = [];
try {
  index = JSON.parse(readFileSync(new URL('../quizzes/index.json', import.meta.url), 'utf8').replace(/^﻿/, ''));
} catch {
  failed = true;
}
for (const entry of Array.isArray(index) ? index : []) {
  if (entry && typeof entry.file === 'string' && run(entry.file) !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
