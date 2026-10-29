// 내 오답 노트: a member's wrong answers across every week, behind their PIN when the team sheet is on,
// from this browser's own first attempts when it is off. Plus the team's hardest questions (totals only).
import { el, getJson, loadMembers, store } from './site.js';
import { sourceLabel } from './grade.js';
import { reveal, stagger } from './motion.js';
import { call, endpoint, ensurePin, forgetPin, LOW_RATE, messageFor, rateOf, teamStats } from './team.js';

const WEEK_ID = /^\d{4}-W\d{2}$/;
const SET_FILE = /^quizzes\/[A-Za-z0-9._-]+\.json$/;

const form = document.querySelector('#notes-open');
const select = document.querySelector('#notes-member');
const status = document.querySelector('#notes-status');
const lead = document.querySelector('#notes-lead');
const notebook = document.querySelector('#notebook');

// 2026-10-22 -> "10/22"
function monthDay(iso) {
  const m = /^[0-9]{4}-([0-9]{2})-([0-9]{2})/.exec(String(iso || ''));
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

// Published weeks (newest first) with their sets, read once.
let weeksPromise = null;
function loadWeeks() {
  if (!weeksPromise) {
    weeksPromise = getJson('quizzes/index.json').then(async (index) => {
      const entries = (Array.isArray(index) ? index : []).filter((w) => w && WEEK_ID.test(w.id) && typeof w.file === 'string' && SET_FILE.test(w.file));
      const sets = await Promise.all(entries.map((w) => getJson(w.file).catch(() => null)));
      return entries.map((entry, i) => ({ entry, set: sets[i] })).filter((w) => w.set && Array.isArray(w.set.questions));
    });
  }
  return weeksPromise;
}

const practiceHref = (week, qid) => `quiz.html?set=${encodeURIComponent(week)}&practice=1#${qid}`;

// One question as a note: when and where it came from, the question itself, and a way back to it.
function noteItem(week, set, q, extra) {
  const number = set.questions.indexOf(q) + 1;
  const src = Array.isArray(q.sourceIds) && q.sourceIds.length ? (set.sources || []).find((s) => s.id === q.sourceIds[0]) : null;
  // sourceLabel already carries the record's date ("노아영 · 10/21")
  const origin = src ? `${sourceLabel(src)} 노션 기록` : q.file ? `실습 파일 · ${q.file} · ${monthDay(set.range && set.range.to)}` : '';
  const subject = src ? src.subject : '';
  const meta = [week.title, subject, origin].filter(Boolean).join(' · ');
  return el(
    'li',
    { class: 'note', attrs: { 'data-reveal': '' } },
    el('p', { class: 'note-meta', text: meta }),
    el('p', { class: 'note-prompt' }, el('span', { class: 'note-num', text: `${number}번 ` }), q.prompt),
    extra || null,
    el('a', { class: 'text-link note-again', text: '다시 풀기', attrs: { href: practiceHref(week.id, q.id), 'aria-label': `${week.title} ${number}번 다시 풀기` } }),
  );
}

// rows: [{ week, question, correct }] for one member.
async function renderNotebook(name, rows, { local }) {
  const weeks = await loadWeeks();
  const byWeek = new Map();
  for (const r of rows) {
    if (!byWeek.has(r.week)) byWeek.set(r.week, new Map());
    byWeek.get(r.week).set(r.question, r.correct === true);
  }
  const parts = [];
  for (const { entry, set } of weeks) {
    const marks = byWeek.get(entry.id);
    if (!marks) continue;
    const taken = set.questions.filter((q) => marks.has(q.id));
    const right = taken.filter((q) => marks.get(q.id)).length;
    const wrong = taken.filter((q) => !marks.get(q.id));
    const from = monthDay(set.range && set.range.from);
    const to = monthDay(set.range && set.range.to);
    parts.push(
      el(
        'section',
        { class: 'note-week', attrs: { 'aria-label': entry.title } },
        el('h2', { text: entry.title, attrs: { 'data-reveal': '' } }),
        el('p', { class: 'note-score', attrs: { 'data-reveal': '' } }, from && to ? `${from}–${to} · ` : '', `${set.questions.length}문제 중 `, el('span', { class: 'nums', text: String(right) }), '문제 정답'),
        wrong.length
          ? el('ol', { class: 'note-list' }, wrong.map((q) => noteItem({ id: entry.id, title: entry.title }, set, q)))
          : el('p', { class: 'note-empty', text: '이 주는 틀린 문제가 없어요.' }),
      ),
    );
  }
  if (!parts.length) {
    parts.push(
      el('p', {
        class: 'note-empty',
        text: local
          ? `이 브라우저에는 ${name}님이 제출한 시험지가 없어요.`
          : `아직 팀 기록에 보낸 시험지가 없어요. 시험지를 제출한 뒤 채점 결과 위의 '팀 기록에 보내기'를 눌러 주세요.`,
      }),
    );
  }
  notebook.replaceChildren(el('p', { class: 'note-owner', text: `${name}님의 노트${local ? ' · 이 브라우저에 남은 기록' : ''}` }), ...parts);
  stagger(notebook, '[data-reveal]');
  reveal(notebook);
}

// Without the team sheet: this browser's own frozen first attempts for that name.
async function localRows(name) {
  const weeks = await loadWeeks();
  const rows = [];
  for (const { entry } of weeks) {
    const a = store.get('attempt:' + entry.id);
    if (!a || a.member !== name || !a.results) continue;
    for (const [question, r] of Object.entries(a.results)) rows.push({ week: entry.id, question, correct: Boolean(r && r.correct) });
  }
  return rows;
}

async function open(name) {
  status.textContent = '';
  if (!(await endpoint())) {
    await renderNotebook(name, await localRows(name), { local: true });
    return;
  }
  try {
    const pin = await ensurePin(name);
    if (!pin) return;
    status.textContent = '노트를 불러오는 중이에요.';
    const { rows } = await call('mine', { name, pin });
    status.textContent = '';
    await renderNotebook(name, Array.isArray(rows) ? rows : [], { local: false });
  } catch (err) {
    if (err.code === 'bad-pin' || err.code === 'locked' || err.code === 'no-pin') forgetPin(name);
    status.textContent = messageFor(err.code);
  }
}

// 다 같이 어려웠던 문제: every question under LOW_RATE, hardest first. Totals only, never names.
async function renderTeamLow() {
  const stats = await teamStats();
  const weeks = await loadWeeks();
  const low = [];
  for (const { entry, set } of weeks) {
    for (const q of set.questions) {
      const rate = rateOf(stats, entry.id, q.id);
      if (rate && rate.pct < LOW_RATE) low.push({ entry, set, q, rate });
    }
  }
  if (!Object.keys(stats).length) return;
  const section = document.querySelector('#team-low');
  const list = document.querySelector('#team-low-list');
  low.sort((a, b) => a.rate.pct - b.rate.pct);
  list.replaceChildren(
    ...(low.length
      ? low.map(({ entry, set, q, rate }) =>
          noteItem({ id: entry.id, title: entry.title }, set, q, el('p', { class: 'note-rate', text: `팀 정답률 ${rate.pct}% · ${rate.total}명 중 ${rate.right}명` })),
        )
      : [el('li', { class: 'note-empty', text: '정답률이 50%보다 낮은 문제가 없어요.' })]),
  );
  section.hidden = false;
  stagger(section, '[data-reveal]');
  reveal(section);
}

async function start() {
  let members = [];
  try {
    members = await loadMembers();
  } catch {
    status.textContent = '이름 목록을 불러오지 못했어요.';
  }
  select.append(...members.map((m) => el('option', { text: m.name, attrs: { value: m.name } })));
  const saved = (store.get('member') || {}).name;
  if (members.some((m) => m.name === saved)) select.value = saved;

  if (!(await endpoint())) {
    lead.textContent = '이름을 고르면 이 브라우저에서 제출한 시험지의 틀린 문제가 주차별로 모여요. 다른 기기에서 푼 기록은 여기 나오지 않아요.';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!select.value) {
      status.textContent = '이름을 먼저 골라 주세요.';
      select.focus();
      return;
    }
    store.set('member', { name: select.value });
    open(select.value);
  });

  renderTeamLow();
}

stagger(document.body, '[data-reveal]');
reveal();
start();
