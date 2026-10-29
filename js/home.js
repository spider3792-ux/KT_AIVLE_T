// Home controller: this week's title from the index, the member tabs on the folder stack, the name
// picker, 풀기 시작. The folder (fieldset, #start, #start-hint) is static markup in index.html;
// this script fills and wires it.
import { el, getJson, loadMembers, loadWeek, renderError, store } from './site.js';
import { sourceLabel } from './grade.js';
import { reveal, stagger } from './motion.js';
import { LOW_RATE, rateOf, teamStats } from './team.js';

const app = document.querySelector('#app');
const stack = document.querySelector('#stack');
const sub = document.querySelector('#hero-sub');
const grid = document.querySelector('#members');
const startButton = document.querySelector('#start');
const hint = document.querySelector('#start-hint');
const original = [...app.childNodes];
const preview = document.querySelector('#preview');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The back folders carry the member tabs: split the names evenly over the bands.
function buildTabs(members) {
  const bands = [...stack.querySelectorAll('.band')];
  for (const band of bands) band.replaceChildren();
  const perBand = Math.ceil(members.length / bands.length) || 1;
  members.forEach((m, i) => {
    const band = bands[Math.min(Math.floor(i / perBand), bands.length - 1)];
    band.append(
      el('button', {
        class: 'tab',
        text: m.name,
        attrs: { type: 'button', 'data-member': m.name, 'aria-controls': 'preview', 'aria-pressed': 'false', 'data-reveal': '' },
      }),
    );
  });
}

// "문제 2개 · 개념 1 · 코드 분석 1"
function countLine(questions) {
  if (!questions.length) return '이 기록에서 나온 문제는 아직 없어요';
  const concept = questions.filter((q) => q.kind === 'concept').length;
  const code = questions.filter((q) => q.kind === 'code').length;
  return ['문제 ' + questions.length + '개', concept ? '개념 ' + concept : '', code ? '코드 분석 ' + code : ''].filter(Boolean).join(' · ');
}

// Index with preview: one fixed frame (#preview) that shows the pointed-at member's entries this week,
// how many questions cite each. Pointer and keyboard focus show it; on touch
// a tap toggles it and Escape clears it. Everything reaches the DOM through el() / textContent.
function setupPreview(set, tabs) {
  const body = el('div', { class: 'preview-body' });
  preview.replaceChildren(body);
  const idleLine = () => el('p', { class: 'preview-idle', text: '폴더 탭을 가리키거나 눌러 보세요. 그 사람의 이번 주 기록과 문제 수가 나와요.' });
  let active = null;
  let lastPointer = '';


  function swap(nodes) {
    body.replaceChildren(...nodes);
    body.scrollTop = 0;
    if (!reduceMotion.matches && body.animate) body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }

  function clear() {
    if (active === null) return;
    active = null;
    for (const t of tabs) t.setAttribute('aria-pressed', 'false');
    preview.dataset.state = 'idle';
    swap([idleLine()]);
  }

  function show(name) {
    if (active === name) return;
    active = name;
    for (const t of tabs) t.setAttribute('aria-pressed', String(t.dataset.member === name));
    preview.dataset.state = 'member';

    const entries = set.sources.filter((s) => s.author === name);
    const cited = (id) => set.questions.filter((q) => Array.isArray(q.sourceIds) && q.sourceIds.includes(id));
    const nodes = [el('h3', { class: 'preview-name', text: name + '의 이번 주 기록' })];
    if (!entries.length) {
      nodes.push(el('p', { class: 'preview-total', text: '이번 주 기록이 없어요' }));
    } else {
      const unique = new Set(entries.flatMap((s) => cited(s.id).map((q) => q.id)));
      nodes.push(el('p', { class: 'preview-total', text: '기록 ' + entries.length + '개 · 문제 ' + unique.size + '개에 쓰였어요' }));
      nodes.push(
        el(
          'ul',
          { class: 'preview-list' },
          entries.map((s) => {
            const date = sourceLabel(s).replace(s.author + ' · ', '');
            return el(
              'li',
              { class: 'entry' },
              el('p', { class: 'entry-title', text: s.title }),
              el('p', { class: 'entry-meta nums', text: date + ' · ' + s.subject }),
              el('p', { class: 'entry-count', text: countLine(cited(s.id)) }),
            );
          }),
        ),
      );
    }
    swap(nodes);
  }

  body.append(idleLine());

  for (const tab of tabs) {
    const name = tab.dataset.member;
    tab.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') show(name);
    });
    tab.addEventListener('pointerdown', (e) => {
      lastPointer = e.pointerType;
    });
    // Keyboard focus previews; a pointer's own focus does not, or a tap would toggle itself off again.
    tab.addEventListener('focus', () => {
      if (tab.matches(':focus-visible')) show(name);
    });
    tab.addEventListener('click', () => {
      const touch = lastPointer === 'touch' || lastPointer === 'pen';
      lastPointer = '';
      if (touch && active === name) clear();
      else show(name);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clear();
  });
}

// ---------- sections below the folder stack: 출처 bars, the slip, the spine shelf, the card back ----------
// Everything is built from the week's set with el() / textContent.

const WEEK_ID = /^\d{4}-W\d{2}$/;
const QUESTION_ID = /^q([1-9]|10)$/;
const dateOf = (s) => sourceLabel(s).replace(s.author + ' · ', '');
const monthDay = (iso) => {
  const [, m, d] = String(iso).split('-').map(Number);
  return m + '/' + d;
};
const citing = (set, id) => set.questions.filter((q) => Array.isArray(q.sourceIds) && q.sourceIds.includes(id));

// One bar per member that opens in place to list their entries; the first bar is open.
function renderSources(set, members) {
  const names = members.map((m) => m.name);
  for (const s of set.sources) if (!names.includes(s.author)) names.push(s.author);
  const bars = names.map((name, i) => {
    const entries = set.sources.filter((s) => s.author === name);
    const list = entries.length
      ? el(
          'ul',
          { class: 'src-list' },
          entries.map((s) => {
            const n = citing(set, s.id).length;
            return el(
              'li',
              { class: 'src', attrs: { id: 'source-' + s.id } },
              el('p', { class: 'src-title', text: s.title }),
              el('p', { class: 'src-date nums', text: dateOf(s) }),
              el('p', { class: 'src-meta', text: s.subject + (n ? ' · 문제 ' + n + '개에 쓰였어요' : '') }),
            );
          }),
        )
      : el('p', { class: 'src-empty', text: '이번 주 기록이 없어요' });
    return el(
      'details',
      { class: 'bar', attrs: { open: i === 0, 'data-reveal': 'bar' } },
      el(
        'summary',
        {},
        el('span', { class: 'bar-name', text: name }),
        el('span', { class: 'bar-count nums', text: entries.length ? '기록 ' + entries.length + '개' : '기록 없음' }),
        el('span', { class: 'bar-mark', attrs: { 'aria-hidden': 'true' } }),
      ),
      el('div', { class: 'bar-panel' }, list),
    );
  });
  document.querySelector('#bars').replaceChildren(...bars);
}

// The itinerary slip: stages under time headings, dotted leaders, one inverted row at the end.
function renderSlip(set, entry) {
  const authors = new Set(set.sources.map((s) => s.author)).size;
  const concept = set.questions.filter((q) => q.kind === 'concept').length;
  const code = set.questions.filter((q) => q.kind === 'code').length;
  const minutes = '약 ' + set.estimatedMinutes + '분';
  const stages = [
    ['월~목', [['각자 노션에 복습 기록 남기기', '기록 ' + set.sources.length + '개'], ['기록을 남긴 스터디원', authors + '명']]],
    ['금요일', [['기록에서 문제 출제', set.questions.length + '문제'], ['개념', concept + '문제'], ['코드 분석', code + '문제']]],
    ['풀 때', [['이름 고르고 풀기 시작', minutes], ['제출하면 바로 채점 · 해설', '즉시']]],
  ];
  const range = set.range ? monthDay(set.range.from) + ' ~ ' + monthDay(set.range.to) : '';
  document.querySelector('#slip').replaceChildren(
    el('p', { class: 'slip-head', attrs: { 'data-reveal': 'row' } }, el('span', { text: entry.title }), el('span', { class: 'nums', text: range })),
    ...stages.map(([head, rows]) =>
      el(
        'section',
        { class: 'slip-stage' },
        el('h3', { text: head, attrs: { 'data-reveal': 'row' } }),
        el(
          'ul',
          { class: 'slip-rows' },
          rows.map(([what, value]) =>
            el(
              'li',
              { class: 'row', attrs: { 'data-reveal': 'row' } },
              el('span', { class: 'row-text', text: what }),
              el('span', { class: 'row-dots', attrs: { 'aria-hidden': 'true' } }),
              el('span', { class: 'row-value nums', text: value }),
            ),
          ),
        ),
      ),
    ),
    el('p', { class: 'slip-total', text: '손에 남는 것: 점수, 해설, 틀린 문제 · ' + minutes, attrs: { 'data-reveal': 'row' } }),
  );
}

// The shelf: one spine per question, linking to that question on the sheet.
function renderShelf(set, entry) {
  const shelf = document.querySelector('#shelf');
  if (!WEEK_ID.test(entry.id)) return;
  const tones = new Map();
  const toneOf = (subject) => {
    if (!tones.has(subject)) tones.set(subject, (tones.size % 4) + 1);
    return tones.get(subject);
  };
  const spines = [];
  set.questions.forEach((q, i) => {
    if (!QUESTION_ID.test(q.id)) return;
    const src = Array.isArray(q.sourceIds) && q.sourceIds.length ? set.sources.find((s) => s.id === q.sourceIds[0]) : null;
    const label = src ? sourceLabel(src) : '실습 파일' + (q.file ? ' · ' + q.file : '');
    const subject = src ? src.subject : (q.concept && q.concept.name) || '';
    const kind = q.kind === 'code' ? '코드 분석' : '개념';
    const band = (subject ? subject + ' · ' : '') + kind;
    spines.push(
      el(
        'li',
        { attrs: { 'data-reveal': 'spine' } },
        el(
          'a',
          {
            class: 'spine',
            dataset: { tone: toneOf(subject) },
            attrs: { href: 'quiz.html?set=' + encodeURIComponent(entry.id) + '#' + q.id, 'aria-label': i + 1 + '번 문제, ' + label + ', ' + band },
          },
          el('span', { class: 'spine-label', text: label }),
          el('span', { class: 'spine-band', text: band }),
        ),
      ),
    );
  });
  shelf.replaceChildren(...spines);
}

// Team accuracy on this week's spines; a question under LOW_RATE gets a dark mark.
// Nothing shows until three members have sent the week (the sheet holds the totals back before that).
async function markShelf(entry) {
  const stats = await teamStats();
  if (!stats[entry.id]) return;
  let low = 0;
  for (const a of document.querySelectorAll('#shelf a.spine')) {
    const qid = a.getAttribute('href').split('#')[1];
    const rate = rateOf(stats, entry.id, qid);
    if (!rate) continue;
    const isLow = rate.pct < LOW_RATE;
    a.append(el('span', { class: 'spine-rate', dataset: { low: isLow }, text: rate.pct + '%' }));
    a.setAttribute('aria-label', a.getAttribute('aria-label') + ', 팀 정답률 ' + rate.pct + '%');
    if (isLow) low += 1;
  }
  document.querySelector('.contents-note').textContent =
    '책등을 누르면 그 문제가 시험지에서 바로 열려요. 아래 숫자는 팀 정답률이고, 진한 칸 ' + low + '개는 50%보다 낮은 문제예요.';
}

// The bookshelf: every week in quizzes/index.json is one book lying flat, newest on top.
// A new week needs nothing here: publishing adds it to the index and it lands on the pile.
async function renderPile(weeks, current) {
  const pile = document.querySelector('#pile');
  const valid = weeks.filter((w) => w && WEEK_ID.test(w.id) && typeof w.file === 'string' && /^quizzes\/[A-Za-z0-9._-]+\.json$/.test(w.file));
  // Each set is read for its range and subjects; a week whose file fails still shows its title.
  const sets = await Promise.all(valid.map((w) => (w.id === current.entry.id ? current.set : getJson(w.file).catch(() => null))));
  const books = valid.map((w, i) => {
    const set = sets[i];
    const dated = set && set.range && set.range.from && set.range.to;
    const from = dated ? monthDay(set.range.from) : '';
    const to = dated ? monthDay(set.range.to) : '';
    const subjects = set && Array.isArray(set.sources) ? [...new Set(set.sources.map((s) => s.subject).filter(Boolean))] : [];
    const count = set && Array.isArray(set.questions) ? set.questions.length : 0;
    const attempt = store.get('attempt:' + w.id);
    const score = attempt && attempt.score && Number.isInteger(attempt.score.total) ? attempt.score.total : null;
    const mine = score == null ? '아직 안 풀었어요' : `내 점수 ${score} / ${count || '?'}`;
    const facts = [from && to ? `${from}–${to}` : '', count ? `${count}문제` : '', subjects.join(' · ')].filter(Boolean).join(' · ');
    return el(
      'li',
      { attrs: { 'data-reveal': 'book' } },
      el(
        'a',
        {
          class: 'book',
          dataset: { tone: i === 0 ? 'top' : (i % 3) + 1 },
          attrs: { href: 'quiz.html?set=' + encodeURIComponent(w.id), 'aria-label': [w.title, i === 0 ? '이번 주' : '', facts, mine].filter(Boolean).join(', ') },
        },
        el('span', { class: 'book-title', text: w.title || w.id }),
        el('span', { class: 'book-facts', text: (i === 0 ? '이번 주 · ' : '') + facts }),
        el('span', { class: 'book-mine', text: mine }),
      ),
    );
  });
  pile.replaceChildren(...books);
  stagger(pile, '[data-reveal]');
  reveal(pile);
}

// The card back: a message from the week's numbers and the sheet link.
function renderCard(set, entry) {
  const authors = new Set(set.sources.map((s) => s.author)).size;
  document.querySelector('#card-message').textContent =
    authors + '명이 남긴 기록 ' + set.sources.length + '개에서 ' + set.questions.length + '문제가 나왔어요. 풀고 나면 점수와 해설, 틀린 문제가 손에 남아요. 다음 시험지는 다음 주 금요일에 나와요.';
}

// Each section's parts arrive in reading order, numbered per section (the delay is capped in css/site.css).
function numberEntrances() {
  const within = (selector, scope, start = 0) => {
    const node = document.querySelector(selector);
    if (node) stagger(node, scope, start);
  };
  within('#sources .sources-col', '[data-reveal]');
  within('#how', '[data-reveal]');
  within('#contents', '[data-reveal]');
  within('#weeks .weeks-head', '[data-reveal]');
  within('#back', '[data-reveal]');
}

async function start() {
  let week;
  let members;
  try {
    week = await loadWeek('');
    members = await loadMembers();
  } catch {
    sub.replaceChildren();
    renderError(app, '이번 주 시험지를 불러오지 못했어요.', {
      retry: () => {
        app.replaceChildren(...original);
        start();
      },
    });
    return;
  }
  const { weeks, entry, set } = week;

  const authors = new Set(set.sources.map((s) => s.author));
  sub.replaceChildren(
    el('span', { text: entry.title, attrs: { id: 'week-title' } }),
    ` · ${set.questions.length}문제 · 약 ${set.estimatedMinutes}분 · 기록 ${set.sources.length}개 · ${authors.size}명`,
  );

  const saved = (store.get('member') || {}).name;
  grid.replaceChildren(
    ...members.map((m) =>
      el(
        'label',
        { class: 'member' },
        el('input', { attrs: { type: 'radio', name: 'member', value: m.name, checked: m.name === saved } }),
        el('span', { text: m.name }),
      ),
    ),
  );

  buildTabs(members);
  setupPreview(set, [...stack.querySelectorAll('.tab')]);

  renderSources(set, members);
  renderSlip(set, entry);
  renderShelf(set, entry);
  markShelf(entry);
  renderCard(set, entry);
  renderPile(weeks, week);
  numberEntrances();

  // The tabs arrive after their bands.
  stagger(stack, '.tab', 5);
  reveal();

  if (store.get('attempt:' + entry.id)) startButton.textContent = '결과 다시 보기';

  startButton.addEventListener('click', () => {
    const picked = document.querySelector('input[type="radio"][name="member"]:checked');
    if (!picked) {
      hint.textContent = '이름을 먼저 골라 주세요.';
      const firstRadio = document.querySelector('input[type="radio"][name="member"]');
      if (firstRadio) firstRadio.focus();
      return;
    }
    store.set('member', { name: picked.value });
    location.assign('quiz.html?set=' + encodeURIComponent(entry.id));
  });
}

// Entrances in reading order: top row, headline, sentence, back folders, front folder, picker, button.
// The static parts reveal even if the data never arrives.
stagger(document.body, '[data-reveal]');
reveal();
start();
