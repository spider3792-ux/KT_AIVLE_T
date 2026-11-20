// The weekly review note (review/<week>.json): one file that becomes the review page, the .docx and the .pdf.
// Pure helpers only (no DOM, no node APIs) so js/review.js and scripts/build-note.mjs read the note the same way.
//
// { id, title, lead: [text], sections: [ { level: 1|2, heading, ref?, blocks: [block] } ] }
// block: { type: 'p', text } | { type: 'list', items: [text] } | { type: 'table', head: [text], rows: [[text]], widths?: [n] }
//      | { type: 'code', text } | { type: 'tip', items: [text] } | { type: 'key', items: [text] }
// Texts may use **bold** and `code`; nothing else is markup.

export const NOTE_ID = /^\d{4}-W\d{2}$/;
const BLOCKS = ['p', 'list', 'table', 'code', 'tip', 'key'];

// "a **b** `c`" -> [{ kind: 'text', text: 'a ' }, { kind: 'bold', text: 'b' }, { kind: 'text', text: ' ' }, { kind: 'code', text: 'c' }]
export function inlineParts(text) {
  const src = String(text ?? '');
  const out = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    out.push(m[1] != null ? { kind: 'bold', text: m[1] } : { kind: 'code', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextList = (v) => Array.isArray(v) && v.length > 0 && v.every(isText);

// Korean problem lines; [] when the note is usable.
export function checkNote(note, expectedId) {
  const errs = [];
  if (!note || typeof note !== 'object' || Array.isArray(note)) return ['노트가 객체가 아니에요'];
  if (!NOTE_ID.test(String(note.id))) errs.push(`id가 YYYY-Www 형식이 아니에요: ${note.id}`);
  if (expectedId && note.id !== expectedId) errs.push(`id(${note.id})가 주차(${expectedId})와 달라요`);
  if (!isText(note.title)) errs.push('title이 없어요');
  if (note.lead != null && !isTextList(note.lead)) errs.push('lead는 문장 목록이어야 해요');
  if (!Array.isArray(note.sections) || note.sections.length === 0) {
    errs.push('sections가 비어 있어요');
    return errs;
  }
  note.sections.forEach((s, i) => {
    const at = `sections[${i}]`;
    if (!s || typeof s !== 'object') return errs.push(`${at}: 객체가 아니에요`);
    if (s.level !== 1 && s.level !== 2) errs.push(`${at}: level은 1 또는 2예요`);
    if (!isText(s.heading)) errs.push(`${at}: heading이 없어요`);
    if (s.ref != null && !isText(s.ref)) errs.push(`${at}: ref는 글이어야 해요`);
    if (!Array.isArray(s.blocks)) return errs.push(`${at}: blocks가 목록이 아니에요`);
    s.blocks.forEach((b, j) => {
      const bt = `${at}.blocks[${j}]`;
      if (!b || !BLOCKS.includes(b.type)) return errs.push(`${bt}: type은 ${BLOCKS.join(', ')} 중 하나예요`);
      if ((b.type === 'p' || b.type === 'code') && !isText(b.text)) errs.push(`${bt}: text가 없어요`);
      if ((b.type === 'list' || b.type === 'tip' || b.type === 'key') && !isTextList(b.items)) errs.push(`${bt}: items가 비어 있어요`);
      if (b.type === 'table') {
        if (!isTextList(b.head)) return errs.push(`${bt}: head가 비어 있어요`);
        if (!Array.isArray(b.rows) || b.rows.length === 0) return errs.push(`${bt}: rows가 비어 있어요`);
        b.rows.forEach((r, k) => {
          if (!Array.isArray(r) || r.length !== b.head.length || !r.every((c) => typeof c === 'string')) {
            errs.push(`${bt}.rows[${k}]: 칸 수가 head(${b.head.length})와 달라요`);
          }
        });
        if (b.widths != null && (!Array.isArray(b.widths) || b.widths.length !== b.head.length || !b.widths.every((w) => w > 0))) {
          errs.push(`${bt}: widths는 head와 같은 수의 양수예요`);
        }
      }
    });
  });
  return errs;
}
