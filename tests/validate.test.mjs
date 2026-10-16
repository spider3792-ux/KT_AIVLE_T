// One test per rule of the set checker: mutate a clone of the sample, expect the documented Korean stem at the right path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSet, memberNames } from '../scripts/lib/validate-core.mjs';

const read = (rel) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
const sample = read('quizzes/2026-W42.json');
const members = memberNames(read('members.json'));
const ctx = { fileBase: '2026-W42', members };

const run = (set, c = ctx) => validateSet(set, c);
const clone = () => structuredClone(sample);
const q = (set, id) => set.questions.find((x) => x.id === id);

// Assert one error with the stem; when `path` is given, its path must contain it.
function expectError(result, stem, path) {
  const hit = result.errors.find((e) => e.message.includes(stem) && (path === undefined || e.path.includes(path)));
  assert.ok(
    hit,
    `expected error "${stem}"${path ? ` at "${path}"` : ''}; got:\n${result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n') || '  (none)'}`,
  );
  return hit;
}
function expectWarning(result, stem, path) {
  const hit = result.warnings.find((e) => e.message.includes(stem) && (path === undefined || e.path.includes(path)));
  assert.ok(
    hit,
    `expected warning "${stem}"${path ? ` at "${path}"` : ''}; got:\n${result.warnings.map((e) => `  ${e.path}: ${e.message}`).join('\n') || '  (none)'}`,
  );
  return hit;
}

test('memberNames reads the names array', () => {
  assert.deepEqual(memberNames({ members: [{ name: 'a' }, { name: 'b', confirm: true }] }), ['a', 'b']);
  assert.deepEqual(memberNames({}), []);
  assert.deepEqual(memberNames(null), []);
});

test('the sample week with members.json has 0 errors', () => {
  const r = run(sample);
  assert.deepEqual(r.errors, []);
});

test('header: missing required key', () => {
  const s = clone();
  delete s.estimatedMinutes;
  expectError(run(s), '필수 항목 estimatedMinutes가 없습니다');
});

test('header: unknown extra keys are tolerated', () => {
  const s = clone();
  s.note = 'extra';
  assert.deepEqual(run(s).errors, []);
});

test('top level that is not an object is rejected without throwing', () => {
  for (const bad of [null, [], 'x', 3]) {
    const r = run(bad);
    assert.ok(r.errors.length > 0);
  }
});

test('header: id format and file name', () => {
  let s = clone();
  s.id = '2026-42';
  expectError(run(s), 'id', 'id');
  s = clone();
  s.id = '2026-W43';
  expectError(run(s), 'id가 파일 이름과 다릅니다 (id 2026-W43, 파일 2026-W42)');
  // a file base that is not a week id is not compared
  s = clone();
  s.id = '2026-W43';
  assert.equal(run(s, { fileBase: 'draft', members }).errors.length, 0);
});

test('header: title empty is an error, no Hangul and long are warnings', () => {
  let s = clone();
  s.title = '  ';
  expectError(run(s), '제목', 'title');
  s = clone();
  s.title = 'Week 42 exam';
  expectWarning(run(s), '제목에 한글이 없습니다');
  s = clone();
  s.title = '이번 주 복습 시험지 모음 가나다라마바사';
  expectWarning(run(s), '제목이 깁니다 (14자 이하 권장, 현재 22자)');
});

test('header: range dates must be real and ordered', () => {
  let s = clone();
  s.range.from = '2026-02-31';
  expectError(run(s), '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD, 현재 2026-02-31)', 'range.from');
  s = clone();
  s.range.to = 'soon';
  expectError(run(s), '날짜 형식이 올바르지 않습니다', 'range.to');
  s = clone();
  s.range.from = '2026-10-20';
  s.range.to = '2026-10-10';
  expectError(run(s), 'range', 'range');
});

test('header: estimatedMinutes positive integer, 10-20 recommended', () => {
  let s = clone();
  s.estimatedMinutes = 0;
  expectError(run(s), '예상 풀이 시간', 'estimatedMinutes');
  s = clone();
  s.estimatedMinutes = 12.5;
  expectError(run(s), '예상 풀이 시간', 'estimatedMinutes');
  s = clone();
  s.estimatedMinutes = 45;
  expectWarning(run(s), '예상 풀이 시간은 10~20분을 권장합니다 (현재 45분)');
  assert.equal(run(s).errors.length, 0);
});

test('count: 9 questions', () => {
  const s = clone();
  s.questions.pop();
  expectError(run(s), '10문제여야 합니다 (현재 9문제)');
});

test('mix: 6 concept + 4 code', () => {
  const s = clone();
  q(s, 'q7').kind = 'code';
  q(s, 'q7').code = 'x = 1';
  expectError(run(s), '개념 7문제 + 코드 분석 3문제여야 합니다 (현재 개념 6, 코드 분석 4)');
});

test('question ids: duplicates and out of range', () => {
  let s = clone();
  s.questions[1].id = 'q1';
  expectError(run(s), '문제 id는 q1~q10이어야 하고 겹치면 안 됩니다', 'questions[1]');
  s = clone();
  s.questions[0].id = '__proto__';
  expectError(run(s), '문제 id는 q1~q10이어야 하고 겹치면 안 됩니다', 'questions[0]');
  s = clone();
  s.questions[0].id = 'q11';
  expectError(run(s), '문제 id는 q1~q10이어야 하고 겹치면 안 됩니다', 'questions[0]');
});

test('kind and type values', () => {
  let s = clone();
  q(s, 'q1').kind = 'essay';
  expectError(run(s), 'kind는 concept 또는 code만 쓸 수 있습니다', '(q1)');
  s = clone();
  q(s, 'q1').type = 'essay';
  expectError(run(s), 'type은 choice 또는 short만 쓸 수 있습니다 (서술형 없음)', '(q1)');
});

test('prompt: empty is an error, no Hangul is a warning', () => {
  let s = clone();
  q(s, 'q2').prompt = '';
  expectError(run(s), '문제', '(q2)');
  s = clone();
  q(s, 'q2').prompt = 'What does merge do?';
  expectWarning(run(s), '문제에 한글이 없습니다', '(q2)');
});

test('choice: 3 choices', () => {
  const s = clone();
  q(s, 'q1').choices.pop();
  expectError(run(s), '객관식 보기는 4개여야 합니다 (현재 3개)', '(q1)');
});

test('choice: empty choice string', () => {
  const s = clone();
  q(s, 'q1').choices[2] = ' ';
  expectError(run(s), '보기', '(q1)');
});

test('choice: duplicates after normalizeAnswer', () => {
  const s = clone();
  q(s, 'q1').choices[0] = 'Same Text';
  q(s, 'q1').choices[2] = 'same text';
  expectError(run(s), '객관식 보기가 중복됩니다', '(q1)');
});

test('choice: answer out of range or not an integer', () => {
  for (const bad of [4, 1.5, -1, '1', undefined]) {
    const s = clone();
    q(s, 'q1').answer = bad;
    expectError(run(s), '정답 번호는 0~3 사이 정수여야 합니다', '(q1)');
  }
});

test('short: no accepted answer', () => {
  for (const bad of [[], ['  '], 'isna', undefined, [3]]) {
    const s = clone();
    q(s, 'q3').answer = bad;
    expectError(run(s), '인정 정답', '(q3)');
  }
});

test('short: two accepted answers that grade the same is a warning', () => {
  const s = clone();
  q(s, 'q3').answer = ['isna().sum()', 'isna.sum', 'isnull().sum()'];
  expectWarning(run(s), '인정 정답 isna().sum()와 isna.sum가 같은 답으로 처리됩니다', '(q3)');
  assert.equal(run(s).errors.length, 0);
});

test('short: choices must be absent', () => {
  const s = clone();
  q(s, 'q3').choices = ['a', 'b', 'c', 'd'];
  expectError(run(s), 'choices', '(q3)');
});

test('code: kind code needs code, concept must not have it, CR is rejected', () => {
  let s = clone();
  delete q(s, 'q8').code;
  expectError(run(s), '코드 분석 문제에는 code(코드 원문)가 있어야 합니다', '(q8)');
  s = clone();
  q(s, 'q8').code = '   ';
  expectError(run(s), '코드 원문', '(q8)');
  s = clone();
  q(s, 'q1').code = 'print(1)';
  expectError(run(s), '개념 문제에는 code를 넣지 않습니다', '(q1)');
  s = clone();
  q(s, 'q8').code = 'a = 1\r\nb = 2';
  expectError(run(s), 'code의 줄바꿈은 \\n만 씁니다', '(q8)');
});

test('explanation: 6 lines, empty, long line', () => {
  let s = clone();
  q(s, 'q1').explanation = 'a\nb\nc\nd\ne\nf';
  expectError(run(s), '해설은 5줄 이내여야 합니다 (현재 6줄)', '(q1)');
  s = clone();
  q(s, 'q1').explanation = 'a\n\nb\n\nc\nd\ne';
  assert.deepEqual(run(s).errors, [], 'empty lines are not counted');
  s = clone();
  q(s, 'q1').explanation = ' ';
  expectError(run(s), '해설', '(q1)');
  s = clone();
  q(s, 'q1').explanation = '가'.repeat(101);
  expectWarning(run(s), '해설 한 줄이 깁니다 (100자 이하 권장)', '(q1)');
});

test('concept: name and ref required', () => {
  let s = clone();
  q(s, 'q1').concept.ref = '';
  expectError(run(s), '관련 개념(concept.name, concept.ref)이 필요합니다', '(q1)');
  s = clone();
  delete q(s, 'q1').concept;
  expectError(run(s), '관련 개념(concept.name, concept.ref)이 필요합니다', '(q1)');
});

test('provenance: sourceIds or file; unknown source id', () => {
  let s = clone();
  delete q(s, 'q1').sourceIds;
  expectError(run(s), '노션 출처(sourceIds) 또는 실습 파일(file)이 필요합니다', '(q1)');
  s = clone();
  q(s, 'q1').sourceIds = [];
  expectError(run(s), '노션 출처(sourceIds) 또는 실습 파일(file)이 필요합니다', '(q1)');
  s = clone();
  q(s, 'q1').sourceIds = ['s9'];
  expectError(run(s), '출처 s9가 sources 목록에 없습니다', '(q1)');
  s = clone();
  delete q(s, 'q1').sourceIds;
  q(s, 'q1').file = 'sales.csv';
  assert.deepEqual(run(s).errors, []);
});

test('sources: duplicate id, author, date, title', () => {
  let s = clone();
  s.sources[1].id = 's1';
  expectError(run(s), '출처 id', 'sources[1]');
  s = clone();
  s.sources[1].author = '홍길동';
  expectError(run(s), '작성자 홍길동이(가) members.json에 없습니다', 'sources[1] (s2)');
  s = clone();
  s.sources[2].date = '2026-10-32';
  expectError(run(s), '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD, 현재 2026-10-32)', 'sources[2] (s3)');
  s = clone();
  s.sources[0].title = '';
  expectError(run(s), '제목', 'sources[0] (s1)');
  s = clone();
  s.sources[0].subject = '';
  expectError(run(s), '주제', 'sources[0] (s1)');
});

test('sources: author is not checked when no members are given', () => {
  const s = clone();
  s.sources[1].author = '홍길동';
  assert.equal(run(s, { fileBase: '2026-W42' }).errors.length, 0);
});

test('sources: date outside range, unreferenced source', () => {
  let s = clone();
  s.sources[0].date = '2026-09-01';
  expectWarning(run(s), '출처 날짜가 출제 범위 밖입니다', 'sources[0] (s1)');
  assert.equal(run(s).errors.length, 0);
  s = clone();
  s.sources.push({ id: 's7', author: '김준수', date: '2026-10-15', title: '안 쓰는 기록', subject: 'SQL' });
  expectWarning(run(s), '출처 s7를 쓰는 문제가 없습니다', 'sources[6] (s7)');
});

test('answer positions: one index answering 6 or more choice questions is a warning', () => {
  const s = clone();
  for (const x of s.questions) if (x.type === 'choice') x.answer = 0;
  expectWarning(run(s), '정답 번호가 한쪽에 몰려 있습니다');
  assert.equal(run(s).errors.length, 0);
});

test('every problem is collected, not just the first', () => {
  const s = clone();
  s.questions.pop();
  q(s, 'q1').choices.pop();
  q(s, 'q2').answer = 9;
  const r = run(s);
  assert.ok(r.errors.length >= 3, `got ${r.errors.length}`);
});
