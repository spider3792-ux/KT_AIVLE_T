// Team scenario against the fake web app (scripts/serve.mjs --fake-sheet runs apps-script/Code.gs in memory):
// send a first attempt with a new PIN, team rates once three members sent, the PIN-locked notebook, the home spines.
import { fill, mixedAnswers } from './result.smoke.mjs';

export const name = 'team';

const PIN_A = '4826';

// Fills dialog#pin and submits it the way Enter would.
async function answerPin(kit, page, pin, { twice }) {
  await kit.waitFor(page, () => document.querySelector('dialog#pin[open]'));
  await page.eval(
    ({ pin, twice }) => {
      document.getElementById('pin-1').value = pin;
      if (twice) document.getElementById('pin-2').value = pin;
      document.querySelector('dialog#pin form').requestSubmit();
      return true;
    },
    { pin, twice },
  );
}

export default async function team(kit) {
  const { assert, data, sleep } = kit;
  const { set, members } = data;
  const who = members[0].name;
  await fetch(`${kit.BASE}/__sheet/reset`, { method: 'POST' });

  // (a) the first attempt goes to the sheet after a new PIN
  const page = await kit.open('quiz.html', { width: 1440, height: 900 });
  await kit.waitFor(page, () => document.querySelectorAll('li.q').length > 0);
  await kit.chooseMember(page, who);
  const mixed = mixedAnswers(set);
  await fill(page, set, mixed);
  await sleep(400);
  await kit.submitSheet(page);
  await kit.waitFor(page, () => document.querySelector('#team-send'));
  const before = await page.eval(() => ({ rates: document.querySelectorAll('.team-rate').length, text: document.querySelector('#team-status').textContent }));
  assert.equal(before.rates, 0, 'no team rates before anyone sent');
  assert.ok(before.text.includes('팀 기록에 보내면'), `send line: ${before.text}`);
  await page.eval(() => {
    document.querySelector('#team-send').click();
    return true;
  });
  await answerPin(kit, page, PIN_A, { twice: true });
  await kit.waitFor(page, () => (document.querySelector('#team-status')?.textContent || '').includes('보냈어요'));
  assert.equal(await page.eval(() => !!document.querySelector('dialog#pin')), false, 'the PIN slip is gone');

  // (b) two more members send; with three takers every question shows its team rate
  const post = (body) => fetch(`${kit.BASE}/__sheet`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
  const all = (right) => Object.fromEntries(set.questions.map((q, i) => [q.id, right.includes(i)]));
  for (const [i, pin] of [[1, '1111'], [2, '2222']]) {
    assert.equal((await post({ action: 'setPin', name: members[i].name, pin })).ok, true);
    assert.equal((await post({ action: 'submit', name: members[i].name, pin, week: set.id, results: all([0, 1, 2]) })).ok, true);
  }
  await page.eval(() => {
    location.reload();
    return true;
  });
  await kit.waitFor(page, () => document.querySelectorAll('.team-rate').length === 10);
  const rates = await page.eval(() => [...document.querySelectorAll('.team-rate')].map((p) => p.textContent));
  assert.ok(rates.every((t) => /^팀 정답률: \d+% · 3명 중 \d명$/.test(t)), `rate lines: ${rates.join(' | ')}`);

  // (c) the notebook opens only with the PIN and lists exactly the wrong questions
  const notes = await kit.open('notes.html', { width: 1440, height: 900 });
  await kit.waitFor(notes, () => document.querySelectorAll('#notes-member option').length > 1);
  await notes.eval((who) => {
    document.getElementById('notes-member').value = who;
    document.getElementById('notes-open').requestSubmit();
    return true;
  }, who);
  await answerPin(kit, notes, '0000', { twice: false });
  await kit.waitFor(notes, () => (document.querySelector('.pin-error')?.textContent || '').includes('맞지 않아요'));
  await notes.eval((pin) => {
    document.getElementById('pin-1').value = pin;
    document.querySelector('dialog#pin form').requestSubmit();
    return true;
  }, PIN_A);
  await kit.waitFor(notes, () => document.querySelector('.note-week'));
  const book = await notes.eval(() => ({
    owner: document.querySelector('.note-owner').textContent,
    wrong: [...document.querySelectorAll('.note-week .note-again')].map((a) => a.getAttribute('href')),
    meta: document.querySelector('.note-week .note-meta')?.textContent || '',
    low: document.querySelector('#team-low').hidden === false,
  }));
  const graded = await page.eval(() => [...document.querySelectorAll('section.q-result')].map((s) => s.dataset.result));
  const expectWrong = set.questions.filter((q, i) => graded[i] === 'wrong').map((q) => q.id);
  assert.ok(book.owner.startsWith(who), `owner line: ${book.owner}`);
  assert.deepEqual(book.wrong.map((h) => h.split('#')[1]), expectWrong, 'the notebook lists the wrong questions in order');
  assert.ok(book.wrong.every((h) => h.startsWith(`quiz.html?set=${set.id}&practice=1#`)), 'each note re-solves in practice mode');
  assert.ok(book.meta.includes(data.index[0].title) && book.meta.includes('노션 기록'), `note meta: ${book.meta}`);
  assert.equal(book.low, true, 'the team list is shown once a week has three takers');
  const text = await notes.eval(() => document.body.textContent);
  for (const m of members.slice(1, 3)) assert.ok(!text.includes(m.name + '님'), `another member's notebook leaked: ${m.name}`);

  // (d) the home spines carry the team rate
  const home = await kit.open('index.html', { width: 1440, height: 900 });
  await kit.waitFor(home, () => document.querySelectorAll('#shelf .spine-rate').length === 10);
  await kit.shot(notes, 'team-notes-1440');
}
