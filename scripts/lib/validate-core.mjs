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

// ---- week list (quizzes/index.json) ----

// ctx = { listQuizFiles() -> string[] (exact-case file names in quizzes/), readSet(file) -> parsed set }
// listQuizFiles comes from readdirSync: Windows existsSync ignores case, GitHub Pages does not.
export function validateIndex(index, ctx = {}) {
  const out = collector();
  const { error } = out;

  if (!Array.isArray(index)) {
    error('(목록)', '주차 목록은 배열이어야 합니다');
    return { errors: out.errors, warnings: out.warnings };
  }
  if (index.length === 0) {
    error('(목록)', '주차 목록이 비어 있습니다');
    return { errors: out.errors, warnings: out.warnings };
  }

  const names = typeof ctx.listQuizFiles === 'function' ? new Set(ctx.listQuizFiles()) : null;
  const seen = new Set();

  index.forEach((e, i) => {
    const label = isObj(e) && typeof e.id === 'string' ? `index[${i}] (${e.id})` : `index[${i}]`;
    if (!isObj(e)) {
      error(label, '주차 항목은 객체여야 합니다');
      return;
    }
    const idOk = typeof e.id === 'string' && WEEK_ID.test(e.id);
    if (!idOk) error(label, `id는 YYYY-Www 형식이어야 합니다 (현재 ${show(e.id)})`);
    else if (seen.has(e.id)) error(label, `id가 겹칩니다 (${e.id})`);
    else seen.add(e.id);

    if (!isText(e.title)) error(label, '제목(title)이 비어 있습니다');
    if (!isRealDate(e.published)) {
      error(label, `날짜 형식이 올바르지 않습니다 (published, YYYY-MM-DD, 현재 ${show(e.published)})`);
    }

    const expected = idOk ? `quizzes/${e.id}.json` : null;
    const fileOk = typeof e.file === 'string' && expected !== null && e.file === expected;
    if (!fileOk) {
      error(label, `file은 quizzes/ID.json이어야 합니다 (현재 ${show(e.file)}${expected ? `, 기대 ${expected}` : ''})`);
    } else if (names) {
      if (!names.has(`${e.id}.json`)) {
        error(label, `파일이 없습니다 (대소문자까지 같아야 합니다): ${e.file}`);
      } else if (typeof ctx.readSet === 'function') {
        let set;
        try {
          set = ctx.readSet(e.file);
        } catch (err) {
          error(label, `주차 파일을 읽지 못했어요: ${e.file} (${err && err.message ? err.message : err})`);
        }
        if (set !== undefined && (!isObj(set) || set.id !== e.id)) {
          error(label, `주차 파일의 id가 목록과 다릅니다 (목록 ${e.id}, 파일 ${show(isObj(set) ? set.id : undefined)})`);
        }
      }
    }

    if (i > 0 && isObj(index[i - 1])) {
      const p = index[i - 1];
      if (typeof p.published === 'string' && typeof e.published === 'string') {
        const older = e.published > p.published || (e.published === p.published && String(e.id) > String(p.id));
        if (older) error(label, '주차 목록은 최신순이어야 합니다 (published 내림차순, 같으면 id 내림차순)');
      }
    }
  });

  return { errors: out.errors, warnings: out.warnings };
}

// ---- --sources: input records list (the Phase 2 generator writes it) ----
// Kept in parseRecords / checkAgainstRecords so a later phase can change the record format in one place.
// { records: [ { id, author, date, title, subject, codeBlocks: [string], files: [string] } ] }

const RECORDS_BAD = '입력 기록 파일 형식이 올바르지 않습니다';

// Returns Map<id, record>. Throws an Error whose message starts with the Korean stem when the shape is wrong.
export function parseRecords(json) {
  if (!isObj(json) || !Array.isArray(json.records)) {
    throw new Error(`${RECORDS_BAD} ({ "records": [ ... ] } 이어야 합니다)`);
  }
  const map = new Map();
  json.records.forEach((r, i) => {
    const where = `records[${i}]`;
    if (!isObj(r)) throw new Error(`${RECORDS_BAD} (${where}는 객체여야 합니다)`);
    for (const k of ['id', 'author', 'date']) {
      if (!isText(r[k])) throw new Error(`${RECORDS_BAD} (${where}.${k}가 필요합니다)`);
    }
    for (const k of ['codeBlocks', 'files']) {
      if (has(r, k) && !(Array.isArray(r[k]) && r[k].every((x) => typeof x === 'string'))) {
        throw new Error(`${RECORDS_BAD} (${where}.${k}는 문자열 목록이어야 합니다)`);
      }
    }
    if (map.has(r.id)) throw new Error(`${RECORDS_BAD} (${where}.id가 겹칩니다: ${r.id})`);
    map.set(r.id, {
      id: r.id,
      author: r.author,
      date: r.date,
      title: typeof r.title === 'string' ? r.title : '',
      subject: typeof r.subject === 'string' ? r.subject : '',
      codeBlocks: has(r, 'codeBlocks') ? [...r.codeBlocks] : [],
      files: has(r, 'files') ? [...r.files] : [],
    });
  });
  return map;
}

// The lines of a code block that say something: comments, blank lines, imports and short lines
// (brackets, `.sum()`) do not count, and spacing is collapsed so re-indenting a copy does not hide it.
const codeLines = (s) =>
  s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim().replace(/\s+/g, ' '))
    .filter((l) => l.length >= 12 && !/^(import|from)\s/.test(l));

export function checkAgainstRecords(set, records) {
  const out = collector();
  const { error, warn } = out;
  if (!isObj(set) || !(records instanceof Map)) return { errors: out.errors, warnings: out.warnings };

  const sources = Array.isArray(set.sources) ? set.sources : [];
  sources.forEach((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string') return;
    const label = `sources[${i}] (${s.id})`;
    const rec = records.get(s.id);
    if (!rec) {
      error(label, `출처 ${s.id}가 입력 기록 목록에 없습니다`);
    } else if (rec.author !== s.author || rec.date !== s.date) {
      error(label, `출처 ${s.id}의 작성자·날짜가 입력 기록과 다릅니다 (세트 ${show(s.author)} ${show(s.date)}, 기록 ${rec.author} ${rec.date})`);
    }
  });

  const allFiles = new Set([...records.values()].flatMap((r) => r.files));
  // KT AIVLE rule: course practice code, assignments and answers are never published as they are, so a code
  // question shows code written anew from the concept, not lines lifted from the notes or practice files.
  const recordLines = new Set([...records.values()].flatMap((r) => r.codeBlocks.flatMap(codeLines)));
  const questions = Array.isArray(set.questions) ? set.questions : [];
  questions.forEach((q, i) => {
    if (!isObj(q)) return;
    const label = typeof q.id === 'string' ? `questions[${i}] (${q.id})` : `questions[${i}]`;
    if (isText(q.file) && !allFiles.has(q.file)) {
      error(label, `실습 파일 ${q.file}가 입력 기록에 없습니다`);
    }
    if (q.kind === 'code' && isText(q.code)) {
      const copied = codeLines(q.code).filter((l) => recordLines.has(l));
      if (copied.length >= 2) {
        error(label, `코드가 입력 기록의 코드를 그대로 옮겼습니다 (같은 줄 ${copied.length}개). 개념을 바탕으로 새로 작성해 주세요`);
      } else if (copied.length === 1) {
        warn(label, `코드 한 줄이 입력 기록과 같습니다: ${copied[0]}`);
      }
    }
  });

  return { errors: out.errors, warnings: out.warnings };
}
