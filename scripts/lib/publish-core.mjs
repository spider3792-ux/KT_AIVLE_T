// Pure helpers for scripts/publish-week.mjs: build the index entry for a week's set and
// insert it into quizzes/index.json (newest week first, one entry per id).

export const WEEK_ID = /^\d{4}-W\d{2}$/;

export function entryFor(set, publishedYmd) {
  if (!set || typeof set !== 'object') throw new Error('세트가 객체가 아니에요');
  if (!WEEK_ID.test(String(set.id))) throw new Error(`세트 id가 YYYY-Www 형식이 아니에요: ${set.id}`);
  if (typeof set.title !== 'string' || !set.title.trim()) throw new Error('세트에 title이 없어요');
  return { id: set.id, title: set.title.trim(), published: publishedYmd, file: `quizzes/${set.id}.json` };
}

// Returns { index, replaced }: a new array with the entry inserted (or the same id replaced),
// sorted by id descending so the site's first entry stays "이번 주".
export function upsertIndex(index, entry) {
  if (!Array.isArray(index)) throw new Error('quizzes/index.json이 배열이 아니에요');
  const replaced = index.some((e) => e && e.id === entry.id);
  const next = index.filter((e) => e && e.id !== entry.id).concat([entry]);
  next.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return { index: next, replaced };
}
