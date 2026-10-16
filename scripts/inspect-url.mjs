#!/usr/bin/env node
// Runs the design inspector against a served page that needs a query string (the graded design-review view).
//   node scripts/inspect-url.mjs "quiz.html?set=2026-W42&review=graded" [inspect.mjs flags]
// inspect.mjs on a file path cannot carry a query string, so this starts scripts/serve.mjs on INSPECT_PORT (default 8097),
// waits until it answers, inspects http://127.0.0.1:PORT/<path>, always stops the server and exits with the inspector's code.
// Exit 2: bad usage or the server never answered.
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [target, ...flags] = process.argv.slice(2);
if (!target || target.startsWith('--')) {
  console.error('usage: node scripts/inspect-url.mjs <path-with-query> [inspect.mjs flags]');
  process.exit(2);
}

const port = Number(process.env.INSPECT_PORT || 8097);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function answers() {
  try {
    return (await fetch(`${base}/quizzes/index.json`)).status === 200;
  } catch {
    return false;
  }
}

const server = spawn(process.execPath, [join(root, 'scripts', 'serve.mjs'), String(port)], { stdio: ['ignore', 'ignore', 'ignore'] });
let code = 2;
try {
  const until = Date.now() + 5000;
  let up = false;
  while (Date.now() < until && !up) {
    up = await answers();
    if (!up) await sleep(100);
  }
  if (!up) {
    console.error(`scripts/serve.mjs did not answer on port ${port} within 5 seconds`);
  } else {
    const inspector = join(root, '.claude', 'skills', 'design-taste-frontend', 'scripts', 'inspect.mjs');
    const url = `${base}/${target.replace(/^\//, '')}`;
    code = await new Promise((done) => {
      const child = spawn(process.execPath, [inspector, url, ...flags], { stdio: 'inherit', cwd: root });
      child.on('exit', (c) => done(c ?? 1));
      child.on('error', () => done(2));
    });
  }
} finally {
  server.kill();
}
process.exit(code);
