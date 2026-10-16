// Home controller: this week's title from the index, the member tabs on the folder stack, the name
// picker, 풀기 시작. The folder (fieldset, #start, #start-hint) is static markup in index.html;
// this script fills and wires it.
import { el, loadMembers, loadWeek, renderError, store } from './site.js';
import { sourceLabel } from './grade.js';
import { reveal, stagger } from './motion.js';

const app = document.querySelector('#app');
const stack = document.querySelector('#stack');
const sub = document.querySelector('#hero-sub');
const grid = document.querySelector('#members');
const startButton = document.querySelector('#start');
const hint = document.querySelector('#start-hint');
const original = [...app.childNodes];
const preview = document.querySelector('#preview');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// The subject plates: archival pictures of the world of data and study (credits in assets/credits.json).
// Alt text says what the picture shows, never who it might be taken for.
const PLATES = {
  card: { src: 'assets/hollerith-punched-card.jpg', pos: '30% 50%', alt: '구멍이 뚫린 1895년 홀러리스 천공 카드. 숫자 칸마다 구멍으로 값을 기록했다.' },
  puncher: { src: 'assets/card-puncher-census.jpg', pos: '50% 60%', alt: '1940년경 인구조사국에서 천공기로 카드에 구멍을 뚫는 작업 장면' },
  playfair: { src: 'assets/playfair-piecharts.jpg', pos: '10% 60%', alt: '윌리엄 플레이페어가 1801년에 그린, 유럽 여러 나라의 면적과 인구와 수입을 원과 선으로 나타낸 통계 지도' },
  nightingale: { src: 'assets/nightingale-mortality.jpg', pos: '85% 50%', alt: '플로렌스 나이팅게일이 1858년에 그린, 달마다 사망 원인을 부채꼴로 나타낸 도표' },
  form: { src: 'assets/census-form-1890.jpg', pos: '50% 8%', alt: '1890년 미국 인구조사 가족 조사표. 질문 항목과 빈 칸이 줄지어 있다.' },
  tabulator: { src: 'assets/tabulating-machines-census.jpg', pos: '50% 62%', alt: '20세기 초 인구조사국에서 천공 카드 더미를 집계기에 넣는 모습' },
  clocks: { src: 'assets/hollerith-census-machine.jpg', pos: '50% 25%', alt: '시계 모양 계기판 마흔 개가 달린 나무 상자 형태의 홀러리스 인구조사 집계기' },
  drawers: { src: 'assets/card-catalog-drawers.jpg', pos: '50% 50%', alt: '놋쇠 손잡이와 이름표 틀이 달린 도서관 카드 목록 서랍장' },
};
const DEFAULT_PLATE = 'drawers';
const SUBJECT_PLATE = {
  Pandas: 'card',
  '데이터 분석': 'tabulator',
  '데이터 시각화': ['playfair', 'nightingale'],
  머신러닝: 'puncher',
  Python: 'form',
};
const FALLBACK_PLATES = ['clocks', 'tabulator', 'card'];

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

// Which plate belongs to an entry: by subject; the visualisation subject alternates between its two charts.
function plateFor(source) {
  const pick = SUBJECT_PLATE[source.subject];
  if (Array.isArray(pick)) return pick[(parseInt(String(source.id).replace(/D/g, ''), 10) || 0) % pick.length];
  if (pick) return pick;
  let h = 0;
  for (const ch of String(source.subject || source.id)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return FALLBACK_PLATES[h % FALLBACK_PLATES.length];
}

// "문제 2개 · 개념 1 · 코드 분석 1"
function countLine(questions) {
  if (!questions.length) return '이 기록에서 나온 문제는 아직 없어요';
  const concept = questions.filter((q) => q.kind === 'concept').length;
  const code = questions.filter((q) => q.kind === 'code').length;
  return ['문제 ' + questions.length + '개', concept ? '개념 ' + concept : '', code ? '코드 분석 ' + code : ''].filter(Boolean).join(' · ');
}

// Index with preview: one fixed frame (#preview) that shows the pointed-at member's entries this week,
// how many questions cite each, and a plate for the subject. Pointer and keyboard focus show it; on touch
// a tap toggles it and Escape clears it. Everything reaches the DOM through el() / textContent.
function setupPreview(set, tabs) {
  const plate = el('figure', { class: 'plate plate--tall preview-plate' });
  const body = el('div', { class: 'preview-body' });
  preview.replaceChildren(plate, body);
  const idleLine = () => el('p', { class: 'preview-idle', text: '폴더 탭을 가리키거나 눌러 보세요. 그 사람의 이번 주 기록과 문제 수가 나와요.' });
  const images = new Map();
  let active = null;
  let lastPointer = '';


  function plateImage(id) {
    let img = images.get(id);
    if (!img) {
      const p = PLATES[id];
      img = el('img', { attrs: { src: p.src, alt: p.alt, decoding: 'async', draggable: 'false' } });
      img.style.setProperty('object-position', p.pos);
      images.set(id, img);
      plate.append(img);
    }
    return img;
  }

  function showPlate(id) {
    const img = plateImage(id);
    for (const other of images.values()) other.classList.toggle('is-on', other === img);
  }

  // Fetch the plates this week needs the first time anyone shows interest, not on page load.
  let preloaded = false;
  function preload() {
    if (preloaded) return;
    preloaded = true;
    for (const s of set.sources) plateImage(plateFor(s));
  }

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
    showPlate(DEFAULT_PLATE);
  }

  function show(name) {
    if (active === name) return;
    active = name;
    preload();
    for (const t of tabs) t.setAttribute('aria-pressed', String(t.dataset.member === name));
    preview.dataset.state = 'member';

    const entries = set.sources.filter((s) => s.author === name);
    const cited = (id) => set.questions.filter((q) => Array.isArray(q.sourceIds) && q.sourceIds.includes(id));
    const nodes = [el('h3', { class: 'preview-name', text: name + '의 이번 주 기록' })];
    if (!entries.length) {
      nodes.push(el('p', { class: 'preview-total', text: '이번 주 기록이 없어요' }));
      showPlate(DEFAULT_PLATE);
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
      showPlate(plateFor(entries[0]));
    }
    swap(nodes);
  }

  body.append(idleLine());
  showPlate(DEFAULT_PLATE);

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
  setupPreview(set, [...stack.querySelectorAll('.tab')]);

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
