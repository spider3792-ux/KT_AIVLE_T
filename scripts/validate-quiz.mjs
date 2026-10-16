// Thin CLI over scripts/lib/validate-core.mjs.
//   node scripts/validate-quiz.mjs <file> [--sources <records.json>] [--members <members.json>] [--strict]
// Exit 0 ok, 1 validation errors (or warnings with --strict), 2 usage / unreadable file / invalid JSON.
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { memberNames, validateSet } from './lib/validate-core.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const USAGE = `사용법: node scripts/validate-quiz.mjs <파일> [--sources <입력 기록.json>] [--members <members.json>] [--strict]
  <파일>       검사할 세트(quizzes/2026-W42.json) 또는 주차 목록(quizzes/index.json)
  --sources    노션 입력 기록 목록과 대조합니다 (출처 존재, 코드 원문 일치)
  --members    스터디원 이름 파일 (기본: 저장소 루트의 members.json)
  --strict     경고도 실패로 처리합니다
종료 코드: 0 통과 · 1 검사 실패 · 2 사용법 또는 파일 문제`;

class Exit extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function readJson(path) {
  if (!existsSync(path)) throw new Exit(2, `파일이 없습니다: ${path}`);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Exit(2, `파일을 읽지 못했어요: ${path} (${err.message})`);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // PowerShell writes a BOM
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Exit(2, `JSON을 읽지 못했어요: ${path} (${err.message})`);
  }
}

function parseArgs(argv) {
  const opts = { file: null, sources: null, members: null, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--strict') opts.strict = true;
    else if (a === '--sources' || a === '--members') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Exit(2, `${a} 뒤에 파일 경로가 필요합니다\n${USAGE}`);
      opts[a.slice(2)] = v;
      i += 1;
    } else if (a.startsWith('--')) {
      throw new Exit(2, `알 수 없는 옵션입니다: ${a}\n${USAGE}`);
    } else if (opts.file === null) opts.file = a;
    else throw new Exit(2, `파일은 하나만 검사할 수 있어요: ${a}\n${USAGE}`);
  }
  if (opts.file === null) throw new Exit(2, USAGE);
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv);
  const set = readJson(opts.file);

  let members;
  const membersPath = opts.members ?? resolve(ROOT, 'members.json');
  if (opts.members !== null || existsSync(membersPath)) members = memberNames(readJson(membersPath));

  const fileBase = basename(opts.file).replace(/\.json$/i, '');
  const result = validateSet(set, { fileBase, members });

  const errors = [...result.errors];
  const warnings = [...result.warnings];
  const notes = [];
  notes.push('참고: --sources 없이 검사해서 입력 기록 대조는 건너뛰었어요');

  const errLines = errors.map((e) => `오류 ${e.path}: ${e.message}`);
  const warnLines = warnings.map((w) => `경고 ${w.path}: ${w.message}`);
  if (errLines.length) console.error(errLines.join('\n'));
  if (warnLines.length) console.error(warnLines.join('\n'));

  const failed = errors.length > 0 || (opts.strict && warnings.length > 0);
  if (failed) {
    console.error(`실패: ${opts.file} · 오류 ${errors.length}개 · 경고 ${warnings.length}개`);
    return 1;
  }

  const qs = Array.isArray(set.questions) ? set.questions : [];
  const concept = qs.filter((q) => q.kind === 'concept').length;
  const code = qs.filter((q) => q.kind === 'code').length;
  const sources = Array.isArray(set.sources) ? set.sources.length : 0;
  console.log(`통과: ${opts.file} · ${qs.length}문제 (개념 ${concept} · 코드 분석 ${code}) · 출처 ${sources}개`);
  if (warnings.length) console.log(`경고 ${warnings.length}개 (위 stderr 참고)`);
  for (const n of notes) console.log(n);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (err instanceof Exit) {
    console.error(err.message);
    process.exitCode = err.code;
  } else {
    console.error(`예상하지 못한 오류: ${err && err.message ? err.message : err}`);
    process.exitCode = 2;
  }
}
