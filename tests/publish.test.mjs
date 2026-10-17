import test from 'node:test';
import assert from 'node:assert/strict';
import { entryFor, upsertIndex } from '../scripts/lib/publish-core.mjs';

const W42 = { id: '2026-W42', title: '10월 셋째 주 시험지', published: '2026-10-16', file: 'quizzes/2026-W42.json' };

test('entryFor builds the index entry from the set', () => {
  assert.deepEqual(entryFor({ id: '2026-W43', title: ' 10월 넷째 주 시험지 ' }, '2026-10-23'), {
    id: '2026-W43',
    title: '10월 넷째 주 시험지',
    published: '2026-10-23',
    file: 'quizzes/2026-W43.json',
  });
});

test('entryFor rejects a bad id or a missing title', () => {
  assert.throws(() => entryFor({ id: '2026-43', title: 'x' }, '2026-10-23'), /YYYY-Www/);
  assert.throws(() => entryFor({ id: '2026-W43', title: '' }, '2026-10-23'), /title/);
});

test('upsertIndex puts a newer week first', () => {
  const e = entryFor({ id: '2026-W43', title: 't' }, '2026-10-23');
  const { index, replaced } = upsertIndex([W42], e);
  assert.equal(replaced, false);
  assert.deepEqual(index.map((x) => x.id), ['2026-W43', '2026-W42']);
});

test('upsertIndex replaces the same id instead of duplicating it', () => {
  const e = entryFor({ id: '2026-W42', title: '진짜 세트' }, '2026-10-17');
  const { index, replaced } = upsertIndex([W42], e);
  assert.equal(replaced, true);
  assert.equal(index.length, 1);
  assert.equal(index[0].title, '진짜 세트');
});

test('upsertIndex keeps id-descending order across years', () => {
  const e = entryFor({ id: '2026-W53', title: 't' }, '2027-01-01');
  const old = { ...W42, id: '2025-W50', file: 'quizzes/2025-W50.json' };
  const { index } = upsertIndex([W42, old], e);
  assert.deepEqual(index.map((x) => x.id), ['2026-W53', '2026-W42', '2025-W50']);
});
