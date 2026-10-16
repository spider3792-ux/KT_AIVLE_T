// Pure grading module. No DOM, no storage. Shared by the browser, the validator and the tests.
// Browser-loaded: never use regex lookbehind here (Safari below 16.4 refuses to parse the module).

const chars = (...cps) => cps.map((c) => String.fromCodePoint(c)).join('');
const span = (a, b) => `${chars(a)}-${chars(b)}`;

// Soft hyphen, zero-width and bidi marks, bidi embeddings, word joiner to invisible operators, BOM.
// Built numerically so no invisible character lives in this source file.
const INVISIBLE = new RegExp(
  `[${chars(0xad)}${span(0x200b, 0x200f)}${span(0x202a, 0x202e)}${span(0x2060, 0x2064)}${chars(0xfeff)}]`,
  'g',
);
// Separators people type inside terms: underscore, middle dot, araea (raw and post-NFKC forms),
// hyphenation point, katakana middle dot, bullet operator, bullet.
const SEP = chars(0x5f, 0xb7, 0x119e, 0x318d, 0x2027, 0x30fb, 0x2219, 0x2022);
// Capture the left character instead of looking behind for it.
const SEPARATORS = new RegExp(String.raw`([\p{L}\p{N}])[${SEP}]+(?=[\p{L}\p{N}])`, 'gu');

export function normalizeAnswer(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC') // full-width to half-width, composes decomposed Hangul
    .replace(INVISIBLE, '')
    .toLowerCase() // locale independent on purpose
    .replace(/\s+/g, '') // every kind of space
    .replace(/\(\)/g, '') // groupby() equals groupby
    .replace(SEPARATORS, '$1') // train_test_split equals traintestsplit
    .replace(/[.!?]+$/, ''); // trailing sentence punctuation only; "-" and "." inside stay
}

export function isBlank(q, given) {
  return q.type === 'choice' ? !Number.isInteger(given) : normalizeAnswer(given) === '';
}

export function gradeQuestion(q, given) {
  if (isBlank(q, given)) return { correct: false, blank: true };
  if (q.type === 'choice') return { correct: given === q.answer, blank: false };
  const g = normalizeAnswer(given);
  return { correct: q.answer.some((a) => normalizeAnswer(a) === g), blank: false };
}

export function gradeSet(set, answers) {
  const results = {};
  const score = { total: 0, concept: 0, code: 0 };
  const max = { total: set.questions.length, concept: 0, code: 0 };
  const given = answers || {};
  for (const q of set.questions) {
    const slot = q.kind === 'code' ? 'code' : 'concept';
    max[slot] += 1;
    const r = gradeQuestion(q, given[q.id]);
    results[q.id] = r;
    if (r.correct) {
      score.total += 1;
      score[slot] += 1;
    }
  }
  return { results, score, max };
}

// "이주현 · 10/14": month and day without zero padding.
export function sourceLabel(source) {
  const [, m, d] = String(source.date).split('-');
  return `${source.author} · ${Number(m)}/${Number(d)}`;
}

export function explanationLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function correctAnswerText(q) {
  return q.type === 'choice' ? q.choices[q.answer] : q.answer[0];
}

// Stored answers are untrusted on read: keep only known question ids and well-formed values.
export function sanitizeAnswers(set, raw) {
  const out = Object.create(null);
  if (!raw || typeof raw !== 'object') return out;
  for (const q of set.questions) {
    if (!Object.prototype.hasOwnProperty.call(raw, q.id)) continue;
    const v = raw[q.id];
    if (q.type === 'choice') {
      if (Number.isInteger(v) && v >= 0 && v < q.choices.length) out[q.id] = v;
    } else if (typeof v === 'string' && v.length <= 200) {
      out[q.id] = v;
    }
  }
  return out;
}
