// Static guards for the weekly-quiz skill: rubric, worked example, SKILL.md wiring.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRecords, checkAgainstRecords, memberNames } from '../scripts/lib/validate-core.mjs';

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const readJson = (p) => JSON.parse(read(p));

const SKILL_DIR = '.claude/skills/weekly-quiz';
const RUBRIC = read(`${SKILL_DIR}/rubric.md`);
const SAMPLE = readJson('quizzes/2026-W42.json');
const MEMBERS = readJson('members.json');

const tmp = mkdtempSync(join(tmpdir(), 'srq-skill-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

// ---------------------------------------------------------------- rubric.md

test('rubric.md is short and names the contract terms', () => {
  assert.ok(RUBRIC.split('\n').length <= 200, 'rubric.md is over 200 lines');
  for (const term of ['7', '3', 'choice', 'short', '5줄', '막힌 이유', '1.5', '2.5']) {
    assert.ok(RUBRIC.includes(term), `rubric.md lacks "${term}"`);
  }
  assert.equal((RUBRIC.match(/^## [1-4]\. /gm) ?? []).length, 4);
});

test('rubric worked examples are verbatim q1 and q10 of the sample set', () => {
  const blocks = [...RUBRIC.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
  assert.ok(blocks.length >= 2, 'need at least two json examples');
  const ids = blocks.map((b) => b.id);
  assert.ok(ids.includes('q1') && ids.includes('q10'), `ids found: ${ids}`);
  for (const b of blocks) {
    assert.deepEqual(b, SAMPLE.questions.find((q) => q.id === b.id));
  }
});

const MINUTES = { concept: { choice: 1, short: 1.5 }, code: { choice: 2, short: 2.5 } };
const minutes = (questions) => Math.round(questions.reduce((s, q) => s + MINUTES[q.kind][q.type], 0));

test('time formula reproduces the sample and stays within 13..18 for any 7 + 3 mix', () => {
  assert.equal(minutes(SAMPLE.questions), SAMPLE.estimatedMinutes);
  assert.equal(SAMPLE.estimatedMinutes, 15);
  for (let cs = 0; cs <= 7; cs++) {
    for (let ks = 0; ks <= 3; ks++) {
      const qs = [
        ...Array.from({ length: 7 }, (_, i) => ({ kind: 'concept', type: i < cs ? 'short' : 'choice' })),
        ...Array.from({ length: 3 }, (_, i) => ({ kind: 'code', type: i < ks ? 'short' : 'choice' })),
      ];
      const m = minutes(qs);
      assert.ok(m >= 13 && m <= 18, `mix ${cs}/${ks} gives ${m}`);
    }
  }
});

// ------------------------------------------------------------ worked example

const EX = 'tests/fixtures/worked-example';
const PAGE = read(`${EX}/page-example.md`);
const EX_RECORDS = readJson(`${EX}/records.json`);

test('worked example: page properties and records.json agree', () => {
  const first = PAGE.split('\n')[0];
  assert.ok(first.startsWith('Properties: '));
  const props = JSON.parse(first.slice('Properties: '.length));
  const map = parseRecords(EX_RECORDS);
  assert.equal(map.size, 1);
  const rec = map.get('s1');
  assert.equal(rec.date, props['date:날짜:start']);
  assert.equal(rec.title, props['복습 제목']);
  assert.equal(rec.subject, props['과목']);
  assert.ok(memberNames(MEMBERS).includes(rec.author), `${rec.author} is not a member`);
  for (const block of rec.codeBlocks) {
    assert.ok(PAGE.includes(block), `code block not verbatim in the page:\n${block}`);
    assert.ok(!block.includes('여기에 코드'));
  }
  assert.equal((PAGE.match(/^```python$/gm) ?? []).length, rec.codeBlocks.length);
});

function codeSet(code) {
  const r = EX_RECORDS.records[0];
  return {
    sources: [{ id: 's1', author: r.author, date: r.date, title: r.title, subject: r.subject }],
    questions: [{ id: 'q1', kind: 'code', type: 'choice', code, sourceIds: ['s1'] }],
  };
}

test('worked example: verbatim code passes the record check, one inserted space is rejected', () => {
  const records = parseRecords(EX_RECORDS);
  const [first, second] = records.get('s1').codeBlocks;
  const exact = second.replace(/\n$/, '');
  assert.deepEqual(checkAgainstRecords(codeSet(exact), records).errors, []);
  assert.deepEqual(checkAgainstRecords(codeSet(first.replace(/\n$/, '')), records).errors, []);
  assert.deepEqual(checkAgainstRecords(codeSet(".groupby(['동', '요일'])"), records).errors, []);

  const changed = exact.replace("['동', '요일']", "['동',  '요일']");
  assert.notEqual(changed, exact);
  const { errors } = checkAgainstRecords(codeSet(changed), records);
  assert.ok(errors.some((e) => JSON.stringify(e).includes('원문')), `no 원문 error: ${JSON.stringify(errors)}`);
});

test('gate command form: a draft named set.json passes with --sources', () => {
  copyFileSync('quizzes/2026-W42.json', join(tmp, 'set.json'));
  copyFileSync('tests/fixtures/records-2026-W42.json', join(tmp, 'records.json'));
  const r = spawnSync(
    process.execPath,
    ['scripts/validate-quiz.mjs', join(tmp, 'set.json'), '--sources', join(tmp, 'records.json')],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^통과:/m);
});
