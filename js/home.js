// Home controller: this week's title from the index, the member tabs on the folder stack, the name
// picker, 풀기 시작. The folder (fieldset, #start, #start-hint) is static markup in index.html;
// this script fills and wires it.
import { el, loadMembers, loadWeek, renderError, store } from './site.js';
import { reveal, stagger } from './motion.js';

const app = document.querySelector('#app');
const stack = document.querySelector('#stack');
const sub = document.querySelector('#hero-sub');
const grid = document.querySelector('#members');
const startButton = document.querySelector('#start');
const hint = document.querySelector('#start-hint');
const original = [...app.childNodes];

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
  const { entry, set } = week;

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
