// Exam sheet controller: render the set, grade on 답안 제출, freeze the first attempt, show it again on reload.
import { el, loadMembers, loadWeek, renderError, store } from './site.js';
import { correctAnswerText, gradeSet, sanitizeAnswers } from './grade.js';

const app = document.querySelector('#app');
const requestedId = new URLSearchParams(location.search).get('set') || '';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function buildQuestion(q) {
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
    q.choices.forEach((choice, index) => {
      fieldset.append(
        el(
          'label',
          { class: 'opt' },
          el('input', { attrs: { type: 'radio', name: q.id, value: index } }),
          el('span', { text: choice }),
        ),
      );
    });
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

  return el('li', { class: 'q', attrs: { id: q.id }, dataset: { qid: q.id, kind: q.kind } }, body);
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

function render(set, members) {
  document.title = `${set.title} · 스터디 복습 퀴즈`;
  const sheet = el('ol', { attrs: { id: 'sheet' } }, set.questions.map(buildQuestion));
  const status = el('p', { attrs: { id: 'status', role: 'status' } });
  const submit = el('button', { class: 'button', text: '답안 제출', attrs: { id: 'submit', type: 'button' } });
  const block = el('div', { class: 'submit-block' }, submit, status);

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

  const head = el(
    'header',
    { class: 'sheet-head' },
    el('h1', { text: set.title, attrs: { id: 'sheet-title' } }),
    el('p', { class: 'sheet-meta', text: `${set.questions.length}문제 · 약 ${set.estimatedMinutes}분` }),
    members.length ? el('div', { class: 'sheet-name' }, el('label', { text: '성명', attrs: { for: 'sheet-member' } }), select) : null,
  );

  const paper = el('article', { class: 'paper' }, head, sheet, block);
  app.replaceChildren(paper);

  const saved = store.get('attempt:' + set.id);
  if (saved) {
    showGraded(set, saved, { focus: false });
    return;
  }

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
  if (!store.persistent) {
    section.append(el('p', { text: '이 브라우저에서는 기록이 저장되지 않아요. 창을 닫으면 사라져요.', attrs: { id: 'storage-notice' } }));
  }
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
