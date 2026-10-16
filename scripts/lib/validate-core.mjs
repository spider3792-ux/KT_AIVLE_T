// Pure checker for one week's quiz set. No fs, no process: the CLI and the tests feed it parsed JSON.
// Shares js/grade.js with the browser so "what the checker accepts" and "what the sheet grades" agree.
// Never merges parsed objects into others; only Object.hasOwn and plain reads.
import { normalizeAnswer, explanationLines } from '../../js/grade.js';

const WEEK_ID = /^\d{4}-W\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const QUESTION_ID = /^q([1-9]|10)$/;
const HANGUL = /[ㄱ-ㆎ가-힣]/;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const show = (v) => (v === undefined ? '없음' : typeof v === 'string' ? v : JSON.stringify(v));
const has = (o, k) => isObj(o) && Object.hasOwn(o, k);

// YYYY-MM-DD that survives a round trip through Date (2026-02-31 does not).
export function isRealDate(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const collector = () => {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    error: (path, message) => errors.push({ path, message }),
    warn: (path, message) => warnings.push({ path, message }),
  };
};

export function memberNames(membersJson) {
  if (!isObj(membersJson) || !Array.isArray(membersJson.members)) return [];
  return membersJson.members.filter((m) => isObj(m) && typeof m.name === 'string').map((m) => m.name);
}

// ctx = { fileBase?: string, members?: string[] }
export function validateSet(set, ctx = {}) {
  const out = collector();
  const { error, warn } = out;

  if (!isObj(set)) {
    error('(파일)', '세트 파일은 JSON 객체여야 합니다');
    return { errors: out.errors, warnings: out.warnings };
  }

  // ---- header ----
  for (const key of ['id', 'title', 'range', 'estimatedMinutes', 'sources', 'questions']) {
    if (!has(set, key)) error(key, `필수 항목 ${key}가 없습니다`);
  }

  if (has(set, 'id')) {
    if (typeof set.id !== 'string' || !WEEK_ID.test(set.id)) {
      error('id', `id는 YYYY-Www 형식이어야 합니다 (현재 ${show(set.id)})`);
    } else if (typeof ctx.fileBase === 'string' && WEEK_ID.test(ctx.fileBase) && ctx.fileBase !== set.id) {
      error('id', `id가 파일 이름과 다릅니다 (id ${set.id}, 파일 ${ctx.fileBase})`);
    }
  }

  if (has(set, 'title')) {
    if (!isText(set.title)) {
      error('title', '제목(title)이 비어 있습니다');
    } else {
      if (!HANGUL.test(set.title)) warn('title', '제목에 한글이 없습니다');
      const len = [...set.title].length;
      if (len > 14) warn('title', `제목이 깁니다 (14자 이하 권장, 현재 ${len}자)`);
    }
  }

  let rangeFrom = null;
  let rangeTo = null;
  if (has(set, 'range')) {
    if (!isObj(set.range)) {
      error('range', '필수 항목 range.from, range.to가 없습니다');
    } else {
      let okFrom = false;
      let okTo = false;
      for (const k of ['from', 'to']) {
        if (isRealDate(set.range[k])) {
          if (k === 'from') okFrom = true;
          else okTo = true;
        } else {
          error(`range.${k}`, `날짜 형식이 올바르지 않습니다 (YYYY-MM-DD, 현재 ${show(set.range[k])})`);
        }
      }
      if (okFrom) rangeFrom = set.range.from;
      if (okTo) rangeTo = set.range.to;
      if (okFrom && okTo && set.range.from > set.range.to) {
        error('range', `range.from(${set.range.from})이 range.to(${set.range.to})보다 늦습니다`);
      }
    }
  }

  if (has(set, 'estimatedMinutes')) {
    const m = set.estimatedMinutes;
    if (!Number.isInteger(m) || m <= 0) {
      error('estimatedMinutes', `예상 풀이 시간(estimatedMinutes)은 1 이상의 정수여야 합니다 (현재 ${show(m)})`);
    } else if (m < 10 || m > 20) {
      warn('estimatedMinutes', `예상 풀이 시간은 10~20분을 권장합니다 (현재 ${m}분)`);
    }
  }

  // ---- sources ----
  const sourceIds = new Set();
  const sourcePath = new Map();
  if (has(set, 'sources')) {
    if (!Array.isArray(set.sources)) {
      error('sources', 'sources는 목록(배열)이어야 합니다');
    } else {
      set.sources.forEach((s, i) => {
        const label = isObj(s) && isText(s.id) ? `sources[${i}] (${s.id})` : `sources[${i}]`;
        if (!isObj(s)) {
          error(label, '출처는 객체여야 합니다');
          return;
        }
        if (!isText(s.id)) {
          error(label, '출처 id가 비어 있습니다');
        } else if (sourceIds.has(s.id)) {
          error(label, `출처 id가 겹칩니다 (${s.id})`);
        } else {
          sourceIds.add(s.id);
          sourcePath.set(s.id, label);
        }
        if (!isText(s.author)) {
          error(label, '작성자(author)가 비어 있습니다');
        } else if (Array.isArray(ctx.members) && !ctx.members.includes(s.author)) {
          error(label, `작성자 ${s.author}이(가) members.json에 없습니다`);
        }
        if (!isRealDate(s.date)) {
          error(label, `날짜 형식이 올바르지 않습니다 (YYYY-MM-DD, 현재 ${show(s.date)})`);
        } else if ((rangeFrom && s.date < rangeFrom) || (rangeTo && s.date > rangeTo)) {
          warn(label, `출처 날짜가 출제 범위 밖입니다 (${s.date}, 범위 ${rangeFrom ?? '?'} ~ ${rangeTo ?? '?'})`);
        }
        if (!isText(s.title)) error(label, '제목(title)이 비어 있습니다');
        if (!isText(s.subject)) error(label, '주제(subject)가 비어 있습니다');
      });
    }
  }

  // ---- questions ----
  const used = new Set();
  const choiceAnswerCount = [0, 0, 0, 0];
  if (has(set, 'questions')) {
    if (!Array.isArray(set.questions)) {
      error('questions', 'questions는 목록(배열)이어야 합니다');
    } else {
      const qs = set.questions;
      if (qs.length !== 10) error('questions', `10문제여야 합니다 (현재 ${qs.length}문제)`);

      const concept = qs.filter((x) => isObj(x) && x.kind === 'concept').length;
      const code = qs.filter((x) => isObj(x) && x.kind === 'code').length;
      if (concept !== 7 || code !== 3) {
        error('questions', `개념 7문제 + 코드 분석 3문제여야 합니다 (현재 개념 ${concept}, 코드 분석 ${code})`);
      }

      const seen = new Set();
      qs.forEach((q, i) => {
        if (!isObj(q)) {
          error(`questions[${i}]`, '문제는 객체여야 합니다');
          return;
        }
        const label = typeof q.id === 'string' ? `questions[${i}] (${q.id})` : `questions[${i}]`;

        if (typeof q.id !== 'string' || !QUESTION_ID.test(q.id) || seen.has(q.id)) {
          error(label, '문제 id는 q1~q10이어야 하고 겹치면 안 됩니다');
        }
        if (typeof q.id === 'string') seen.add(q.id);

        const kindOk = q.kind === 'concept' || q.kind === 'code';
        const typeOk = q.type === 'choice' || q.type === 'short';
        if (!kindOk) error(label, `kind는 concept 또는 code만 쓸 수 있습니다 (현재 ${show(q.kind)})`);
        if (!typeOk) error(label, `type은 choice 또는 short만 쓸 수 있습니다 (서술형 없음) (현재 ${show(q.type)})`);

        if (!isText(q.prompt)) error(label, '문제(prompt)가 비어 있습니다');
        else if (!HANGUL.test(q.prompt)) warn(label, '문제에 한글이 없습니다');

        // answers
        if (q.type === 'choice') {
          const choices = q.choices;
          if (!Array.isArray(choices) || choices.length !== 4) {
            error(label, `객관식 보기는 4개여야 합니다 (현재 ${Array.isArray(choices) ? choices.length : 0}개)`);
          } else {
            choices.forEach((c, k) => {
              if (!isText(c)) error(label, `객관식 보기(choices[${k}])가 비어 있습니다`);
            });
            const norm = choices.filter(isText).map(normalizeAnswer);
            if (new Set(norm).size !== norm.length) error(label, '객관식 보기가 중복됩니다');
          }
          if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
            error(label, `정답 번호는 0~3 사이 정수여야 합니다 (현재 ${show(q.answer)})`);
          } else {
            choiceAnswerCount[q.answer] += 1;
          }
        } else if (q.type === 'short') {
          const a = q.answer;
          const good = Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === 'string' && normalizeAnswer(x) !== '');
          if (!good) {
            error(label, '단답형 인정 정답이 1개 이상 있어야 합니다 (빈 문자열 불가)');
          } else {
            const firstFor = new Map();
            for (const x of a) {
              const n = normalizeAnswer(x);
              if (firstFor.has(n)) warn(label, `인정 정답 ${firstFor.get(n)}와 ${x}가 같은 답으로 처리됩니다`);
              else firstFor.set(n, x);
            }
          }
          if (has(q, 'choices')) error(label, '단답형에는 choices(보기)를 넣지 않습니다');
        }

        // code
        if (q.kind === 'code') {
          if (!isText(q.code)) error(label, '코드 분석 문제에는 code(코드 원문)가 있어야 합니다');
        } else if (q.kind === 'concept' && has(q, 'code')) {
          error(label, '개념 문제에는 code를 넣지 않습니다');
        }
        if (typeof q.code === 'string' && q.code.includes('\r')) {
          error(label, 'code의 줄바꿈은 \\n만 씁니다 (\\r 제거)');
        }

        // explanation
        if (!isText(q.explanation)) {
          error(label, '해설(explanation)이 비어 있습니다');
        } else {
          const lines = explanationLines(q.explanation);
          if (lines.length > 5) error(label, `해설은 5줄 이내여야 합니다 (현재 ${lines.length}줄)`);
          if (lines.some((l) => [...l].length > 100)) warn(label, '해설 한 줄이 깁니다 (100자 이하 권장)');
        }

        // concept
        if (!isObj(q.concept) || !isText(q.concept.name) || !isText(q.concept.ref)) {
          error(label, '관련 개념(concept.name, concept.ref)이 필요합니다');
        }

        // provenance
        const ids = Array.isArray(q.sourceIds) ? q.sourceIds : [];
        const hasIds = ids.length > 0;
        const hasFile = isText(q.file);
        if (!hasIds && !hasFile) error(label, '노션 출처(sourceIds) 또는 실습 파일(file)이 필요합니다');
        for (const sid of ids) {
          if (typeof sid === 'string' && sourceIds.has(sid)) used.add(sid);
          else error(label, `출처 ${show(sid)}가 sources 목록에 없습니다`);
        }
      });
    }
  }

  for (const id of sourceIds) {
    if (!used.has(id)) warn(sourcePath.get(id), `출처 ${id}를 쓰는 문제가 없습니다`);
  }

  const top = choiceAnswerCount.findIndex((n) => n >= 6);
  if (top !== -1) {
    warn('questions', `정답 번호가 한쪽에 몰려 있습니다 (객관식 ${choiceAnswerCount[top]}문제의 정답이 ${top + 1}번)`);
  }

  return { errors: out.errors, warnings: out.warnings };
}
