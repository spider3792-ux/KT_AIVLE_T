// review.html?set=<week>: the week's review note, opened from the graded sheet's "복습 노트" link.
// Shown only once this browser has the week's first attempt (it doubles as the answer sheet).
import { el, getJson, store, renderError } from './site.js';
import { checkNote, inlineParts, NOTE_ID } from './note-format.js';

const app = document.getElementById('app');

const rich = (text) =>
  inlineParts(text).map((p) => (p.kind === 'bold' ? el('strong', { text: p.text }) : p.kind === 'code' ? el('code', { text: p.text }) : p.text));

function block(b) {
  if (b.type === 'p') return el('p', {}, rich(b.text));
  if (b.type === 'list') return el('ul', { class: 'rn-list' }, b.items.map((t) => el('li', {}, rich(t))));
  if (b.type === 'code') return el('pre', { class: 'rn-code' }, el('code', { text: b.text }));
  if (b.type === 'table') {
    return el(
      'div',
      { class: 'rn-table', attrs: { tabindex: '0', role: 'region', 'aria-label': '표' } },
      el('table', {}, el('thead', {}, el('tr', {}, b.head.map((t) => el('th', { attrs: { scope: 'col' } }, rich(t))))), el('tbody', {}, b.rows.map((r) => el('tr', {}, r.map((t) => el('td', {}, rich(t))))))),
    );
  }
  const tip = b.type === 'tip';
  return el(
    'aside',
    { class: tip ? 'rn-box rn-box--tip' : 'rn-box rn-box--key' },
    el('p', { class: 'rn-box-label', text: tip ? '헷갈리기 쉬운 점' : '이것만 기억' }),
    b.items.length > 1 ? el('ul', {}, b.items.map((t) => el('li', {}, rich(t)))) : el('p', {}, rich(b.items[0])),
  );
}

async function start() {
  const id = new URLSearchParams(location.search).get('set') || '';
  if (!NOTE_ID.test(id)) return renderError(app, '어느 주의 복습 노트인지 알 수 없어요.', { link: { text: '홈으로', href: 'index.html' } });
  const sheet = 'quiz.html?set=' + encodeURIComponent(id);
  if (!store.get('attempt:' + id)) {
    return renderError(app, '복습 노트는 해답지를 겸해서, 시험지를 제출한 뒤에 열려요.', { link: { text: '시험지 풀러 가기', href: sheet } });
  }
  let note;
  try {
    note = await getJson(`review/${id}.json`);
  } catch (err) {
    const msg = err.status === 404 ? '이 주에는 아직 복습 노트가 없어요.' : '복습 노트를 불러오지 못했어요.';
    return renderError(app, msg, { link: { text: '채점 결과로 돌아가기', href: sheet } });
  }
  if (checkNote(note, id).length) return renderError(app, '복습 노트 파일에 문제가 있어요.', { link: { text: '채점 결과로 돌아가기', href: sheet } });

  document.title = `${note.title} · 스터디 복습 퀴즈`;
  const file = (ext) => `review/${id}.${ext}`;
  const head = el(
    'header',
    { class: 'sheet-head rn-head' },
    el('a', { class: 'text-link rn-back', text: '← 채점 결과로', attrs: { href: sheet } }),
    el('h1', { text: note.title }),
    (note.lead || []).map((t) => el('p', { class: 'rn-lead' }, rich(t))),
    el(
      'div',
      { class: 'rn-downloads' },
      el('a', { class: 'button', text: 'PDF 받기', attrs: { href: file('pdf'), download: `${id}-복습노트.pdf` } }),
      el('a', { class: 'button button--quiet', text: 'Word(.docx) 받기 · 수정 가능', attrs: { href: file('docx'), download: `${id}-복습노트.docx` } }),
    ),
  );
  const body = note.sections.map((s) =>
    el(
      'section',
      { class: s.level === 1 ? 'rn-part' : 'rn-concept' },
      el(s.level === 1 ? 'h2' : 'h3', { text: s.heading }),
      s.ref ? el('p', { class: 'rn-ref', text: s.ref }) : null,
      s.blocks.map(block),
    ),
  );
  app.replaceChildren(el('article', { class: 'paper review-note' }, head, body));
}

start();
