// The checker as a member of the study would run it: spawn the CLI, read exit code and Korean output.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (...args) => spawnSync(process.execPath, ['scripts/validate-quiz.mjs', ...args], { encoding: 'utf8' });
const tmp = mkdtempSync(join(tmpdir(), 'srq-cli-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('the sample week passes with a 통과 line', () => {
  const r = run('quizzes/2026-W42.json');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^통과: quizzes\/2026-W42\.json · 10문제 \(개념 7 · 코드 분석 3\) · 출처 6개/m);
  assert.match(r.stdout, /--sources 없이 검사해서 입력 기록 대조는 건너뛰었어요/);
});

test('the week list passes', () => {
  const r = run('quizzes/index.json');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /통과: 주차 1개/);
});

test('the sample passes against its input records (--sources)', () => {
  const r = run('quizzes/2026-W42.json', '--sources', 'tests/fixtures/records-2026-W42.json');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^통과:/m);
  assert.doesNotMatch(r.stdout, /건너뛰었어요/);
});

for (const [file, stems] of [
  ['tests/fixtures/broken-structure.json', ['10문제', '개념 7', '보기는 4개', '정답 번호']],
  ['tests/fixtures/broken-sources.json', ['출처 s9', '5줄', '날짜', '작성자']],
]) {
  test(`${file} exits 1 with every Korean reason`, () => {
    const r = run(file);
    assert.equal(r.status, 1, r.stdout);
    for (const stem of stems) assert.ok(r.stderr.includes(stem), `missing "${stem}" in:\n${r.stderr}`);
    // each problem names where it is
    assert.match(r.stderr, /questions\[\d+\] \(q\d+\)/);
  });
}

test('broken-sources names the source and the question it is about', () => {
  const r = run('tests/fixtures/broken-sources.json');
  assert.match(r.stderr, /오류 sources\[2\] \(s3\): 날짜/);
  assert.match(r.stderr, /오류 sources\[3\] \(s4\): 작성자/);
  assert.match(r.stderr, /오류 questions\[0\] \(q1\): 출처 s9/);
  assert.match(r.stderr, /오류 questions\[1\] \(q2\): 해설은 5줄/);
});

test('a set whose code is copied from the records exits 1 with 그대로 옮겼습니다', () => {
  const rec = JSON.parse(readFileSync('tests/fixtures/records-2026-W42.json', 'utf8'));
  const set = JSON.parse(readFileSync('quizzes/2026-W42.json', 'utf8'));
  set.questions.find((q) => q.id === 'q8').code = rec.records.find((r) => r.id === 's1').codeBlocks[0];
  const p = join(tmp, '2026-W42.json');
  writeFileSync(p, JSON.stringify(set));
  const r = run(p, '--sources', 'tests/fixtures/records-2026-W42.json');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /그대로 옮겼습니다/);
  assert.match(r.stderr, /\(q8\)/);
});

test('records missing a source exit 1', () => {
  const rec = JSON.parse(readFileSync('tests/fixtures/records-2026-W42.json', 'utf8'));
  rec.records = rec.records.filter((r) => r.id !== 's6');
  const p = join(tmp, 'records-missing.json');
  writeFileSync(p, JSON.stringify(rec));
  const r = run('quizzes/2026-W42.json', '--sources', p);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /출처 s6가 입력 기록 목록에 없습니다/);
});

test('a records file of the wrong shape exits 2', () => {
  const p = join(tmp, 'records-bad.json');
  writeFileSync(p, JSON.stringify({ nope: true }));
  const r = run('quizzes/2026-W42.json', '--sources', p);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /입력 기록 파일 형식이 올바르지 않습니다/);
});

test('a missing file exits 2', () => {
  const r = run('nope.json');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /파일이 없습니다: nope\.json/);
});

test('invalid JSON exits 2 with a Korean message, not a stack trace', () => {
  const p = join(tmp, 'bad.json');
  writeFileSync(p, '{ "id": ');
  const r = run(p);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /JSON을 읽지 못했어요/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test('usage mistakes exit 2', () => {
  assert.equal(run().status, 2);
  assert.match(run().stderr, /사용법/);
  assert.equal(run('quizzes/2026-W42.json', '--bogus').status, 2);
  assert.equal(run('quizzes/2026-W42.json', '--sources').status, 2);
});

test('a leading BOM (PowerShell) is tolerated', () => {
  const p = join(tmp, '2026-W42.json');
  writeFileSync(p, `﻿${readFileSync('quizzes/2026-W42.json', 'utf8')}`);
  const r = run(p);
  assert.equal(r.status, 0, r.stderr);
});

test('--strict turns warnings into a failure', () => {
  const set = JSON.parse(readFileSync('quizzes/2026-W42.json', 'utf8'));
  set.estimatedMinutes = 45; // WARN only
  const dir = mkdtempSync(join(tmp, 'strict-'));
  const p = join(dir, '2026-W42.json'); // file name equals the id, so only the warning remains
  writeFileSync(p, JSON.stringify(set));
  const lenient = run(p);
  assert.equal(lenient.status, 0, lenient.stderr);
  assert.match(lenient.stderr, /경고 estimatedMinutes: 예상 풀이 시간은 10~20분/);
  assert.equal(run(p, '--strict').status, 1);
});
