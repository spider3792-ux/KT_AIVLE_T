// One test per rule of the set checker: mutate a clone of the sample, expect the documented Korean stem at the right path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateSet, validateIndex, memberNames, parseRecords, checkAgainstRecords } from '../scripts/lib/validate-core.mjs';

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

// ---- week list ----

const goodIndex = () => [
  { id: '2026-W43', title: '10월 넷째 주 시험지', published: '2026-10-23', file: 'quizzes/2026-W43.json' },
  { id: '2026-W42', title: '10월 셋째 주 시험지', published: '2026-10-16', file: 'quizzes/2026-W42.json' },
];
const indexCtx = (over = {}) => ({
  listQuizFiles: () => ['2026-W42.json', '2026-W43.json', 'index.json'],
  readSet: (file) => ({ id: file.replace(/^quizzes\//, '').replace(/\.json$/, '') }),
  ...over,
});

test('index: the real quizzes/index.json is clean with the real file list', () => {
  const idx = read('quizzes/index.json');
  const r = validateIndex(idx, {
    listQuizFiles: () => readdirSync('quizzes'),
    readSet: (f) => read(f),
  });
  assert.deepEqual(r.errors, []);
});

test('index: good list passes', () => {
  assert.deepEqual(validateIndex(goodIndex(), indexCtx()).errors, []);
});

test('index: empty or not an array', () => {
  expectError(validateIndex([], indexCtx()), '주차 목록이 비어 있습니다');
  expectError(validateIndex({}, indexCtx()), '주차 목록');
});

test('index: unsorted list', () => {
  expectError(validateIndex(goodIndex().reverse(), indexCtx()), '주차 목록은 최신순이어야 합니다');
});

test('index: tie on published sorts by id descending', () => {
  const a = goodIndex();
  a[0].published = '2026-10-16';
  assert.deepEqual(validateIndex(a, indexCtx()).errors, []);
  expectError(validateIndex(a.reverse(), indexCtx()), '주차 목록은 최신순이어야 합니다');
});

test('index: wrong file path', () => {
  const a = goodIndex();
  a[1].file = 'quizzes/week42.json';
  expectError(validateIndex(a, indexCtx()), 'file은 quizzes/ID.json이어야 합니다', 'index[1]');
});

test('index: file name with the wrong letter case does not count as existing', () => {
  const r = validateIndex(goodIndex(), indexCtx({ listQuizFiles: () => ['2026-w42.json', '2026-W43.json'] }));
  expectError(r, '파일이 없습니다 (대소문자까지 같아야 합니다): quizzes/2026-W42.json', 'index[1]');
});

test('index: set id differs from the entry id', () => {
  const r = validateIndex(goodIndex(), indexCtx({ readSet: () => ({ id: '2026-W40' }) }));
  expectError(r, '주차 파일의 id', 'index[0]');
});

test('index: entry fields and duplicates', () => {
  let a = goodIndex();
  a[0].published = '2026-13-40';
  expectError(validateIndex(a, indexCtx()), '날짜 형식이 올바르지 않습니다', 'index[0]');
  a = goodIndex();
  a[1].id = '2026-W43';
  a[1].file = 'quizzes/2026-W43.json';
  expectError(validateIndex(a, indexCtx()), 'id가 겹칩니다', 'index[1]');
  a = goodIndex();
  delete a[0].title;
  expectError(validateIndex(a, indexCtx()), 'title', 'index[0]');
  a = goodIndex();
  a[0].id = 'W43';
  expectError(validateIndex(a, indexCtx()), 'id', 'index[0]');
});

// ---- --sources: input records ----

const records = () => read('tests/fixtures/records-2026-W42.json');

test('parseRecords: the fixture parses into a Map by id', () => {
  const m = parseRecords(records());
  assert.ok(m instanceof Map);
  assert.equal(m.size, 6);
  assert.equal(m.get('s1').author, '김준수');
});

test('parseRecords: wrong shapes are reported with the Korean stem', () => {
  for (const bad of [null, [], {}, { records: 'x' }, { records: [3] }, { records: [{ id: 's1' }] }, { records: [{ id: 's1', author: 'a', date: 'd', codeBlocks: 'x' }] }]) {
    assert.throws(() => parseRecords(bad), /입력 기록 파일 형식이 올바르지 않습니다/);
  }
  const dup = { records: [{ id: 's1', author: 'a', date: 'd' }, { id: 's1', author: 'a', date: 'd' }] };
  assert.throws(() => parseRecords(dup), /겹칩니다/);
});

test('checkAgainstRecords: the sample matches its records', () => {
  const r = checkAgainstRecords(sample, parseRecords(records()));
  assert.deepEqual(r.errors, []);
});

test('checkAgainstRecords: source missing from the records', () => {
  const rec = records();
  rec.records = rec.records.filter((x) => x.id !== 's4');
  expectError(checkAgainstRecords(sample, parseRecords(rec)), '출처 s4가 입력 기록 목록에 없습니다', 'sources[3] (s4)');
});

test('checkAgainstRecords: author or date differs', () => {
  const rec = records();
  rec.records.find((x) => x.id === 's2').date = '2026-10-15';
  expectError(checkAgainstRecords(sample, parseRecords(rec)), '출처 s2의 작성자·날짜가 입력 기록과 다릅니다', 'sources[1] (s2)');
});

test('checkAgainstRecords: practice file not in any record', () => {
  const rec = records();
  for (const r of rec.records) r.files = [];
  expectError(checkAgainstRecords(sample, parseRecords(rec)), '실습 파일 sales.csv가 입력 기록에 없습니다', '(q8)');
});

test('checkAgainstRecords: code that differs by one space is rejected', () => {
  const rec = records();
  const s1 = rec.records.find((x) => x.id === 's1');
  s1.codeBlocks = s1.codeBlocks.map((b) => b.replace('    df.groupby', '     df.groupby'));
  expectError(checkAgainstRecords(sample, parseRecords(rec)), '코드가 입력 기록 원문과 일치하지 않습니다 (q8)', '(q8)');
});

test('checkAgainstRecords: CRLF in the record and one trailing newline are tolerated', () => {
  const rec = records();
  for (const r of rec.records) r.codeBlocks = r.codeBlocks.map((b) => b.replace(/\n/g, '\r\n'));
  const set = clone();
  q(set, 'q8').code += '\n';
  assert.deepEqual(checkAgainstRecords(set, parseRecords(rec)).errors, []);
});
