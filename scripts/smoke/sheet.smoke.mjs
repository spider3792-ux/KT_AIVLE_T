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
}
