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
