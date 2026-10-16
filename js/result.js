// DOM builders for the graded sheet: the score summary and one result block per question.
// Everything reaches the DOM through el() / textContent. Source labels are built from set.sources[], never from free text in a question.
import { el } from './site.js';
import { correctAnswerText, explanationLines, sourceLabel } from './grade.js';

// "2026-10-16T01:02:03Z" -> "10/16"
function monthDay(iso) {
  const m = /^[0-9]{4}-([0-9]{2})-([0-9]{2})/.exec(String(iso || ''));
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

function maxOf(set) {
  const concept = set.questions.filter((q) => q.kind !== 'code').length;
  return { total: set.questions.length, concept, code: set.questions.length - concept };
}

// The top of the graded paper. attempt: { member, submittedAt, score: { total, concept, code }, sample? }.
// With attempt.sample the sheet is the design-review view: no member, nothing stored.
export function renderScore(attempt, set) {
  const max = maxOf(set);
  const score = attempt.score;
  const num = (key) => el('span', { class: 'nums', dataset: { score: key }, text: score[key] });
  const figure = (label, key) =>
    el('p', { class: 'score-figure' }, el('span', { class: 'score-name', text: label }), num(key), el('span', { class: 'score-of nums', text: `/ ${max[key]}` }));
  const day = monthDay(attempt.submittedAt);
  const who = attempt.sample
    ? '견본 채점 화면 · 저장되지 않아요'
    : `${attempt.member || '이름 없음'}의 첫 시도${day ? ` · ${day} 제출` : ''}`;
  return el(
    'section',
    { attrs: { id: 'score' } },
    el('h2', { text: '채점 결과', attrs: { id: 'score-heading', tabindex: '-1' } }),
    el('p', { class: 'score-line' }, `${max.total}문제 중 `, num('total'), '문제 정답'),
    el('div', { class: 'score-figures' }, figure('개념', 'concept'), figure('코드 분석', 'code')),
    el('p', { class: 'attempt-member', text: who, attrs: { id: 'attempt-member' } }),
  );
}

// What the member answered, as text.
function givenText(q, given) {
  if (q.type === 'choice') return Number.isInteger(given) && q.choices[given] != null ? q.choices[given] : '';
  return typeof given === 'string' ? given.trim() : '';
}

const line = (label, ...value) => el('p', { class: 'r-line' }, el('span', { class: 'r-label', text: label }), ...value);

// One result block, placed before the question's prompt. result: { correct, blank }.
export function renderResultBlock(q, result, given, set) {
  const number = set.questions.indexOf(q) + 1;
  const verdict = result.correct ? '정답' : result.blank ? '오답 · 빈 답' : '오답';
  const mine = givenText(q, given);
  const others = q.type === 'short' && Array.isArray(q.answer) && q.answer.length > 1 ? q.answer.slice(1) : [];

  const block = el(
    'section',
    { class: 'q-result', dataset: { result: result.correct ? 'correct' : 'wrong' }, attrs: { 'aria-label': `${number}번 문제 채점 결과` } },
    el('span', { class: 'mark', attrs: { 'aria-hidden': 'true' } }),
    el('p', { class: 'verdict', text: verdict }),
    line('정답: ', correctAnswerText(q)),
    others.length ? line('다른 인정 답: ', others.join(', ')) : null,
    line('내 답: ', mine === '' ? '빈 답' : mine),
    el('div', { class: 'explain' }, explanationLines(q.explanation).map((text) => el('p', { class: 'explain-line', text }))),
  );

  if (q.concept && q.concept.name) {
    block.append(line('관련 개념: ', `${q.concept.name} · ${q.concept.ref}`));
  }
  const byId = new Map((set.sources || []).map((s) => [s.id, s]));
  for (const id of Array.isArray(q.sourceIds) ? q.sourceIds : []) {
    const source = byId.get(id);
    if (source) block.append(line('노션 출처: ', `${sourceLabel(source)} · ${source.title}`));
  }
  if (typeof q.file === 'string' && q.file) block.append(line('실습 파일 · ', q.file));
  return block;
}
