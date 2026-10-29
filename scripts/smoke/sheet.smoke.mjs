// Exam sheet scenario (taking state): structure, phone targets and overflow, entrances, no decorative photos.
// Run with: node scripts/smoke.mjs sheet
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = 'sheet';


export default async function sheet(kit) {
  const { assert, data } = kit;
  const { set, members } = data;

  // ---------------------------------------------------------------- desktop 1440x900
  const page = await kit.open('quiz.html', { width: 1440, height: 900 });
  await kit.waitFor(page, () => document.querySelectorAll('ol#sheet > li.q').length > 0);
  await kit.sleep(1400); // entrances (800ms + stagger) settle

  const shape = await page.eval(() => {
    const md = /^\d{1,2}\/\d{1,2}–\d{1,2}\/\d{1,2}$/;
    const fields = {};
    for (const f of document.querySelectorAll('.sheet-fields .field')) fields[f.querySelector('dt').textContent.trim()] = f.querySelector('dd').textContent.trim();
    return {
      lang: document.documentElement.lang,
      title: document.querySelector('#sheet-title')?.textContent,
      options: [...document.querySelectorAll('select#sheet-member option')].map((o) => o.textContent),
      lis: [...document.querySelectorAll('ol#sheet > li.q')].map((li) => getComputedStyle(li).display),
      pres: [...document.querySelectorAll('pre.code')].map((p) => ({ text: p.querySelector('code').textContent, ws: getComputedStyle(p).whiteSpace })),
      fields,
      rangeOk: md.test(fields['범위'] || ''),
      submitInside: !!document.querySelector('.paper #submit'),
      markers: getComputedStyle(document.querySelector('#sheet > li.q'), '::marker').fontSize,
      noteText: document.querySelector('.stub-note')?.textContent,
    };
  });
  assert.equal(shape.lang, 'ko');
  assert.equal(shape.title, set.title);
  assert.equal(shape.options.length, members.length + 1, 'select has the empty option plus every name');
  assert.equal(shape.lis.length, 10);
  assert.ok(shape.lis.every((d) => d === 'list-item'), `li display: ${shape.lis.join(',')}`);
  const codeQs = set.questions.filter((q) => q.code);
  assert.equal(shape.pres.length, 3);
  shape.pres.forEach((p, i) => {
    assert.equal(p.text, codeQs[i].code, `code block ${i + 1} is verbatim`);
    assert.equal(p.ws, 'pre');
  });
  assert.ok(shape.rangeOk, `범위 reads M/D–M/D: ${shape.fields['범위']}`);
  assert.ok((shape.fields['문항'] || '').includes('10문제'), `문항: ${shape.fields['문항']}`);
  assert.ok((shape.fields['예상 시간'] || '').includes(`${set.estimatedMinutes}분`), `예상 시간: ${shape.fields['예상 시간']}`);
  assert.ok(shape.submitInside, '#submit sits inside the paper');
  assert.equal(shape.noteText, '제출하면 첫 시도 답이 고정돼요.');
  await kit.shot(page, 'sheet-desktop');

  // ---------------------------------------------------------------- no photos at 1440
  const pics = await page.eval(() => ({ imgs: document.images.length, credits: !!document.querySelector('p.credits'), scrollWidth: document.documentElement.scrollWidth, innerWidth }));
  assert.equal(pics.imgs, 0, 'the sheet shows no pictures');
  assert.equal(pics.credits, false, 'no credits paragraph');
  assert.ok(pics.scrollWidth <= pics.innerWidth, `desktop overflow ${pics.scrollWidth} > ${pics.innerWidth}`);

  // ---------------------------------------------------------------- phone 390x844
  const phone = await kit.open('quiz.html', { width: 390, height: 844, mobile: true });
  await kit.waitFor(phone, () => document.querySelectorAll('li.q').length > 0);
  await kit.sleep(1200);
  const small = await phone.eval(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    shortLabels: [...document.querySelectorAll('label:has(input[type="radio"])')].filter((l) => l.getBoundingClientRect().height < 44).length,
    radios: document.querySelectorAll('input[type="radio"]').length,
    select: document.querySelector('#sheet-member').getBoundingClientRect().height,
    inputs: [...document.querySelectorAll('input[type="text"]')].map((i) => parseFloat(getComputedStyle(i).fontSize)),
    pres: [...document.querySelectorAll('pre.code')].map((p) => ({ sw: p.scrollWidth, cw: p.clientWidth, ox: getComputedStyle(p).overflowX })),
    titleLines: Math.round(document.querySelector('#sheet-title').getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector('#sheet-title')).lineHeight)),
  }));
  assert.ok(small.scrollWidth <= small.innerWidth, `phone overflow ${small.scrollWidth} > ${small.innerWidth}`);
  assert.equal(small.shortLabels, 0, 'every choice label is at least 44px tall');
  assert.ok(small.radios >= 28, 'radios present');
  assert.ok(small.select >= 44, `select is ${small.select}px tall`);
  assert.ok(small.inputs.every((px) => px >= 16), `short inputs are ${small.inputs.join(',')}px`);
  assert.equal(small.pres.length, 3);
  for (const p of small.pres) {
    assert.ok(p.sw >= p.cw, 'code block scrolls inside itself');
    assert.equal(p.ox, 'auto');
  }
  assert.ok(small.titleLines <= 2, `title runs ${small.titleLines} lines at 390`);

  await kit.chooseMember(phone, members[0].name);
  await kit.answerAll(phone, set, 'correct');
  await kit.submitSheet(phone);
  await kit.waitFor(phone, () => document.querySelector('[data-score="total"]'));
  const total = await phone.eval(() => document.querySelector('[data-score="total"]').textContent);
  assert.equal(total, '10');
  await kit.shot(phone, 'sheet-phone-graded');

  // ---------------------------------------------------------------- reduced motion: nothing stays hidden
  const calm = await kit.open('quiz.html', { width: 1440, height: 900, reducedMotion: true });
  await kit.waitFor(calm, () => document.querySelectorAll('li.q').length > 0);
  await kit.sleep(500);
  const hidden = await calm.eval(() => [...document.querySelectorAll('[data-reveal]')].filter((n) => getComputedStyle(n).opacity !== '1').length);
  assert.equal(hidden, 0, 'every [data-reveal] is at opacity 1 under reduced motion');

  // ---------------------------------------------------------------- (a) draft resume
  const key = `srq:draft:${set.id}`;
  // Any week works: take the first two choice questions and the first two short-answer questions.
  const choiceQs = set.questions.filter((q) => q.type === 'choice');
  const shortQs = set.questions.filter((q) => q.type === 'short');
  const q1 = choiceQs[0];
  const q2c = choiceQs[1];
  const q3 = shortQs[0];
  const q6s = shortQs[1] || shortQs[0];
  const ids = { c: q1.id, c2: q2c.id, s: q3.id, s2: q6s.id };
  const who = members[1].name;
  const keep = await kit.open('quiz.html', { width: 1440, height: 900 });
  await kit.waitFor(keep, () => document.querySelectorAll('li.q').length > 0);
  await kit.chooseMember(keep, who);
  await keep.eval(
    ({ answer, ids }) => {
      document.querySelector(`input[type="radio"][name="${ids.c}"][value="${answer}"]`).click();
      const input = document.getElementById(`${ids.s}-a`);
      input.value = 'isna().sum()';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    { answer: q1.answer, ids },
  );
  await kit.sleep(600);
  const draft = await keep.eval((k) => JSON.parse(localStorage.getItem(k)), key);
  assert.ok(draft && draft.v === 1, 'draft stored with v: 1');
  assert.equal(draft.answers[ids.c], q1.answer);
  assert.equal(draft.answers[ids.s], 'isna().sum()');
  assert.equal(draft.member, who);
  assert.ok(!Number.isNaN(Date.parse(draft.updatedAt)), 'updatedAt is an ISO date');

  await kit.reload(keep);
  await kit.waitFor(keep, () => document.querySelectorAll('li.q').length > 0);
  const back = await keep.eval(
    ({ answer, ids }) => ({
      checked: document.querySelector(`input[type="radio"][name="${ids.c}"][value="${answer}"]`).checked,
      count: document.querySelectorAll(`input[type="radio"][name="${ids.c}"]:checked`).length,
      typed: document.getElementById(`${ids.s}-a`).value,
      member: document.querySelector('select#sheet-member').value,
    }),
    { answer: q1.answer, ids },
  );
  assert.equal(back.checked, true, 'q1 radio is checked again');
  assert.equal(back.count, 1);
  assert.equal(back.typed, 'isna().sum()');
  assert.equal(back.member, who);
  await keep.eval((ids) => {
    const input = document.getElementById(`${ids.s2}-a`);
    input.value = '데이터 누수';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, ids);
  await kit.waitFor(keep, () => /^자동 저장됨 · [0-9]{2}:[0-9]{2}$/.test(document.querySelector('#save-state').textContent));

  // A submitted sheet drops its draft and keeps only the frozen attempt.
  await kit.submitSheet(keep);
  await kit.waitFor(keep, () => document.querySelector('#score'));
  const afterSubmit = await keep.eval((k) => localStorage.getItem(k), key);
  assert.equal(afterSubmit, null, 'draft removed once the attempt is stored');

  // ---------------------------------------------------------------- (b) tampered draft
  const bad = await kit.open('quiz.html', { width: 1440, height: 900 });
  await bad.eval(
    ({ k, ids }) => {
      localStorage.setItem(k, JSON.stringify({ v: 1, member: 'not a member', answers: { [ids.c]: 9, [ids.c2]: 'x', q99: 1, [ids.s]: 'a'.repeat(300) }, updatedAt: 'x' }));
      return true;
    },
    { k: key, ids },
  );
  await kit.reload(bad);
  await kit.waitFor(bad, () => document.querySelectorAll('li.q').length > 0);
  const tampered = await bad.eval((ids) => ({
    q1: document.querySelectorAll(`input[type="radio"][name="${ids.c}"]:checked`).length,
    q2: document.querySelectorAll(`input[type="radio"][name="${ids.c2}"]:checked`).length,
    q3: document.getElementById(`${ids.s}-a`).value,
    member: document.querySelector('select#sheet-member').value,
    items: document.querySelectorAll('li.q').length,
  }), ids);
  assert.equal(tampered.q1, 0, 'out-of-range q1 is dropped');
  assert.equal(tampered.q2, 0, 'a string for a choice question is dropped');
  assert.equal(tampered.q3, '', 'a 300-character answer is dropped');
  assert.equal(tampered.member, '', 'an unknown name is dropped');
  assert.equal(tampered.items, 10);

  // ---------------------------------------------------------------- (c) storage that throws
  const blocked = await kit.browser.newPage({ width: 1440, height: 900 });
  kit.opened.push(blocked);
  await blocked.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });`,
  });
  await blocked.goto(`${kit.BASE}/quiz.html`, { settleMs: 600 });
  await kit.waitFor(blocked, () => document.querySelectorAll('li.q').length > 0);
  const note = await blocked.eval(() => {
    const n = document.querySelector('#storage-notice');
    const r = n ? n.getBoundingClientRect() : null;
    return { text: n ? n.textContent : '', visible: !!r && r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden', cs: getComputedStyle(n).color };
  });
  assert.equal(note.text, '이 브라우저에서는 답이 저장되지 않아요. 창을 닫으면 사라져요.');
  assert.ok(note.visible, '#storage-notice is visible');
  await kit.answerAll(blocked, set, 'correct');
  await kit.sleep(500);
  const still = await blocked.eval((ids) => ({
    items: document.querySelectorAll('li.q').length,
    checked: document.querySelectorAll('input[type="radio"]:checked').length,
    typed: document.getElementById(`${ids.s}-a`).value,
  }), ids);
  assert.equal(still.items, 10);
  assert.ok(still.checked >= 5, 'answering still works with storage blocked');
  assert.ok(still.typed.length > 0);
  await kit.chooseMember(blocked, members[0].name);
  await kit.submitSheet(blocked);
  await kit.waitFor(blocked, () => document.querySelector('[data-score="total"]'));
  assert.equal(await blocked.eval(() => document.querySelector('[data-score="total"]').textContent), '10', 'grading works with storage blocked');
  assert.deepEqual(blocked.consoleErrors, [], 'no page exceptions with blocked storage');
}
