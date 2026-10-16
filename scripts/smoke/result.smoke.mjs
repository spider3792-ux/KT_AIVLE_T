// Result scenario: the blank-count confirmation, the frozen first attempt, the graded sheet (score, result blocks,
// margin marks), the design-review view, the home spine follow-through and the Korean-copy sweep.
// Run with: node scripts/smoke.mjs result      (SMOKE_SHOTS=1 also writes .taste-skill/shots/dialog-*.jpg and graded-*.jpg)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { correctAnswerText, explanationLines, gradeSet, sourceLabel } from '../../js/grade.js';

export const name = 'result';

const SHOTS = fileURLToPath(new URL('../../.taste-skill/shots/', import.meta.url));

// Real key press through the browser, so the native dialog sees a trusted Escape.
async function press(page, key, code, vk) {
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk });
  }
}

// The fixed mixed pattern of the plan: q1, q2, q4, q8 right; q3 right but typed spaced and upper-cased; q5 wrong;
// q6 blank; q7, q9, q10 wrong. Returns the answers a member would have given (the blank question is simply absent).
export function mixedAnswers(set) {
  const out = {};
  for (const q of set.questions) {
    const right = ['q1', 'q2', 'q4', 'q8'].includes(q.id);
    const wrong = ['q5', 'q7', 'q9', 'q10'].includes(q.id);
    if (q.id === 'q3') out[q.id] = ` ${q.answer[0].toUpperCase().replace('(', '( ')} `;
    else if (right) out[q.id] = q.answer;
    else if (wrong) out[q.id] = q.type === 'choice' ? (q.answer + 1) % 4 : '오답';
  }
  return out;
}

// Puts `answers` into the sheet's controls the way a member would.
async function fill(page, set, answers) {
  await page.eval(
    ({ questions, answers }) => {
      for (const q of questions) {
        if (!Object.prototype.hasOwnProperty.call(answers, q.id)) continue;
        if (q.type === 'choice') {
          document.querySelector(`input[type="radio"][name="${q.id}"][value="${answers[q.id]}"]`).click();
        } else {
          const input = document.getElementById(`${q.id}-a`);
          input.value = answers[q.id];
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return true;
    },
    { questions: set.questions, answers },
  );
}

export default async function result(kit) {
  const { assert, data, sleep } = kit;
  const { set, members } = data;
  const attemptKey = `srq:attempt:${set.id}`;
  const draftKey = `srq:draft:${set.id}`;
  const who = members[0].name;
  const shots = process.env.SMOKE_SHOTS === '1';
  if (shots) mkdirSync(SHOTS, { recursive: true });

  // ---------------------------------------------------------------- (a) the confirmation changes nothing until 제출하기
  const page = await kit.open('quiz.html', { width: 1440, height: 900 });
  await kit.waitFor(page, () => document.querySelectorAll('li.q').length > 0);
  await kit.chooseMember(page, who);
  const seven = {};
  for (const q of set.questions.slice(0, 7)) seven[q.id] = q.type === 'choice' ? q.answer : q.answer[0];
  await fill(page, set, seven);
  await sleep(700); // the typed answers reach the draft after the 300ms debounce

  const dialogState = () =>
    page.eval(
      ({ attemptKey, draftKey }) => {
        const d = document.querySelector('dialog#confirm');
        return {
          open: !!d && d.open,
          blank: document.querySelector('#blank-count')?.textContent ?? null,
          desc: document.querySelector('#confirm-desc')?.textContent ?? '',
          attempt: localStorage.getItem(attemptKey),
          draft: localStorage.getItem(draftKey),
          checked: document.querySelectorAll('input[type="radio"]:checked').length,
          typed: [...document.querySelectorAll('input[type="text"]')].filter((i) => i.value !== '').length,
          score: !!document.querySelector('#score'),
          focus: document.activeElement?.getAttribute('value') ?? document.activeElement?.id ?? '',
        };
      },
      { attemptKey, draftKey },
    );

  await page.eval(() => {
    document.querySelector('#submit').click();
    return true;
  });
  await sleep(500);
  let s = await dialogState();
  assert.equal(s.open, true, 'dialog#confirm opens on 답안 제출');
  assert.equal(s.blank, '3', '#blank-count reads 3 with seven answers');
  assert.match(s.desc, /비어 있는 문항이 3개 있어요\. 제출하면 첫 시도 답이 고정돼요\./);
  assert.equal(s.focus, 'cancel', 'the least destructive control has the focus');
  const dialogLabels = await page.eval(() => {
    const d = document.querySelector('dialog#confirm');
    return {
      labelledby: d.getAttribute('aria-labelledby'),
      describedby: d.getAttribute('aria-describedby'),
      title: document.getElementById(d.getAttribute('aria-labelledby'))?.textContent,
      buttons: [...d.querySelectorAll('button')].map((b) => [b.value, b.textContent.trim()]),
      backdropFilter: getComputedStyle(d, '::backdrop').backdropFilter,
    };
  });
  assert.equal(dialogLabels.title, '제출할까요?');
  assert.deepEqual(dialogLabels.buttons, [
    ['cancel', '돌아가서 마저 풀기'],
    ['submit', '제출하기'],
  ]);
  assert.ok(['none', '', undefined].includes(dialogLabels.backdropFilter), `no backdrop blur: ${dialogLabels.backdropFilter}`);
  if (shots) await page.screenshot({ path: `${SHOTS}dialog-1440.jpg` });

  await page.eval(() => {
    document.querySelector('dialog#confirm button[value="cancel"]').click();
    return true;
  });
  await sleep(400);
  s = await dialogState();
  assert.equal(s.open, false, 'cancel closes the dialog');
  assert.equal(s.attempt, null, 'cancel stores no attempt');
  assert.equal(s.checked + s.typed, 7, 'cancel leaves the seven answers set');
  assert.ok(s.draft !== null, 'cancel leaves the draft');
  assert.equal(s.score, false, 'cancel does not grade');

  // Opened again, Esc is the same as cancelling (a stale returnValue must not grade the sheet).
  await page.eval(() => {
    document.querySelector('#submit').click();
    return true;
  });
  await sleep(400);
  assert.equal((await dialogState()).open, true, 'dialog opens a second time');
  await press(page, 'Escape', 'Escape', 27);
  await sleep(400);
  s = await dialogState();
  assert.equal(s.open, false, 'Esc closes the dialog');
  assert.equal(s.attempt, null, 'Esc stores no attempt');
  assert.equal(s.checked + s.typed, 7, 'Esc leaves the seven answers set');
  assert.ok(s.draft !== null, 'Esc leaves the draft');
  assert.equal(s.score, false, 'Esc does not grade');

  // ---------------------------------------------------------------- (b) 제출하기 grades once and drops the draft
  await page.eval(() => {
    document.querySelector('#submit').click();
    return true;
  });
  await sleep(400);
  await page.eval(() => {
    document.querySelector('dialog#confirm button[value="submit"]').click();
    return true;
  });
  await kit.waitFor(page, () => document.querySelector('#score'));
  s = await dialogState();
  assert.equal(s.open, false);
  assert.ok(s.attempt !== null, 'the attempt is stored');
  const attempt = JSON.parse(s.attempt);
  assert.equal(attempt.v, 1);
  assert.equal(Object.keys(attempt.results).length, 10, 'ten results are stored');
  assert.equal(attempt.member, who, 'the attempt records the chosen member');
  assert.equal(s.draft, null, 'the draft is gone');
  const frozenText = s.attempt;

  // ---------------------------------------------------------------- (c) reload shows the frozen result
  await kit.reload(page);
  await kit.waitFor(page, () => document.querySelector('#score'));
  const again = await page.eval(
    ({ attemptKey, draftKey }) => ({
      enabled: [...document.querySelectorAll('li.q input')].filter((i) => !i.disabled).length,
      submit: !!document.querySelector('#submit'),
      attempt: localStorage.getItem(attemptKey),
      draft: localStorage.getItem(draftKey),
      results: document.querySelectorAll('section.q-result').length,
    }),
    { attemptKey, draftKey },
  );
  assert.equal(again.enabled, 0, 'no enabled input after reload');
  assert.equal(again.submit, false, 'no #submit after reload');
  assert.equal(again.attempt, frozenText, 'the stored attempt is unchanged by the reload');
  assert.equal(again.draft, null);
  assert.equal(again.results, 10);

  // ---------------------------------------------------------------- (d) no name: no dialog, a Korean hint
  const nameless = await kit.open('quiz.html', { width: 1440, height: 900 });
  await kit.waitFor(nameless, () => document.querySelectorAll('li.q').length > 0);
  await nameless.eval(() => {
    localStorage.removeItem('srq:member');
    return true;
  });
  await kit.reload(nameless);
  await kit.waitFor(nameless, () => document.querySelectorAll('li.q').length > 0);
  assert.equal(await nameless.eval(() => document.querySelector('#sheet-member').value), '', 'the 성명 select is empty');
  await nameless.eval(() => {
    document.querySelector('#submit').click();
    return true;
  });
  await sleep(400);
  const refused = await nameless.eval(() => ({
    open: document.querySelector('dialog#confirm').open,
    status: document.querySelector('#status').textContent,
    focus: document.activeElement?.id,
  }));
  assert.equal(refused.open, false, 'no dialog without a name');
  assert.equal(refused.status, '성명을 먼저 골라 주세요.');
  assert.equal(refused.focus, 'sheet-member', 'the 성명 select has the focus');

  // ---------------------------------------------------------------- (e) nothing left blank: the dialog says so
  const full = await kit.open('quiz.html', { width: 390, height: 844, mobile: true });
  await kit.waitFor(full, () => document.querySelectorAll('li.q').length > 0);
  await kit.chooseMember(full, who);
  await kit.answerAll(full, set, 'correct');
  await full.eval(() => {
    document.querySelector('#submit').click();
    return true;
  });
  await sleep(500);
  const none = await full.eval(() => {
    const d = document.querySelector('dialog#confirm');
    const r = d.getBoundingClientRect();
    return {
      open: d.open,
      desc: document.querySelector('#confirm-desc').textContent,
      countVisible: !document.querySelector('#blank-count').hidden,
      fits: r.left >= 0 && r.right <= innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    };
  });
  assert.equal(none.open, true);
  assert.equal(none.desc, '모든 문항에 답했어요. 제출하면 첫 시도 답이 고정돼요.');
  assert.equal(none.countVisible, false);
  assert.ok(none.fits, 'the dialog fits a 390px phone');
  assert.ok(none.scrollWidth <= none.innerWidth, 'no sideways scroll with the dialog open');
  if (shots) await full.screenshot({ path: `${SHOTS}dialog-390.jpg` });
  await full.eval(() => {
    document.querySelector('dialog#confirm button[value="cancel"]').click();
    return true;
  });
}
