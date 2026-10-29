// apps-script/Code.gs: PIN, first attempt only, own rows only, totals without names and only from MIN_TAKERS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScript } from '../scripts/lib/fake-apps-script.mjs';

const W = '2026-W44';
const answers = (correct) => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`q${i + 1}`, correct.includes(i + 1)]));

test('a GET answers that the web app is up', () => {
  assert.deepEqual(loadAppsScript().get(), { ok: true, service: 'study-review-quiz' });
});

test('unknown names and actions are refused', () => {
  const app = loadAppsScript();
  assert.equal(app.post({ action: 'status', name: '모르는 사람' }).error, 'bad-name');
  assert.equal(app.post({ action: 'drop', name: '김준수' }).error, 'bad-request');
  assert.equal(app.post('not json').error, 'bad-request');
});

test('a PIN is set once, stored hashed, and checked', () => {
  const app = loadAppsScript();
  assert.equal(app.post({ action: 'status', name: '김준수' }).hasPin, false);
  assert.equal(app.post({ action: 'setPin', name: '김준수', pin: '12a4' }).error, 'bad-pin-format');
  assert.equal(app.post({ action: 'setPin', name: '김준수', pin: '1234' }).ok, true);
  assert.equal(app.post({ action: 'setPin', name: '김준수', pin: '9999' }).error, 'pin-exists');
  assert.equal(app.post({ action: 'status', name: '김준수' }).hasPin, true);
  const stored = app.sheet('pins');
  assert.deepEqual(stored[0], ['name', 'pinHash']);
  assert.equal(stored[1][0], '김준수');
  assert.ok(!String(stored[1][1]).includes('1234'), 'the PIN itself is never stored');
  assert.equal(app.post({ action: 'check', name: '김준수', pin: '1234' }).ok, true);
  assert.equal(app.post({ action: 'check', name: '김준수', pin: '0000' }).error, 'bad-pin');
  assert.equal(app.post({ action: 'check', name: '이주현', pin: '1234' }).error, 'no-pin');
});

test('five wrong PINs lock the name, even for the right PIN', () => {
  const app = loadAppsScript();
  app.post({ action: 'setPin', name: '송지희', pin: '4321' });
  for (let i = 0; i < 4; i += 1) assert.equal(app.post({ action: 'check', name: '송지희', pin: '0000' }).error, 'bad-pin');
  assert.equal(app.post({ action: 'check', name: '송지희', pin: '0000' }).error, 'locked');
  assert.equal(app.post({ action: 'check', name: '송지희', pin: '4321' }).error, 'locked');
  app.expireLocks();
  assert.equal(app.post({ action: 'check', name: '송지희', pin: '4321' }).ok, true);
});

test('submit stores name, week, question, correct, once per name and week', () => {
  const app = loadAppsScript();
  app.post({ action: 'setPin', name: '노아영', pin: '1111' });
  assert.equal(app.post({ action: 'submit', name: '노아영', pin: '2222', week: W, results: answers([1]) }).error, 'bad-pin');
  assert.equal(app.post({ action: 'submit', name: '노아영', pin: '1111', week: 'W44', results: answers([1]) }).error, 'bad-week');
  assert.equal(app.post({ action: 'submit', name: '노아영', pin: '1111', week: W, results: {} }).error, 'bad-results');
  assert.deepEqual(app.post({ action: 'submit', name: '노아영', pin: '1111', week: W, results: answers([1, 2, 3]) }), { ok: true, already: false });
  assert.deepEqual(app.post({ action: 'submit', name: '노아영', pin: '1111', week: W, results: answers([]) }), { ok: true, already: true });
  const rows = app.sheet('results');
  assert.deepEqual(rows[0], ['name', 'week', 'question', 'correct']);
  assert.equal(rows.length, 11, 'header + ten rows, the second submit added nothing');
  assert.deepEqual(rows[1], ['노아영', W, 'q1', true]);
  assert.deepEqual(rows[10], ['노아영', W, 'q10', false]);
  // junk keys are dropped, not stored
  app.post({ action: 'setPin', name: '정보경', pin: '5555' });
  app.post({ action: 'submit', name: '정보경', pin: '5555', week: W, results: { q1: true, evil: true, q2: 'yes' } });
  assert.deepEqual(app.sheet('results').slice(11), [['정보경', W, 'q1', true]]);
});

test('mine returns only the caller\'s rows, and only with the PIN', () => {
  const app = loadAppsScript();
  app.post({ action: 'setPin', name: '김준수', pin: '1234' });
  app.post({ action: 'setPin', name: '이주현', pin: '5678' });
  app.post({ action: 'submit', name: '김준수', pin: '1234', week: W, results: answers([1, 2]) });
  app.post({ action: 'submit', name: '이주현', pin: '5678', week: W, results: answers([3]) });
  assert.equal(app.post({ action: 'mine', name: '김준수', pin: '5678' }).error, 'bad-pin');
  const mine = app.post({ action: 'mine', name: '김준수', pin: '1234' });
  assert.equal(mine.rows.length, 10);
  assert.ok(mine.rows.every((r) => r.week === W));
  assert.deepEqual(mine.rows.filter((r) => r.correct).map((r) => r.question), ['q1', 'q2']);
  assert.ok(!JSON.stringify(mine).includes('이주현'));
});

test('stats are totals per question, without names, only from three takers', () => {
  const app = loadAppsScript();
  const people = [['김준수', '1000', [1, 2]], ['이주현', '2000', [1]], ['차승환', '3000', [1, 2, 3]]];
  for (const [name, pin] of people) app.post({ action: 'setPin', name, pin });
  app.post({ action: 'submit', name: people[0][0], pin: people[0][1], week: W, results: answers(people[0][2]) });
  app.post({ action: 'submit', name: people[1][0], pin: people[1][1], week: W, results: answers(people[1][2]) });
  assert.deepEqual(app.post({ action: 'stats' }).weeks, {}, 'two takers: nothing is shown');
  app.post({ action: 'submit', name: people[2][0], pin: people[2][1], week: W, results: answers(people[2][2]) });
  const s = app.post({ action: 'stats' });
  assert.equal(s.minTakers, 3);
  assert.equal(s.weeks[W].takers, 3);
  assert.deepEqual(s.weeks[W].questions.q1, { right: 3, total: 3 });
  assert.deepEqual(s.weeks[W].questions.q2, { right: 2, total: 3 });
  assert.deepEqual(s.weeks[W].questions.q4, { right: 0, total: 3 });
  for (const [name] of people) assert.ok(!JSON.stringify(s).includes(name), `stats name ${name}`);
});
