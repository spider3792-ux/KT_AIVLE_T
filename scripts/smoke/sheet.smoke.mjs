// Exam sheet scenario (taking state): structure, phone targets and overflow, entrances, tipped-in plates.
// Run with: node scripts/smoke.mjs sheet
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = 'sheet';

const credits = JSON.parse(readFileSync(fileURLToPath(new URL('../../assets/credits.json', import.meta.url)), 'utf8'));

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

  // ---------------------------------------------------------------- plates at 1440
  // Scroll to the bottom and back so lazily loaded pictures arrive.
  await page.eval(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return true;
  });
  await kit.sleep(900);
  await page.eval(() => {
    window.scrollTo(0, 0);
    return true;
  });
  await kit.sleep(600);
  const pics = await page.eval(() => {
    const rect = (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    };
    const avoid = [...document.querySelectorAll('#sheet-title, legend, label, pre.code, .q-prompt, #submit')].map(rect);
    const imgs = [...document.querySelectorAll('img')]
      .filter((i) => /\/assets\//.test(i.src))
      .map((i) => ({ src: i.getAttribute('src'), nat: i.naturalWidth, ...rect(i), alt: i.alt }));
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    return {
      imgs: imgs.map((i) => ({ ...i, overlaps: avoid.filter((b) => hit(i, b)).length })),
      credits: document.querySelector('p.credits')?.textContent ?? '',
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    };
  });
  const good = pics.imgs.filter((i) => i.nat > 0 && i.w >= 160 && i.h >= 120);
  assert.ok(good.length >= 4, `at least four plates at 160x120 or more, found ${good.length}: ${JSON.stringify(pics.imgs.map((i) => [i.src, i.nat, Math.round(i.w), Math.round(i.h)]))}`);
  for (const i of good) {
    assert.equal(i.overlaps, 0, `${i.src} overlaps the title, a prompt, a choice, code or the submit button`);
    assert.match(i.alt, /[가-힣]/, `${i.src}: alt is Korean`);
    const entry = credits.find((c) => i.src.endsWith(c.file));
    assert.ok(entry, `${i.src} is listed in assets/credits.json`);
    assert.ok(pics.credits.includes(entry.title), `p.credits names "${entry.title}"`);
  }
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
    plates: [...document.querySelectorAll('.sheet-plate')].filter((p) => p.getBoundingClientRect().width > 0 && p.closest('li')).length,
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
  assert.equal(small.plates, 0, 'ground plates are not rendered on a phone');
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
  const q1 = set.questions.find((q) => q.id === 'q1');
  const q3 = set.questions.find((q) => q.id === 'q3');
  assert.equal(q1.type, 'choice');
  assert.equal(q3.type, 'short');
  const who = members[1].name;
  const keep = await kit.open('quiz.html', { width: 1440, height: 900 });
  await kit.waitFor(keep, () => document.querySelectorAll('li.q').length > 0);
  await kit.chooseMember(keep, who);
  await keep.eval(
    ({ answer }) => {
      document.querySelector(`input[type="radio"][name="q1"][value="${answer}"]`).click();
      const input = document.getElementById('q3-a');
      input.value = 'isna().sum()';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    { answer: q1.answer },
  );
  await kit.sleep(600);
  const draft = await keep.eval((k) => JSON.parse(localStorage.getItem(k)), key);
  assert.ok(draft && draft.v === 1, 'draft stored with v: 1');
  assert.equal(draft.answers.q1, q1.answer);
  assert.equal(draft.answers.q3, 'isna().sum()');
  assert.equal(draft.member, who);
  assert.ok(!Number.isNaN(Date.parse(draft.updatedAt)), 'updatedAt is an ISO date');

  await kit.reload(keep);
  await kit.waitFor(keep, () => document.querySelectorAll('li.q').length > 0);
  const back = await keep.eval(
    ({ answer }) => ({
      checked: document.querySelector(`input[type="radio"][name="q1"][value="${answer}"]`).checked,
      count: document.querySelectorAll('input[type="radio"][name="q1"]:checked').length,
      typed: document.getElementById('q3-a').value,
      member: document.querySelector('select#sheet-member').value,
    }),
    { answer: q1.answer },
  );
  assert.equal(back.checked, true, 'q1 radio is checked again');
  assert.equal(back.count, 1);
  assert.equal(back.typed, 'isna().sum()');
  assert.equal(back.member, who);
  await keep.eval(() => {
    const input = document.getElementById('q6-a');
    input.value = '데이터 누수';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  await kit.waitFor(keep, () => /^자동 저장됨 · [0-9]{2}:[0-9]{2}$/.test(document.querySelector('#save-state').textContent));

  // A submitted sheet drops its draft and keeps only the frozen attempt.
  await kit.submitSheet(keep);
  await kit.waitFor(keep, () => document.querySelector('#score'));
  const afterSubmit = await keep.eval((k) => localStorage.getItem(k), key);
  assert.equal(afterSubmit, null, 'draft removed once the attempt is stored');

  // ---------------------------------------------------------------- (b) tampered draft
  const bad = await kit.open('quiz.html', { width: 1440, height: 900 });
  await bad.eval(
    (k) => {
      localStorage.setItem(k, JSON.stringify({ v: 1, member: 'not a member', answers: { q1: 9, q2: 'x', q99: 1, q3: 'a'.repeat(300) }, updatedAt: 'x' }));
      return true;
    },
    key,
  );
  await kit.reload(bad);
  await kit.waitFor(bad, () => document.querySelectorAll('li.q').length > 0);
  const tampered = await bad.eval(() => ({
    q1: document.querySelectorAll('input[type="radio"][name="q1"]:checked').length,
    q2: document.querySelectorAll('input[type="radio"][name="q2"]:checked').length,
    q3: document.getElementById('q3-a').value,
    member: document.querySelector('select#sheet-member').value,
    items: document.querySelectorAll('li.q').length,
  }));
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
  const still = await blocked.eval(() => ({
    items: document.querySelectorAll('li.q').length,
    checked: document.querySelectorAll('input[type="radio"]:checked').length,
    typed: document.getElementById('q3-a').value,
  }));
  assert.equal(still.items, 10);
  assert.ok(still.checked >= 5, 'answering still works with storage blocked');
  assert.ok(still.typed.length > 0);
  await kit.chooseMember(blocked, members[0].name);
  await kit.submitSheet(blocked);
  await kit.waitFor(blocked, () => document.querySelector('[data-score="total"]'));
  assert.equal(await blocked.eval(() => document.querySelector('[data-score="total"]').textContent), '10', 'grading works with storage blocked');
  assert.deepEqual(blocked.consoleErrors, [], 'no page exceptions with blocked storage');
}
