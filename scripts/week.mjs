// Thin CLI over scripts/lib/week-core.mjs.
//   node scripts/week.mjs [--today YYYY-MM-DD] [--quizzes DIR] [--json]
// Exit 0 ok, 2 usage / unreadable input.
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, dayName, kstToday } from './lib/week-core.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const USAGE = `사용법: node scripts/week.mjs [--today YYYY-MM-DD] [--quizzes <폴더>] [--json]
  --today     기준 날짜 (기본: 오늘, 한국 시간)
  --quizzes   주차 목록(index.json)이 있는 폴더 (기본: 저장소 루트의 quizzes)
  --json      스킬이 읽는 JSON으로 출력합니다
종료 코드: 0 정상 · 2 사용법 또는 입력 문제`;

class Exit extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function readJson(path, missingMessage) {
  if (!existsSync(path)) throw new Exit(2, missingMessage);
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
  const opts = { today: null, quizzes: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--today' || a === '--quizzes') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Exit(2, `${a} 뒤에 값이 필요합니다\n${USAGE}`);
      opts[a.slice(2)] = v;
      i += 1;
    } else if (a.startsWith('--')) {
      throw new Exit(2, `알 수 없는 옵션입니다: ${a}\n${USAGE}`);
    } else throw new Exit(2, `알 수 없는 인자입니다: ${a}\n${USAGE}`);
  }
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv);
  const today = opts.today ?? kstToday(Date.now());
  const dir = opts.quizzes === null ? resolve(ROOT, 'quizzes') : resolve(opts.quizzes);
  const indexPath = resolve(dir, 'index.json');
  const index = readJson(indexPath, `주차 목록을 찾지 못했어요: ${indexPath}`);

  // Only the basename of an index entry's `file` is read, inside the chosen folder (same rule as validate-quiz.mjs).
  const readSet = (file) => {
    const p = resolve(dir, basename(String(file)));
    return readJson(p, `직전 세트 파일을 찾지 못했어요: ${p}`);
  };

  let report;
  try {
    report = buildReport({ today, index, readSet });
  } catch (err) {
    if (err instanceof Exit) throw err;
    throw new Exit(2, `${err.message}\n${USAGE}`);
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }
  console.log(`기준 날짜(KST): ${report.today} (${dayName(report.today)})`);
  console.log(`출제 범위: ${report.window.from} ~ ${report.window.to}`);
  console.log(`주차 id: ${report.weekId}`);
  if (report.previous) {
    const p = report.previous;
    console.log(`직전 세트: ${p.id} · ${p.title} · 사용한 기록 ${p.used.length}개`);
    for (const u of p.used) console.log(`  - ${u.author} · ${u.date} · ${u.title}`);
  } else {
    console.log('직전 세트: 없음');
  }
  for (const n of report.notes) console.log(`참고: ${n}`);
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
