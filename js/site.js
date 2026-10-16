// Browser helpers shared by every page controller.
// Every data field reaches the DOM through textContent or text nodes (el() below); never build markup from strings.
import { createStore } from './storage.js';

// Site root, independent of which HTML page imported this module (works on a GitHub Pages sub-path).
export const ROOT = new URL('../', import.meta.url);

export async function getJson(path) {
  const res = await fetch(new URL(path, ROOT), { cache: 'no-cache' });
  if (!res.ok) {
    // A Pages 404 is an HTML page: never parse it as JSON.
    const err = new Error(`${path}: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const UNSAFE_URL = /^[\s\u0000-\u001f]*javascript:/i;

// el('div', { class: 'x', text: 'hello', attrs: { id: 'a' }, dataset: { qid: 'q1' }, on: { click: fn } }, child, 'text')
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  const { class: cls, text, attrs, dataset, on } = props || {};
  if (cls) node.className = cls;
  if (text != null) node.textContent = String(text);
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (/^on/i.test(name)) continue; // no inline handlers
      if ((name === 'href' || name === 'src') && UNSAFE_URL.test(String(value))) continue;
      if (value === false || value == null) continue;
      node.setAttribute(name, value === true ? '' : String(value));
    }
  }
  if (dataset) for (const [k, v] of Object.entries(dataset)) node.dataset[k] = String(v);
  if (on) for (const [type, fn] of Object.entries(on)) node.addEventListener(type, fn);
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const store = createStore();

const WEEK_ID = /^\d{4}-W\d{2}$/;
const SET_FILE = /^quizzes\/[A-Za-z0-9._-]+\.json$/;

function failure(name, message) {
  const err = new Error(message);
  err.name = name;
  return err;
}

// Resolves ?set= only through the entries of quizzes/index.json, then reads that entry's file.
export async function loadWeek(requestedId) {
  const weeks = await getJson('quizzes/index.json');
  if (!Array.isArray(weeks) || weeks.length === 0) throw failure('LoadError', 'quizzes/index.json is empty');
  const entry = requestedId ? weeks.find((w) => w && w.id === requestedId && WEEK_ID.test(w.id)) : weeks[0];
  if (!entry) throw failure('NotFound', `unknown set: ${String(requestedId).slice(0, 40)}`);
  if (typeof entry.file !== 'string' || !SET_FILE.test(entry.file)) throw failure('LoadError', 'bad file in index');
  const set = await getJson(entry.file);
  return { weeks, entry, set };
}

// The six member names for the name picker. Entries without a usable name are dropped.
export async function loadMembers() {
  const json = await getJson('members.json');
  const list = Array.isArray(json && json.members) ? json.members : [];
  return list
    .filter((m) => m && typeof m.name === 'string' && m.name.trim() !== '')
    .map((m) => ({ name: m.name.trim(), confirm: m.confirm === true }));
}

// Korean error panel with an optional retry button and/or link.
export function renderError(container, message, { retry, link } = {}) {
  const actions = [];
  if (retry) actions.push(el('button', { class: 'button', text: '다시 시도', attrs: { type: 'button' }, on: { click: retry } }));
  if (link) actions.push(el('a', { class: 'text-link', text: link.text, attrs: { href: link.href } }));
  container.replaceChildren(
    el('div', { class: 'error-panel', attrs: { role: 'alert' } }, el('p', { class: 'error-message', text: message }), actions.length ? el('div', { class: 'error-actions' }, actions) : null),
  );
}
