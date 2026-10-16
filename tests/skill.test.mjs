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

// ---------------------------------------------------------------- SKILL.md

const SKILL_PATH = `${SKILL_DIR}/SKILL.md`;
const SKILL = read(SKILL_PATH);
const fm = SKILL.match(/^---\n([\s\S]*?)\n---\n/);
const FRONT = fm[1];
const BODY = SKILL.slice(fm[0].length);
const DESC = FRONT.match(/description:\s*>-?\n((?:[ \t]+.*\n?)+)/)[1]
  .split('\n').map((s) => s.trim()).join(' ').trim();

const headings = [...BODY.matchAll(/^## (.*)$/gm)].map((m) => ({ title: m[1], at: m.index }));
function section(prefix) {
  const i = headings.findIndex((h) => h.title.startsWith(prefix));
  assert.ok(i >= 0, `no section "${prefix}"`);
  return BODY.slice(headings[i].at, i + 1 < headings.length ? headings[i + 1].at : undefined);
}
const step = (n) => section(`${n}단계`);

test('SKILL.md frontmatter: name, description length, the three triggers, body length', () => {
  assert.match(FRONT, /^name:\s*weekly-quiz\s*$/m);
  assert.ok([...DESC].length <= 1024, `description is ${[...DESC].length} characters`);
  for (const t of ['이번 주 퀴즈 만들어 줘', '퀴즈 출제', '주간 문제 만들기']) {
    assert.ok(DESC.includes(t), `description lacks "${t}"`);
  }
  assert.ok(BODY.split('\n').length < 300);
  assert.deepEqual(FRONT.split('\n').filter((l) => /^[A-Za-z-]+:/.test(l)).map((l) => l.split(':')[0]), ['name', 'description']);
});

test('SKILL.md links the rubric and names the fixture that exist', () => {
  assert.ok(SKILL.includes('(rubric.md)'));
  assert.ok(existsSync(`${SKILL_DIR}/rubric.md`));
  assert.ok(step(4).includes('tests/fixtures/worked-example/'));
  assert.ok(existsSync(`${EX}/records.json`));
});

test('headings 1단계..10단계 exist in numeric order', () => {
  const nums = headings.map((h) => h.title.match(/^(\d+)단계/)).filter(Boolean).map((m) => Number(m[1]));
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(headings.some((h) => h.title.startsWith('원칙')));
});

const REQUIRED = {
  원칙: ['커밋', '푸시', '금지', 'index.json', 'work/', '지시', '실행하지'],
  '1단계': ['node scripts/week.mjs --json', '주차 id'],
  '2단계': ['풀어', '붙여', '커넥터'],
  '3단계': ['리스트', '# 여기에 코드', '(스터디 때 팀원 의견을 여기에 남겨요)', '작성 양식', '직전 세트'],
  '4단계': ['work/<id>/records.json', 'members.json', 'codeBlocks'],
  '5단계': ['입고 보고', '6개', '3명', '진행', '범위 넓히기', '중단', '코드 블록'],
  '6단계': ['.py', '.ipynb', '.csv', '.xlsx', 'CSV UTF-8', 'file'],
  '7단계': ['(rubric.md)', 'work/<id>/set.json'],
  '8단계': ['node scripts/validate-quiz.mjs work/<id>/set.json --sources work/<id>/records.json', '5'],
  '9단계': ['블라인드'],
  '10단계': ['quizzes/<id>.json', '교체', '다른 id', '중단', 'index.json'],
};
for (const [key, literals] of Object.entries(REQUIRED)) {
  test(`SKILL.md ${key} holds its required literals`, () => {
    const text = key === '원칙' ? section('원칙') : step(key.replace('단계', ''));
    for (const lit of literals) assert.ok(text.includes(lit), `${key} lacks "${lit}"`);
  });
}

test('SKILL.md prohibitions: git writes are forbidden, index.json is not edited', () => {
  const lines = SKILL.split('\n');
  for (const l of lines.filter((x) => /\bgit\s+(add|commit|push)\b/.test(x))) {
    assert.ok(l.includes('금지'), `git write command without 금지: ${l}`);
  }
  assert.ok(lines.some((l) => l.includes('커밋') && l.includes('푸시') && l.includes('금지')));
  for (const l of section('원칙').split('\n').filter((x) => x.includes('index.json'))) {
    assert.ok(/수정하지|건드리지|금지/.test(l), `index.json line lacks a prohibition: ${l}`);
  }
});

test('SKILL.md order: the intake report sits between step 4 and step 7', () => {
  const at = BODY.indexOf('### 입고 보고');
  assert.ok(at > BODY.indexOf('## 4단계'));
  assert.ok(at < BODY.indexOf('## 7단계'));
});

test('the skill folder holds only SKILL.md and rubric.md', () => {
  assert.deepEqual(readdirSync(SKILL_DIR).sort(), ['SKILL.md', 'rubric.md']);
});
