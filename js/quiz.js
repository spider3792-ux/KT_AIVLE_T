// Exam sheet controller: render the set, grade on 답안 제출, freeze the first attempt, show it again on reload.
import { el, loadMembers, loadWeek, renderError, ROOT, store } from './site.js';
import { correctAnswerText, gradeSet, sanitizeAnswers } from './grade.js';
import { reveal, stagger } from './motion.js';

const app = document.querySelector('#app');
const requestedId = new URLSearchParams(location.search).get('set') || '';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Archival plates tipped onto the sheet. Titles, licences and pages come from assets/credits.json (assets.mjs --credits);
// the credit paragraph at the foot of the paper names exactly the pictures this page renders.
const PLATES = {
  card: {
    file: 'assets/hollerith-punched-card.jpg',
    width: 1200,
    height: 538,
    alt: '1895년 무렵의 홀러리스 천공 카드. 숫자와 기호가 인쇄된 표 위에 둥근 구멍이 뚫려 있다.',
    title: 'Hollerith Punched Card',
    creator: null,
    page: 'https://commons.wikimedia.org/wiki/File:Hollerith_Punched_Card.jpg',
    license: 'public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  machines: {
    file: 'assets/tabulating-machines-census.jpg',
    width: 1280,
    height: 1651,
    alt: '인구조사국 사무실에서 두 남자가 집계 기계에 천공 카드 묶음을 올려 두고 일하는 흑백 사진.',
    title: 'Tabulating machines, Census LCCN2016823353',
    creator: 'National Photo Company Collection',
    page: 'https://commons.wikimedia.org/wiki/File:Tabulating_machines,_Census_LCCN2016823353.jpg',
    license: 'public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  nightingale: {
    file: 'assets/nightingale-mortality.jpg',
    width: 1280,
    height: 700,
    alt: '나이팅게일이 그린 동부 전선 군대의 사망 원인 도표. 달마다 부채꼴 면적으로 사망자 수를 나타낸다.',
    title: 'Nightingale-mortality',
    creator: 'Florence Nightingale',
    page: 'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg',
    license: 'public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  playfair: {
    file: 'assets/playfair-piecharts.jpg',
    width: 1280,
    height: 702,
    alt: '플레이페어가 1801년에 그린 통계 지도. 유럽 여러 나라의 면적과 인구를 원과 막대로 견준다.',
    title: 'Playfair piecharts',
    creator: 'William Playfair',
    page: 'https://commons.wikimedia.org/wiki/File:Playfair_piecharts.jpg',
    license: 'public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  'census-machine': {
    file: 'assets/hollerith-census-machine.jpg',
    width: 1280,
    height: 1155,
    alt: '컴퓨터 역사 박물관에 전시된 홀러리스 인구조사 집계 기계. 카드를 읽어 숫자를 세는 금속 장치다.',
    title: 'Hollerith census machine at CHM by Tomwsulcer',
    creator: 'Tomwsulcer',
    page: 'https://commons.wikimedia.org/w/index.php?curid=46063689',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en/',
  },
  drawers: {
    file: 'assets/card-catalog-drawers.jpg',
    width: 1280,
    height: 960,
    alt: '작은 서랍이 줄지어 달린 나무 도서 카드 목록함. 서랍마다 색인 카드가 들어 있다.',
    title: 'Wooden Card Catalog Furniture',
    creator: 'MarkBuckawicki',
    page: 'https://commons.wikimedia.org/w/index.php?curid=68147692',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en/',
  },
  census: {
    file: 'assets/census-form-1890.jpg',
    width: 1280,
    height: 1857,
    alt: '1890년 미국 인구조사의 가족 조사표. 칸마다 질문이 인쇄돼 있고 왼쪽 가장자리에 구멍이 뚫려 있다.',
    title: '1890 U.S. Census form',
    creator: null,
    page: 'https://commons.wikimedia.org/wiki/File:1890_U.S._Census_form.jpg',
    license: 'public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
};

// Which question each ground plate sits beside (index into set.questions) and on which side of the paper.
const GROUND_PLATES = [
  { key: 'machines', at: 'head', side: 'left', tall: true },
  { key: 'census-machine', at: 1, side: 'right' },
  { key: 'drawers', at: 3, side: 'left' },
  { key: 'nightingale', at: 6, side: 'left', drift: true },
  { key: 'playfair', at: 8, side: 'right' },
];

function plate(key, extra = '') {
  const p = PLATES[key];
  return el(
    'figure',
    { class: `plate sheet-plate ${extra}`.trim(), dataset: { pic: key }, attrs: { 'data-reveal': extra.includes('head') ? 'load' : 'plate' } },
    el('img', { attrs: { src: new URL(p.file, ROOT).href, alt: p.alt, width: p.width, height: p.height, loading: 'lazy', decoding: 'async' } }),
  );
}

// Builds <p class="credits"> for the foot of the paper.
function creditsFor(keys) {
  const p = el('p', { class: 'credits' }, '사진: ');
  keys.forEach((key, i) => {
    const c = PLATES[key];
    if (i > 0) p.append('; ');
    p.append(
      el('a', { text: `“${c.title}”`, attrs: { href: c.page } }),
      c.creator ? ` by ${c.creator}` : '',
      ', ',
      el('a', { text: c.license, attrs: { href: c.licenseUrl } }),
      ', via Wikimedia Commons',
    );
  });
  p.append('.');
  return p;
}

// 2026-10-09 -> "10/9"
function monthDay(iso) {
  const m = /^[0-9]{4}-([0-9]{2})-([0-9]{2})/.exec(String(iso || ''));
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

// Four short choices sit two by two on a wide sheet; anything longer keeps one column.
const SHORT_CHOICE = 14;

async function start() {
  app.replaceChildren(el('p', { class: 'loading', text: '시험지를 불러오는 중이에요.', attrs: { role: 'status' } }));
  let data;
  try {
    data = await loadWeek(requestedId);
  } catch (err) {
    if (err && err.name === 'NotFound') {
      renderError(app, '이 주차를 찾을 수 없어요.', { link: { href: 'quiz.html', text: '이번 주 시험지로' } });
    } else {
      renderError(app, '시험지를 불러오지 못했어요.', { retry: start });
    }
    return;
  }
  // A members.json failure must not block the sheet: without names the 성명 field is simply not required.
  let members = [];
  try {
    members = await loadMembers();
  } catch {
    members = [];
  }
  render(data.set, members);
}

function buildQuestion(q, index, all) {
  const body = el('div', { class: 'q-body' });
  const codeId = `${q.id}-code`;
  const hasCode = q.kind === 'code' && typeof q.code === 'string' && q.code.length > 0;

  if (hasCode) {
    const code = el('code');
    code.textContent = q.code; // verbatim: indentation and line breaks stay as in the JSON
    body.append(el('pre', { class: 'code', attrs: { id: codeId, tabindex: '0', 'aria-label': '코드' } }, code));
  }

  if (q.type === 'choice') {
    const fieldset = el('fieldset', { attrs: { 'aria-describedby': hasCode ? codeId : null } }, el('legend', { text: q.prompt }));
    const short = q.choices.every((choice) => String(choice).length <= SHORT_CHOICE);
    const opts = el('div', { class: short ? 'opts opts--grid' : 'opts' });
    q.choices.forEach((choice, index) => {
      opts.append(
        el(
          'label',
          { class: 'opt' },
          el('input', { attrs: { type: 'radio', name: q.id, value: index } }),
          el('span', { text: choice }),
        ),
      );
    });
    fieldset.append(opts);
    body.append(fieldset);
  } else {
    const input = el('input', {
      attrs: {
        id: `${q.id}-a`,
        type: 'text',
        name: q.id,
        maxlength: 100,
        autocomplete: 'off',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: 'next',
        placeholder: '답을 입력하세요',
      },
      on: {
        // Hangul IME commit plus implicit submission: Enter never submits the sheet.
        keydown: (e) => {
          if (e.key === 'Enter') e.preventDefault();
        },
      },
    });
    body.append(el('label', { class: 'q-prompt', text: q.prompt, attrs: { for: `${q.id}-a` } }), input);
  }

  // An exam prints where each part starts: a strip above the first question of the 개념 part and of the 코드 분석 part.
  const startsPart = index === 0 || all[index - 1].kind !== q.kind;
  let part = null;
  if (startsPart) {
    const first = index + 1;
    let last = first;
    while (last < all.length && all[last].kind === q.kind) last += 1; // last is now the 1-based number of the final question
    part = el('p', { class: 'part', text: `${q.kind === 'code' ? '코드 분석' : '개념'} · ${first === last ? `${first}번` : `${first}–${last}번`}` });
  }
  return el('li', { class: startsPart ? 'q part-start' : 'q', attrs: { id: q.id, 'data-reveal': 'q' }, dataset: { qid: q.id, kind: q.kind } }, part, body);
}

function readAnswers(set) {
  const answers = {};
  for (const q of set.questions) {
    if (q.type === 'choice') {
      const picked = document.querySelector(`input[type="radio"][name="${q.id}"]:checked`);
      if (picked) answers[q.id] = Number(picked.value);
    } else {
      const input = document.getElementById(`${q.id}-a`);
      if (input && input.value.trim() !== '') answers[q.id] = input.value.slice(0, 200);
    }
  }
  return answers;
}

// #q9 in the address scrolls that question into view and focuses its first control (01-04's spine links use this).
function focusFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!/^q[0-9]{1,2}$/.test(id)) return;
  const li = document.getElementById(id);
  if (!li || !li.matches('#sheet > li.q')) return;
  let target = li.querySelector('pre.code, input:not(:disabled)');
  if (!target) {
    li.setAttribute('tabindex', '-1');
    target = li;
  }
  target.focus({ preventScroll: true });
  li.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// Draft autosave and restore (QUIZ-03). Only runs while the set has no frozen attempt.
function setupDraft(set, paper, select, sheet, { saveState, showStorageNotice }) {
  const key = 'draft:' + set.id;
  let timer = null;
  let dirty = false;
  let active = true;

  // Restore: stored data is untrusted, so only what sanitizeAnswers keeps ever reaches a control.
  const saved = store.get(key);
  const restored = sanitizeAnswers(set, saved && saved.answers);
  for (const q of set.questions) {
    if (!Object.prototype.hasOwnProperty.call(restored, q.id)) continue;
    if (q.type === 'choice') {
      const radio = sheet.querySelector(`input[type="radio"][name="${q.id}"][value="${restored[q.id]}"]`);
      if (radio) radio.checked = true;
    } else {
      const input = document.getElementById(`${q.id}-a`);
      if (input) input.value = restored[q.id];
    }
  }
  if (saved && typeof saved.member === 'string' && [...select.options].some((o) => o.value === saved.member && o.value !== '')) {
    select.value = saved.member;
  }

  // HH:MM, 24-hour (en-GB gives that shape on every browser)
  const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Reads the live controls at the moment of saving, so a Hangul syllable still being composed is whatever the field holds right now.
  function save() {
    if (!active) return;
    clearTimeout(timer);
    timer = null;
    dirty = false;
    const ok = store.set(key, { member: select.value || null, answers: readAnswers(set), updatedAt: new Date().toISOString() });
    if (ok) saveState.textContent = `자동 저장됨 · ${clock()}`;
    else showStorageNotice();
  }

  function later() {
    if (!active) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, 300);
  }

  paper.addEventListener('input', later);
  paper.addEventListener('change', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) save();
  });
  window.addEventListener('pagehide', () => {
    if (dirty) save();
  });

  return {
    stop() {
      active = false;
      clearTimeout(timer);
      store.remove(key);
      saveState.textContent = '';
    },
  };
}

function render(set, members) {
  document.title = `${set.title} · 스터디 복습 퀴즈`;
  const sheet = el('ol', { attrs: { id: 'sheet' } }, set.questions.map(buildQuestion));
  const status = el('p', { attrs: { id: 'status', role: 'status' } });
  const submit = el('button', { class: 'button', text: '답안 제출', attrs: { id: 'submit', type: 'button' } });
  const block = el(
    'div',
    { class: 'submit-block' },
    submit,
    el('div', { class: 'stub-text' }, el('p', { class: 'stub-note', text: '제출하면 첫 시도 답이 고정돼요.' }), status),
    plate('census', 'sheet-plate--right sheet-plate--stub'),
  );

  const savedName = (store.get('member') || {}).name;
  const select = el(
    'select',
    {
      attrs: { id: 'sheet-member', name: 'member' },
      on: {
        change: () => {
          if (select.value) store.set('member', { name: select.value });
        },
      },
    },
    el('option', { text: '이름 고르기', attrs: { value: '' } }),
    members.map((m) => el('option', { text: m.name, attrs: { value: m.name } })),
  );
  if (members.some((m) => m.name === savedName)) select.value = savedName;

  // Quiet lines under the exam fields: when the draft was last kept, and (only if needed) that nothing is kept.
  const notes = el('div', { class: 'sheet-notes' });
  const saveState = el('span', { attrs: { id: 'save-state' } });
  const showStorageNotice = () => {
    if (document.getElementById('storage-notice')) return;
    notes.append(el('p', { text: '이 브라우저에서는 답이 저장되지 않아요. 창을 닫으면 사라져요.', attrs: { id: 'storage-notice' } }));
  };
  notes.append(el('p', { class: 'save-line' }, saveState));
  if (!store.persistent) showStorageNotice();

  const concept = set.questions.filter((q) => q.kind !== 'code').length;
  const code = set.questions.length - concept;
  const from = monthDay(set.range && set.range.from);
  const to = monthDay(set.range && set.range.to);
  const field = (term, ...value) => el('div', { class: 'field' }, el('dt', {}, term), el('dd', {}, value));
  const fields = el(
    'dl',
    { class: 'sheet-fields', attrs: { 'data-reveal': 'load' } },
    members.length ? el('div', { class: 'field field--name' }, el('dt', {}, el('label', { text: '성명', attrs: { for: 'sheet-member' } })), el('dd', {}, select)) : null,
    from && to ? field('범위', `${from}–${to}`) : null,
    field('문항', `${set.questions.length}문제 · 개념 ${concept} · 코드 분석 ${code}`),
    field('예상 시간', `약 ${set.estimatedMinutes}분`),
  );
  const head = el(
    'header',
    { class: 'sheet-head' },
    el('h1', { text: set.title, attrs: { id: 'sheet-title', 'data-reveal': 'load' } }),
    fields,
    notes,
    plate('card', 'sheet-plate--head'),
  );

  // Ground plates hang in the margin beside a question; each is the last child of that question's item.
  const shown = ['card'];
  for (const gp of GROUND_PLATES) {
    const host = gp.at === 'head' ? head : sheet.children[gp.at];
    if (!host) continue;
    host.append(plate(gp.key, `sheet-plate--${gp.side}${gp.drift ? ' sheet-plate--drift' : ''}${gp.tall ? ' plate--tall sheet-plate--hero' : ''}`));
    shown.push(gp.key);
  }
  shown.push('census');

  const paper = el('article', { class: 'paper' }, head, sheet, block, creditsFor(shown));
  app.replaceChildren(paper);
  stagger(head, '[data-reveal]');
  stagger(sheet, 'li.q:nth-child(-n+3)');
  reveal(paper);

  const saved = store.get('attempt:' + set.id);
  if (saved) {
    showGraded(set, saved, { focus: false });
    focusFromHash();
    return;
  }

  const draft = setupDraft(set, paper, select, sheet, { saveState, showStorageNotice });
  focusFromHash();
  window.addEventListener('hashchange', focusFromHash);

  submit.addEventListener('click', () => {
    // The first attempt is frozen: a second click can never overwrite it.
    const existing = store.get('attempt:' + set.id);
    if (existing) {
      showGraded(set, existing, { focus: true });
      return;
    }
    if (members.length && !select.value) {
      status.textContent = '성명을 먼저 골라 주세요.';
      select.focus();
      return;
    }
    status.textContent = '';
    const answers = readAnswers(set);
    const graded = gradeSet(set, answers);
    const attempt = {
      setId: set.id,
      member: select.value || null,
      submittedAt: new Date().toISOString(),
      answers,
      results: graded.results,
      score: graded.score,
    };
    store.set('attempt:' + set.id, attempt);
    draft.stop(); // the attempt replaces the draft
    showGraded(set, attempt, { focus: true });
  });
}

// Stored data is untrusted: stored answers go through sanitizeAnswers, stored results are used only for known ids.
function resolveResults(set, attempt, answers) {
  const regraded = gradeSet(set, answers);
  const stored = attempt && typeof attempt.results === 'object' && attempt.results ? attempt.results : {};
  const results = {};
  const score = { total: 0, concept: 0, code: 0 };
  for (const q of set.questions) {
    const r = Object.prototype.hasOwnProperty.call(stored, q.id) ? stored[q.id] : null;
    const use = r && typeof r.correct === 'boolean' ? { correct: r.correct, blank: r.blank === true } : regraded.results[q.id];
    results[q.id] = use;
    if (use.correct) {
      score.total += 1;
      score[q.kind === 'code' ? 'code' : 'concept'] += 1;
    }
  }
  return { results, score, max: regraded.max };
}

function showGraded(set, attempt, { focus }) {
  const answers = sanitizeAnswers(set, attempt.answers);
  const { results, score, max } = resolveResults(set, attempt, answers);

  for (const q of set.questions) {
    const li = document.getElementById(q.id);
    if (!li) continue;
    const body = li.querySelector('.q-body');
    const r = results[q.id];

    // Put the stored answer back into the (now disabled) controls.
    if (Object.prototype.hasOwnProperty.call(answers, q.id)) {
      if (q.type === 'choice') {
        const radio = li.querySelector(`input[type="radio"][value="${answers[q.id]}"]`);
        if (radio) radio.checked = true;
      } else {
        const input = document.getElementById(`${q.id}-a`);
        if (input) input.value = answers[q.id];
      }
    }
    li.querySelectorAll('input').forEach((input) => {
      input.disabled = true;
    });

    const verdict = r.correct ? '정답' : r.blank ? '오답 · 빈 답' : '오답';
    const result = el(
      'section',
      { class: 'q-result', dataset: { result: r.correct ? 'correct' : 'wrong' }, attrs: { 'aria-label': `${set.questions.indexOf(q) + 1}번 문제 채점 결과` } },
      el('span', { class: 'mark', attrs: { 'aria-hidden': 'true' } }),
      el('span', { class: 'verdict', text: verdict }),
      el('p', { class: 'answer-line', text: '정답: ' + correctAnswerText(q) }),
    );
    body.prepend(result);
    li.classList.add('graded');
  }

  const scoreEl = (key) => el('span', { dataset: { score: key }, text: score[key] });
  const heading = el('h2', { text: '채점 결과', attrs: { id: 'score-heading', tabindex: '-1' } });
  const line = el(
    'p',
    { class: 'score-line' },
    `${max.total}문제 중 `,
    scoreEl('total'),
    `문제 정답 · 개념 `,
    scoreEl('concept'),
    `/${max.concept} · 코드 분석 `,
    scoreEl('code'),
    `/${max.code}`,
  );
  const section = el('section', { attrs: { id: 'score' } }, heading, line);
  document.querySelector('.sheet-head').after(section);

  const memberSelect = document.getElementById('sheet-member');
  if (memberSelect) {
    if (attempt.member && [...memberSelect.options].some((o) => o.value === attempt.member)) memberSelect.value = attempt.member;
    memberSelect.disabled = true;
  }
  const submit = document.getElementById('submit');
  if (submit) submit.remove();
  document.getElementById('status').textContent = `채점이 끝났어요. ${max.total}문제 중 ${score.total}문제 정답이에요.`;

  if (focus) {
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}

start();
