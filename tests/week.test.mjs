// Week helper: the pure core and the CLI as the skill would run it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (...args) => spawnSync(process.execPath, ['scripts/week.mjs', ...args], { encoding: 'utf8' });

test('tracer: 2026-10-16 gives the sample window and week id through the CLI', () => {
  const r = run('--today', '2026-10-16', '--json');
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.today, '2026-10-16');
  assert.equal(out.isFriday, true);
  assert.deepEqual(out.window, { from: '2026-10-09', to: '2026-10-16' });
  assert.equal(out.weekId, '2026-W42');
  assert.equal(out.previous, null);
});

test('without --today the window ends on a Friday', () => {
  const r = run('--json');
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.match(out.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${out.window.to}T00:00:00Z`).getUTCDay(), 5);
});

test('package.json has the week script, an unchanged check script and no dependencies', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.week, 'node scripts/week.mjs');
  assert.equal(pkg.scripts.check, 'npm test && npm run validate && npm run lint:design');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
