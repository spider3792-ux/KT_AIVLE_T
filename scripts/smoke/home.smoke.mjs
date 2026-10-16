// Home scenario: the folder stack's member tabs preview this week's entries, the name picker, the
// first-screen action and the phone layout. Run with: node scripts/smoke.mjs home
export const name = 'home';

const md = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
};

// Waits until the entrances (js/motion.js, 800ms) have finished so bounding boxes are final.
async function settled(kit, page) {
  await kit.waitFor(page, () => document.querySelectorAll('.tab').length > 0 && !!document.querySelector('#start').closest('[data-reveal].is-in'));
  await kit.sleep(1500);
}

async function center(page, selector) {
  return page.eval((sel) => {
    const e = document.querySelector(sel);
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
}

const tabSel = (member) => `.tab[data-member="${member}"]`;

export default async function home(kit) {
  const { assert, data } = kit;
  const { set, members } = data;
  const first = set.sources[0];

  // ---------------------------------------------------------------- desktop 1440x900
  const page = await kit.open('index.html', { width: 1440, height: 900 });
  await settled(kit, page);

  const base = await page.eval(() => ({
    lang: document.documentElement.lang,
    week: document.querySelector('#week-title')?.textContent,
    radios: document.querySelectorAll('input[name="member"]').length,
    tabs: [...document.querySelectorAll('.tab')].map((t) => t.dataset.member),
    startBottom: document.querySelector('#start').getBoundingClientRect().bottom,
    innerHeight,
    accentButtons: [...document.querySelectorAll('button, a')].filter((n) => getComputedStyle(n).backgroundColor === 'rgb(13, 116, 128)').map((n) => n.id || n.className),
  }));
  assert.equal(base.lang, 'ko');
  assert.equal(base.week, data.index[0].title);
  assert.equal(base.radios, 6, 'six name options');
  assert.deepEqual(base.tabs, members.map((m) => m.name), 'a tab per member, in order');
  assert.ok(base.startBottom <= base.innerHeight, `#start bottom ${base.startBottom} is below the first screen (${base.innerHeight})`);
  assert.deepEqual(base.accentButtons, ['start'], '풀기 시작 is the only teal control');
  const idle = await page.eval(() => ({ state: document.querySelector('#preview').dataset.state, text: document.querySelector('#preview').innerText }));
  assert.equal(idle.state, 'idle');
  assert.ok(idle.text.includes('폴더 탭을 가리키거나'), `idle frame is empty: "${idle.text}"`);
  await kit.shot(page, 'home-desktop-idle');

  // hovering the tab of the first source's author shows that entry and its question count
  const author = first.author;
  const at = await center(page, tabSel(author));
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await kit.waitFor(page, () => document.querySelector('#preview')?.dataset.state === 'member');
  const hovered = await page.eval(() => document.querySelector('#preview').innerText);
  assert.ok(hovered.includes(first.title), `preview lacks the title "${first.title}": ${hovered}`);
  assert.ok(hovered.includes(md(first.date)), `preview lacks the date ${md(first.date)}`);
  assert.ok(hovered.includes(first.subject), 'preview lacks the subject');
  const cited = set.questions.filter((q) => (q.sourceIds || []).includes(first.id)).length;
  assert.ok(hovered.includes(`문제 ${cited}개`), `preview lacks "문제 ${cited}개": ${hovered}`);
  const pressed = await page.eval((m) => document.querySelector(`.tab[data-member="${m}"]`).getAttribute('aria-pressed'), author);
  assert.equal(pressed, 'true', 'the pointed-at tab is aria-pressed');

  // the frame's plate: an assets/ picture with Korean alt text that really loads
  await kit.waitFor(page, () => {
    const img = document.querySelector('#preview img.is-on');
    return img && img.naturalWidth > 0;
  });
  const plate = await page.eval(() => {
    const img = document.querySelector('#preview img.is-on');
    return { src: img.getAttribute('src'), alt: img.alt, width: img.naturalWidth, opacity: getComputedStyle(img).opacity };
  });
  assert.match(plate.src, /^assets\//);
  assert.ok(plate.alt.trim().length > 0, 'plate alt is empty');
  assert.match(plate.alt, /[가-힣]/, 'plate alt is Korean');
  assert.ok(plate.width > 0);
  await kit.shot(page, 'home-desktop-preview');

  // keyboard focus shows another member's entries
  const other = set.sources.find((s) => s.author !== author);
  await page.eval((m) => {
    document.querySelector(`.tab[data-member="${m}"]`).focus();
    return true;
  }, other.author);
  await kit.sleep(400);
  const focused = await page.eval(() => document.querySelector('#preview').innerText);
  assert.ok(focused.includes(other.title), `focus did not preview "${other.title}": ${focused}`);
  assert.ok(focused.includes(md(other.date)));

  // a member with no entries this week (when the sample has one)
  const quiet = members.find((m) => !set.sources.some((s) => s.author === m.name));
  if (quiet) {
    await page.eval((m) => {
      document.querySelector(`.tab[data-member="${m}"]`).focus();
      return true;
    }, quiet.name);
    await kit.sleep(300);
    const none = await page.eval(() => document.querySelector('#preview').innerText);
    assert.ok(none.includes('이번 주 기록이 없어요'), `empty member shows: ${none}`);
  }

  // Escape clears it again
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await kit.waitFor(page, () => document.querySelector('#preview').dataset.state === 'idle', { timeout: 3000 });

  // every picture on the page has alt text
  const imgs = await page.eval(() => [...document.images].map((i) => ({ src: i.getAttribute('src'), alt: i.alt })));
  assert.ok(imgs.length > 0, 'no pictures after the preview ran');
  for (const i of imgs) assert.ok(i.alt.trim().length > 0, `img ${i.src} has no alt`);

  // the name picker still feeds 풀기 시작
  await kit.chooseMember(page, members[0].name);
  const checked = await page.eval(() => document.querySelector('input[name="member"]:checked')?.value);
  assert.equal(checked, members[0].name);


  // ---------------------------------------------------------------- the sections below the folders (01-04)
  // scroll to the bottom and back so lazy pictures load and the entrances fire
  for (const frac of [0.25, 0.5, 0.75, 1]) {
    await page.eval((f) => {
      window.scrollTo(0, document.documentElement.scrollHeight * f);
      return true;
    }, frac);
    await kit.sleep(350);
  }
  await page.eval(() => {
    window.scrollTo(0, 0);
    return true;
  });
  await kit.sleep(900);

  const below = await page.eval(() => ({
    bars: [...document.querySelectorAll('#bars details.bar')].map((d) => ({ name: d.querySelector('.bar-name').textContent, open: d.hasAttribute('open') })),
    entries: [...document.querySelectorAll('#bars .src')].map((li) => ({ id: li.id, text: li.textContent, tabular: getComputedStyle(li.querySelector('.src-date')).fontVariantNumeric })),
    total: document.querySelector('#how .slip-total')?.textContent || '',
    totalBg: document.querySelector('#how .slip-total') ? getComputedStyle(document.querySelector('#how .slip-total')).backgroundColor : '',
    spines: [...document.querySelectorAll('#contents #shelf a')].map((a) => ({ href: a.getAttribute('href'), label: a.getAttribute('aria-label') })),
    sections: ['sources', 'how', 'contents', 'back'].map((id) => !!document.getElementById(id)),
  }));
  assert.deepEqual(below.sections, [true, true, true, true], 'sections #sources #how #contents #back exist');
  assert.equal(below.bars.length, members.length, 'one details bar per member');
  assert.deepEqual(below.bars.map((b) => b.name), members.map((m) => m.name), 'bars follow members.json order');
  assert.deepEqual(below.bars.map((b) => b.open), below.bars.map((_, i) => i === 0), 'only the first bar is open');
  for (const s of set.sources) {
    const row = below.entries.find((e) => e.id === `source-${s.id}`);
    assert.ok(row, `entry row #source-${s.id} is missing`);
    assert.ok(row.text.includes(s.title), `row ${s.id} lacks its title`);
    assert.ok(row.text.includes(md(s.date)), `row ${s.id} lacks its date ${md(s.date)}`);
    assert.match(row.tabular, /tabular-nums/, 'dates use tabular figures');
  }
  for (const word of ['점수', '해설', '틀린 문제']) assert.ok(below.total.includes(word), `inverted last row lacks "${word}": ${below.total}`);
  assert.equal(below.totalBg, 'rgb(31, 48, 56)', 'the last slip row is inverted onto --ink');
  assert.equal(below.spines.length, set.questions.length, 'one spine per question');
  below.spines.forEach((s, i) => {
    assert.ok(s.href.endsWith(`?set=${data.index[0].id}#q${i + 1}`), `spine ${i + 1} href: ${s.href}`);
    assert.ok(s.label.startsWith(`${i + 1}번 문제`), `spine ${i + 1} aria-label: ${s.label}`);
  });

  // at least four different real pictures are really visible (loaded, opaque, 160x120 or larger) at 1440
  const pictures = await page.eval(() =>
    [...document.images]
      .filter((i) => i.naturalWidth > 0 && i.offsetWidth >= 160 && i.offsetHeight >= 120 && getComputedStyle(i).opacity !== '0' && getComputedStyle(i).visibility !== 'hidden')
      .map((i) => i.getAttribute('src')),
  );
  assert.ok(new Set(pictures).size >= 4, `only ${new Set(pictures).size} real pictures visible at 1440: ${pictures}`);
  await kit.shot(page, 'home-desktop-full');


  // ---------------------------------------------------------------- the back of the card, credits, reduced motion (01-04)
  // every picture under assets/ that the page shows is named in the credits paragraph
  const credits = await (await fetch(`${kit.BASE}/assets/credits.json`)).json();
  const shown = await page.eval(() => [...document.images].map((i) => i.getAttribute('src')).filter((s) => s && s.startsWith('assets/')));
  const creditText = await page.eval(() => document.querySelector('footer .credits')?.textContent || '');
  assert.ok(creditText.length > 0, 'no credits paragraph in the footer');
  assert.ok(shown.length >= 4, `only ${shown.length} assets/ pictures on the page`);
  for (const src of new Set(shown)) {
    const c = credits.find((x) => x.file === src);
    assert.ok(c, `${src} has no entry in assets/credits.json`);
    assert.ok(creditText.includes(c.title.slice(0, 60)), `the credits paragraph does not name "${c.title.slice(0, 60)}" (${src})`);
  }
  // every credit link is same-tab, or opens with rel="noopener noreferrer"
  const blank = await page.eval(() => [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).map((a) => a.href));
  assert.deepEqual(blank, [], 'target=_blank links without rel="noopener noreferrer"');

  const links = await page.eval(() => ({
    quiz: document.querySelector('#card-quiz')?.getAttribute('href'),
    targets: ['#sources', '#how', '#contents'].map((h) => [h, !!document.querySelector(`#back a[href="${h}"]`) && !!document.querySelector(h)]),
    imprint: document.querySelector('#back .imprint')?.textContent || '',
    imprintSize: parseFloat(getComputedStyle(document.querySelector('#back .imprint')).fontSize),
  }));
  assert.match(links.quiz, new RegExp(`quiz\\.html\\?set=${data.index[0].id}$`), 'the footer sheet link carries ?set=');
  for (const [h, ok] of links.targets) assert.ok(ok, `footer link ${h} does not resolve to a section`);
  assert.ok(links.imprint.includes('샘플 데이터로 만든 화면'), 'the imprint names the sample data');
  assert.ok(links.imprintSize >= 13, `imprint is ${links.imprintSize}px`);

  // a spine answers the pointer: it turns to full ink
  await page.eval(() => {
    document.querySelector('#shelf a').scrollIntoView({ block: 'center' });
    return true;
  });
  await kit.sleep(1200);
  const spineAt = await center(page, '#shelf li:nth-child(2) a');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: spineAt.x, y: spineAt.y });
  await kit.sleep(400);
  const spineBg = await page.eval(() => getComputedStyle(document.querySelector('#shelf li:nth-child(2) a')).backgroundColor);
  assert.equal(spineBg, 'rgb(31, 48, 56)', 'a hovered spine turns to --ink');

  // reduced motion: every [data-reveal] part is fully visible within 500ms of load
  const calm = await kit.open('index.html', { width: 1440, height: 900, reducedMotion: true });
  await kit.waitFor(calm, () => document.querySelectorAll('#bars details.bar').length > 0);
  await kit.sleep(500);
  assert.ok(await calm.eval(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page was not opened with reduced motion');
  const hidden = await calm.eval(() =>
    [...document.querySelectorAll('[data-reveal]')].filter((n) => getComputedStyle(n).opacity !== '1').map((n) => n.className || n.tagName),
  );
  assert.deepEqual(hidden, [], 'under reduced motion every [data-reveal] element is visible');
  const still = await calm.eval(() => [...document.querySelectorAll('[data-reveal]')].filter((n) => getComputedStyle(n).translate !== 'none').length);
  assert.equal(still, 0, 'under reduced motion nothing is held off-position');
  await kit.shot(calm, 'home-desktop-reduced');

  // ---------------------------------------------------------------- phone 390x844
  const phone = await kit.open('index.html', { width: 390, height: 844, mobile: true });
  await settled(kit, phone);
  const small = await phone.eval(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
    innerHeight,
    startBottom: document.querySelector('#start').getBoundingClientRect().bottom,
    labels: [...document.querySelectorAll('label')]
      .filter((l) => l.querySelector('input[name="member"]'))
      .map((l) => Math.round(l.getBoundingClientRect().height)),
    tabsRight: Math.max(...[...document.querySelectorAll('.tab')].map((t) => t.getBoundingClientRect().right)),
  }));
  assert.ok(small.scrollWidth <= small.innerWidth, `phone overflow (whole page, sections included) ${small.scrollWidth} > ${small.innerWidth}`);
  assert.ok(small.tabsRight <= small.innerWidth, `a tab runs off the right edge (${small.tabsRight})`);
  assert.equal(small.labels.length, 6);
  assert.ok(small.labels.every((h) => h >= 44), `a name option is under 44px tall: ${small.labels}`);
  assert.ok(small.startBottom <= small.innerHeight, `#start bottom ${small.startBottom} is below the first screen (${small.innerHeight})`);
  await kit.shot(phone, 'home-phone-idle');

  // a tap on a tab opens the same preview text; a second tap closes it
  const tap = async (sel) => {
    const p = await center(phone, sel);
    await phone.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await phone.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await kit.sleep(450);
  };
  await tap(tabSel(author));
  const tapped = await phone.eval(() => ({ state: document.querySelector('#preview').dataset.state, text: document.querySelector('#preview').innerText }));
  assert.equal(tapped.state, 'member', 'tap did not open the preview');
  assert.ok(tapped.text.includes(first.title), `tap preview lacks the title: ${tapped.text}`);
  assert.ok(tapped.text.includes(md(first.date)));
  const visible = await phone.eval(() => {
    const r = document.querySelector('#preview').getBoundingClientRect();
    return r.height > 0 && r.top < innerHeight;
  });
  assert.ok(visible, 'the opened preview is not on screen');
  assert.ok((await phone.eval(() => document.documentElement.scrollWidth <= innerWidth)), 'overflow after the preview opened');
  await kit.shot(phone, 'home-phone-preview');
  await tap(tabSel(author));
  const closed = await phone.eval(() => document.querySelector('#preview').dataset.state);
  assert.equal(closed, 'idle', 'second tap did not close the preview');
}
