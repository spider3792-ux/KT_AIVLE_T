// Week helper: the pure core and the CLI as the skill would run it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addDays,
  buildReport,
  computeWindow,
  fridayOnOrBefore,
  isoWeekId,
  kstToday,
  pickPreviousSet,
  usedSources,
} from '../scripts/lib/week-core.mjs';

const run = (...args) => spawnSync(process.execPath, ['scripts/week.mjs', ...args], { encoding: 'utf8' });
const tmp = mkdtempSync(join(tmpdir(), 'srq-week-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

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

test('isoWeekId vectors', () => {
  for (const [d, id] of [
    ['2026-10-16', '2026-W42'],
    ['2026-10-09', '2026-W41'],
    ['2027-01-01', '2026-W53'],
    ['2026-12-31', '2026-W53'],
    ['2027-01-08', '2027-W01'],
    ['2020-01-03', '2020-W01'],
    ['2026-01-02', '2026-W01'],
  ]) assert.equal(isoWeekId(d), id, d);
});

test('kstToday follows Korea, not UTC', () => {
  for (const [iso, d] of [
    ['2026-10-16T14:59:59Z', '2026-10-16'],
    ['2026-10-16T15:00:00Z', '2026-10-17'],
    ['2026-10-15T15:00:00Z', '2026-10-16'],
    ['2026-10-15T14:59:59.999Z', '2026-10-15'],
  ]) assert.equal(kstToday(Date.parse(iso)), d, iso);
});

test('addDays and fridayOnOrBefore', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(fridayOnOrBefore('2026-10-16'), '2026-10-16');
  assert.equal(fridayOnOrBefore('2026-10-15'), '2026-10-09');
  assert.equal(fridayOnOrBefore('2026-10-18'), '2026-10-16');
});

test('computeWindow table', () => {
  for (const [today, from, to, weekId, isFriday] of [
    ['2026-10-16', '2026-10-09', '2026-10-16', '2026-W42', true],
    ['2026-10-17', '2026-10-09', '2026-10-16', '2026-W42', false],
    ['2026-10-19', '2026-10-09', '2026-10-16', '2026-W42', false],
    ['2026-10-22', '2026-10-09', '2026-10-16', '2026-W42', false],
    ['2026-10-23', '2026-10-16', '2026-10-23', '2026-W43', true],
    ['2027-01-01', '2026-12-25', '2027-01-01', '2026-W53', true],
    ['2027-01-04', '2026-12-25', '2027-01-01', '2026-W53', false],
    ['2027-01-08', '2027-01-01', '2027-01-08', '2027-W01', true],
    ['2028-02-29', '2028-02-18', '2028-02-25', '2028-W08', false],
    ['2026-11-02', '2026-10-23', '2026-10-30', '2026-W44', false],
  ]) assert.deepEqual(computeWindow(today), { today, isFriday, from, to, weekId }, today);
});

test('weekend entries roll forward to the next Friday window', () => {
  const a = computeWindow('2026-10-17');
  for (const d of ['2026-10-17', '2026-10-18']) assert.ok(d > a.to, d);
  const b = computeWindow('2026-10-23');
  for (const d of ['2026-10-17', '2026-10-18']) assert.ok(d >= b.from && d <= b.to, d);
});

test('computeWindow rejects bad dates with the Korean stem', () => {
  for (const bad of ['2026-02-30', 'abc', undefined]) {
    assert.throws(() => computeWindow(bad), /날짜 형식이 올바르지 않습니다/);
  }
});

test('pickPreviousSet takes the newest id strictly below the target, whatever the order', () => {
  const idx = [{ id: '2026-W41' }, { id: '2026-W43' }, { id: '2026-W42' }, { title: 'no id' }, { id: 7 }];
  assert.equal(pickPreviousSet(idx, '2026-W43').id, '2026-W42');
  assert.equal(pickPreviousSet(idx, '2026-W42').id, '2026-W41');
  assert.equal(pickPreviousSet(idx, '2026-W41'), null);
  assert.equal(pickPreviousSet([{ id: '2026-W53' }, { id: '2026-W52' }], '2027-W01').id, '2026-W53');
  assert.equal(pickPreviousSet([], '2026-W42'), null);
});

test('usedSources keeps author, date and title only', () => {
  const set = {
    sources: [
      { id: 's1', author: 'A', date: '2026-10-13', title: 'T', subject: 'S' },
      { id: 's2', author: 'B' },
      { author: 'C', date: '2026-10-14', title: 'U' },
    ],
  };
  assert.deepEqual(usedSources(set), [
    { author: 'A', date: '2026-10-13', title: 'T' },
    { author: 'C', date: '2026-10-14', title: 'U' },
  ]);
  assert.deepEqual(usedSources({}), []);
  assert.deepEqual(usedSources(null), []);
});

test('buildReport: previous set, notes and re-make behaviour', () => {
  const index = [
    { id: '2026-W41', title: 'W41 set', file: 'quizzes/2026-W41.json' },
    { id: '2026-W42', title: 'W42 set', file: 'quizzes/2026-W42.json' },
  ];
  const sets = {
    'quizzes/2026-W41.json': { sources: [{ author: 'A', date: '2026-10-06', title: 'one' }] },
    'quizzes/2026-W42.json': { sources: [{ author: 'B', date: '2026-10-13', title: 'two' }] },
  };
  const readSet = (f) => sets[f];
  const own = buildReport({ today: '2026-10-16', index, readSet });
  assert.equal(own.previous.id, '2026-W41');
  assert.deepEqual(own.previous.used, [{ author: 'A', date: '2026-10-06', title: 'one' }]);
  assert.deepEqual(own.notes, []);
  assert.equal(buildReport({ today: '2026-10-23', index, readSet }).previous.id, '2026-W42');
  const first = buildReport({ today: '2026-10-09', index, readSet });
  assert.equal(first.previous, null);
  assert.equal(first.notes.length, 1);
  assert.match(first.notes[0], /직전 세트가 없어서/);
  const sat = buildReport({ today: '2026-10-17', index, readSet });
  assert.equal(sat.notes.length, 1);
  assert.match(sat.notes[0], /금요일이 아니어서/);
  assert.ok(sat.notes[0].includes('2026-10-16'));
  assert.throws(() => buildReport({ today: '2026-10-16', index: {}, readSet }), /주차 목록은 배열이어야 합니다/);
  assert.deepEqual(Object.keys(own), ['today', 'isFriday', 'window', 'weekId', 'previous', 'notes']);
});

test('CLI against the real repo', () => {
  assert.equal(JSON.parse(run('--today', '2026-10-16', '--json').stdout).previous, null);
  const r = run('--today', '2026-10-23', '--json');
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.previous.id, '2026-W42');
  assert.equal(out.previous.used.length, 6);
  assert.deepEqual(Object.keys(out.previous.used[0]), ['author', 'date', 'title']);
  assert.ok(out.previous.used.some((u) => u.author === '김준수'));
});

function quizzesDir(name, index, sets = {}) {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  if (index !== undefined) writeFileSync(join(dir, 'index.json'), typeof index === 'string' ? index : JSON.stringify(index));
  for (const [f, s] of Object.entries(sets)) writeFileSync(join(dir, f), JSON.stringify(s));
  return dir;
}

test('CLI with --quizzes reads a temp folder', () => {
  const dir = quizzesDir('ok', [{ id: '2026-W40', title: 'T', file: 'quizzes/2026-W40.json' }], {
    '2026-W40.json': { id: '2026-W40', sources: [{ author: 'X', date: '2026-10-01', title: 'tt' }] },
  });
  const r = run('--today', '2026-10-16', '--quizzes', dir, '--json');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).previous.used, [{ author: 'X', date: '2026-10-01', title: 'tt' }]);
});

test('CLI exits 2 for unreadable inputs', () => {
  const missingSet = quizzesDir('missing-set', [{ id: '2026-W40', title: 'T', file: 'quizzes/2026-W40.json' }]);
  let r = run('--today', '2026-10-16', '--quizzes', missingSet);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /2026-W40\.json/);
  r = run('--today', '2026-10-16', '--quizzes', quizzesDir('no-index', undefined));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /주차 목록을 찾지 못했어요/);
  r = run('--today', '2026-10-16', '--quizzes', quizzesDir('bad-json', '{nope'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /JSON을 읽지 못했어요/);
});

test('CLI usage errors exit 2 with Korean on stderr', () => {
  for (const args of [['--today'], ['--quizzes'], ['--nope'], ['--today', '2026-02-30']]) {
    const r = run(...args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /[가-힣]/);
  }
});

test('plain output is readable Korean', () => {
  const r = run('--today', '2026-10-16');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /출제 범위: 2026-10-09 ~ 2026-10-16/);
  assert.match(r.stdout, /직전 세트: 없음/);
  assert.match(run('--today', '2026-10-17').stdout, /금요일이 아니어서/);
  assert.match(run('--today', '2026-10-23').stdout, /직전 세트: 2026-W42/);
});

test('.gitignore ignores work/ and keeps the taste-skill lines', () => {
  const g = readFileSync('.gitignore', 'utf8');
  assert.match(g, /^work\/\r?$/m);
  assert.match(g, /^\.taste-skill\/inspect\/\r?$/m);
  assert.match(g, /^\.taste-skill\/shots\/\r?$/m);
  assert.ok(g.endsWith('\n'));
});
