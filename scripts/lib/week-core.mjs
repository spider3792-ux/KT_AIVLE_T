// Pure week math for the weekly generator: no fs, no process, no local-time Date.
// Every calendar computation runs on UTC midnight so the machine's time zone cannot shift a day.
import { isRealDate } from './validate-core.mjs';

const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 3600000; // Korea has no daylight saving

const toMs = (ymd) => new Date(`${ymd}T00:00:00Z`).getTime();
const toYmd = (ms) => new Date(ms).toISOString().slice(0, 10);

// The KST calendar date (YYYY-MM-DD) of a millisecond timestamp.
export function kstToday(nowMs = Date.now()) {
  return toYmd(nowMs + KST_OFFSET_MS);
}

// YYYY-MM-DD shifted by n days (negative allowed).
export function addDays(ymd, n) {
  return toYmd(toMs(ymd) + n * DAY_MS);
}

// The latest Friday on or before the date (a Friday returns itself).
export function fridayOnOrBefore(ymd) {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(ymd, -((dow + 2) % 7)); // Fri 5 -> 0, Sat 6 -> 1, Sun 0 -> 2, Thu 4 -> 6
}

// ISO-8601 week id (YYYY-Www): the week belongs to the year of its Thursday.
export function isoWeekId(ymd) {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7; // Monday 1 .. Sunday 7
  const thursday = addDays(ymd, 4 - dow);
  const year = Number(thursday.slice(0, 4));
  const dayOfYear = Math.round((toMs(thursday) - toMs(`${year}-01-01`)) / DAY_MS) + 1;
  const week = 1 + Math.floor((dayOfYear - 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Window = last Friday through the latest Friday on or before today, inclusive on both ends.
export function computeWindow(today) {
  if (!isRealDate(today)) {
    throw new Error(`날짜 형식이 올바르지 않습니다 (YYYY-MM-DD, 현재 ${typeof today === 'string' ? today : String(today)})`);
  }
  const to = fridayOnOrBefore(today);
  return { today, isFriday: to === today, from: addDays(to, -7), to, weekId: isoWeekId(to) };
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
export const dayName = (ymd) => DAY_NAMES[new Date(`${ymd}T00:00:00Z`).getUTCDay()];

// The previous set is the newest entry whose id is strictly below the target week id, NOT blindly
// the first index entry. This clarifies "the newest set in quizzes/index.json" for the case where
// the newest set IS the target week (the sample 2026-W42 shares its id with the first real week):
// a re-make must not exclude its own sources. Week ids sort correctly as strings (YYYY-Www).
export function pickPreviousSet(index, weekId) {
  let best = null;
  for (const e of index) {
    if (!e || typeof e.id !== 'string' || !(e.id < weekId)) continue;
    if (best === null || e.id > best.id) best = e;
  }
  return best;
}

// author + date + title of each source, enough for the skill to match records without ids.
export function usedSources(set) {
  const sources = set && Array.isArray(set.sources) ? set.sources : [];
  return sources
    .filter((s) => s && typeof s.author === 'string' && typeof s.date === 'string' && typeof s.title === 'string')
    .map((s) => ({ author: s.author, date: s.date, title: s.title }));
}

// readSet(file) is injected: it returns the parsed set for an index entry's `file`.
export function buildReport({ today, index, readSet }) {
  if (!Array.isArray(index)) throw new Error('주차 목록은 배열이어야 합니다');
  const w = computeWindow(today);
  const entry = pickPreviousSet(index, w.weekId);
  const previous = entry
    ? { id: entry.id, title: typeof entry.title === 'string' ? entry.title : '', used: usedSources(readSet(entry.file)) }
    : null;
  const notes = [];
  if (!w.isFriday) {
    notes.push(
      `오늘(${w.today}, ${dayName(w.today)})은 금요일이 아니어서 가장 가까운 지난 금요일(${w.to})까지로 잡았어요. 다른 금요일로 바꾸려면 --today 날짜를 바꿔 다시 실행하세요.`,
    );
  }
  if (previous === null) notes.push('직전 세트가 없어서 제외할 기록이 없어요.');
  return { today: w.today, isFriday: w.isFriday, window: { from: w.from, to: w.to }, weekId: w.weekId, previous, notes };
}
