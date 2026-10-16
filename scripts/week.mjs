// Thin CLI over scripts/lib/week-core.mjs.
//   node scripts/week.mjs [--today YYYY-MM-DD] [--json]
// Exit 0 ok, 2 usage / unreadable input.
import { computeWindow, kstToday } from './lib/week-core.mjs';

const USAGE = `사용법: node scripts/week.mjs [--today YYYY-MM-DD] [--json]
  --today   기준 날짜 (기본: 오늘, 한국 시간)
  --json    스킬이 읽는 JSON으로 출력합니다
종료 코드: 0 정상 · 2 사용법 또는 입력 문제`;

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const dayName = (ymd) => DAY_NAMES[new Date(`${ymd}T00:00:00Z`).getUTCDay()];

class Exit extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parseArgs(argv) {
  const opts = { today: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--today') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Exit(2, `${a} 뒤에 값이 필요합니다\n${USAGE}`);
      opts.today = v;
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
  let w;
  try {
    w = computeWindow(today);
  } catch (err) {
    throw new Exit(2, `${err.message}\n${USAGE}`);
  }
  const report = {
    today: w.today,
    isFriday: w.isFriday,
    window: { from: w.from, to: w.to },
    weekId: w.weekId,
    previous: null,
    notes: [],
  };
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`기준 날짜(KST): ${report.today} (${dayName(report.today)})`);
    console.log(`출제 범위: ${w.from} ~ ${w.to}`);
    console.log(`주차 id: ${report.weekId}`);
  }
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
