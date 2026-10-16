// Grading rules pinned by tests. The browser, the validator and these tests share js/grade.js.
// Every non-ASCII or invisible input is built with String.fromCodePoint so this file holds no invisible characters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeAnswer,
  isBlank,
  gradeQuestion,
  gradeSet,
  sourceLabel,
  explanationLines,
  correctAnswerText,
  sanitizeAnswers,
} from '../js/grade.js';

const cp = (...c) => c.map((x) => String.fromCodePoint(x)).join('');
const sample = JSON.parse(readFileSync(new URL('../quizzes/2026-W42.json', import.meta.url), 'utf8'));

test('normalizeAnswer table', () => {
  const fullWidthGroupBy = cp(0xff27, 0xff52, 0xff4f, 0xff55, 0xff50, 0xff22, 0xff59);
  const table = [
    ['GroupBy', 'groupby'],
    [fullWidthGroupBy, 'groupby'],
    [' group by ', 'groupby'],
    ['groupby()', 'groupby'],
    ['groupby' + cp(0xff08, 0xff09), 'groupby'],
    ['df.groupby()', 'df.groupby'],
    ['train_test_split', 'traintestsplit'],
    ['train test split', 'traintestsplit'],
    ['결측치' + cp(0xb7) + '처리', '결측치처리'],
    ['결측치' + cp(0x318d) + '처리', '결측치처리'],
    ['결측치 처리.', '결측치처리'],
    [cp(0x1112, 0x1161, 0x11ab, 0x1100, 0x1173, 0x11af), '한글'],
    ['한' + cp(0x200b) + '글', '한글'],
    [cp(0xff11, 0xff12, 0xff13), '123'],
    ['a' + cp(0xa0) + 'b', 'ab'],
    ['a' + cp(0x3000) + 'b', 'ab'],
    ['I', 'i'],
    ['-1', '-1'],
    ['0.5', '0.5'],
    ['_x', '_x'],
    ['x_', 'x_'],
    ['   ', ''],
    [cp(0x3000, 0xa0, 0x20), ''],
  ];
  for (const [input, want] of table) {
    assert.equal(normalizeAnswer(input), want, `input code points: ${[...input].map((c) => c.codePointAt(0).toString(16)).join(' ')}`);
  }
});

test('normalizeAnswer: -1 and 1 stay different, variants of groupby agree', () => {
  assert.notEqual(normalizeAnswer('-1'), normalizeAnswer('1'));
  const variants = ['GroupBy', ' group by ', 'groupby()', 'groupby' + cp(0xff08, 0xff09), cp(0xff27, 0xff52, 0xff4f, 0xff55, 0xff50, 0xff22, 0xff59)];
  const set = new Set(variants.map(normalizeAnswer));
  assert.equal(set.size, 1);
});

test('normalizeAnswer: non-string input is the empty string', () => {
  for (const v of [undefined, null, 3, {}, []]) assert.equal(normalizeAnswer(v), '');
});

test('gradeQuestion: blank, correct and wrong on both types', () => {
  const choice = { type: 'choice', choices: ['a', 'b', 'c', 'd'], answer: 2 };
  const short = { type: 'short', answer: ['GroupBy', '그룹바이'] };
  assert.deepEqual(gradeQuestion(choice, undefined), { correct: false, blank: true });
  assert.deepEqual(gradeQuestion(choice, '2'), { correct: false, blank: true });
  assert.deepEqual(gradeQuestion(choice, 2), { correct: true, blank: false });
  assert.deepEqual(gradeQuestion(choice, 0), { correct: false, blank: false });
  assert.deepEqual(gradeQuestion(short, '   '), { correct: false, blank: true });
  assert.deepEqual(gradeQuestion(short, undefined), { correct: false, blank: true });
  assert.deepEqual(gradeQuestion(short, ' group by() '), { correct: true, blank: false });
  assert.deepEqual(gradeQuestion(short, '그룹 바이.'), { correct: true, blank: false });
  assert.deepEqual(gradeQuestion(short, 'merge'), { correct: false, blank: false });
  assert.equal(isBlank(choice, 0), false);
  assert.equal(isBlank(short, cp(0x200b)), true);
});

test('gradeQuestion: -1 is not 1', () => {
  const q = { type: 'short', answer: ['-1'] };
  assert.equal(gradeQuestion(q, '-1').correct, true);
  assert.equal(gradeQuestion(q, '1').correct, false);
  const q1 = { type: 'short', answer: ['1'] };
  assert.equal(gradeQuestion(q1, '-1').correct, false);
});

function correctAnswers(set) {
  const out = {};
  for (const q of set.questions) out[q.id] = q.type === 'choice' ? q.answer : q.answer[0];
  return out;
}

test('gradeSet on the sample: all correct gives 10 / 7 / 3', () => {
  const r = gradeSet(sample, correctAnswers(sample));
  assert.deepEqual(r.score, { total: 10, concept: 7, code: 3 });
  assert.deepEqual(r.max, { total: 10, concept: 7, code: 3 });
  for (const q of sample.questions) assert.deepEqual(r.results[q.id], { correct: true, blank: false });
});

test('gradeSet on the sample: all blank gives 0 and every result blank', () => {
  for (const given of [{}, undefined]) {
    const r = gradeSet(sample, given);
    assert.deepEqual(r.score, { total: 0, concept: 0, code: 0 });
    assert.deepEqual(r.max, { total: 10, concept: 7, code: 3 });
    for (const q of sample.questions) assert.deepEqual(r.results[q.id], { correct: false, blank: true });
  }
});

test('gradeSet on the sample: every listed short alternative is accepted', () => {
  for (const q of sample.questions.filter((x) => x.type === 'short')) {
    for (const alt of q.answer) {
      assert.equal(gradeQuestion(q, alt).correct, true, `${q.id}: ${alt}`);
    }
  }
});

test('sourceLabel drops zero padding', () => {
  assert.equal(sourceLabel({ author: '이주현', date: '2026-10-14' }), '이주현 · 10/14');
  assert.equal(sourceLabel({ author: '김준수', date: '2026-01-05' }), '김준수 · 1/5');
});

test('explanationLines drops empty lines and trims', () => {
  assert.deepEqual(explanationLines('a\n\n  b  \r\n\r\nc\n'), ['a', 'b', 'c']);
  assert.deepEqual(explanationLines(''), []);
  assert.deepEqual(explanationLines(undefined), []);
});

test('correctAnswerText for both types', () => {
  assert.equal(correctAnswerText({ type: 'choice', choices: ['a', 'b', 'c', 'd'], answer: 3 }), 'd');
  assert.equal(correctAnswerText({ type: 'short', answer: ['first', 'second'] }), 'first');
});

test('sanitizeAnswers keeps only known, well-formed values', () => {
  // JSON.parse creates a real own "__proto__" key, exactly what a tampered localStorage value could hold.
  const raw = JSON.parse(
    '{"q1":1,"q2":7,"q3":"isna().sum()","q4":1.5,"q5":"1","q6":"' + 'x'.repeat(201) + '","q9":"' + 'x'.repeat(200) + '","q99":"unknown id","__proto__":"polluted"}',
  );
  assert.equal(Object.hasOwn(raw, '__proto__'), true);
  const out = sanitizeAnswers(sample, raw);
  assert.deepEqual({ ...out }, { q1: 1, q3: 'isna().sum()', q9: 'x'.repeat(200) });
  assert.equal(Object.hasOwn(out, '__proto__'), false);
  assert.equal(Object.hasOwn(out, 'q99'), false);
  assert.equal(Object.hasOwn(out, 'q2'), false);
  assert.equal(Object.hasOwn(out, 'q4'), false);
  assert.equal(Object.hasOwn(out, 'q5'), false);
  assert.equal(Object.hasOwn(out, 'q6'), false);
});

test('sanitizeAnswers: non-object input gives an empty map', () => {
  for (const raw of [null, undefined, 'x', 5]) assert.deepEqual({ ...sanitizeAnswers(sample, raw) }, {});
});
