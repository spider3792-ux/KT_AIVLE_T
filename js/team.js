// Team records kept in 승환's Google Sheet through apps-script/Code.gs.
// Off until config.json names the deployed web app: every caller then simply shows nothing extra.
// The sheet only ever receives name, week, question id and correct/incorrect (and a PIN to check).
import { el, getJson, ROOT } from './site.js';

const WEB_APP = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const LOCAL_FAKE = '__sheet'; // scripts/serve.mjs --fake-sheet answers here (tests only)
const PIN = /^[0-9]{4}$/;

// Questions answered by fewer than this share of takers are marked on the site.
export const LOW_RATE = 50;

let endpointPromise = null;

// The web app URL from config.json, or null when the team records are off.
export function endpoint() {
  if (!endpointPromise) {
    endpointPromise = getJson('config.json')
      .then((c) => {
        const url = c && typeof c.sheetUrl === 'string' ? c.sheetUrl.trim() : '';
        if (WEB_APP.test(url)) return url;
        if (url === LOCAL_FAKE && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return new URL(url, ROOT).href;
        return null;
      })
      .catch(() => null);
  }
  return endpointPromise;
}

export class TeamError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TeamError';
    this.code = code;
  }
}

// One request to the web app. text/plain keeps the browser from sending a CORS preflight Apps Script cannot answer.
export async function call(action, payload = {}) {
  const url = await endpoint();
  if (!url) throw new TeamError('off');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let json;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action }),
      cache: 'no-store',
      signal: ctrl.signal,
    });
    json = await res.json();
  } catch {
    throw new TeamError('network');
  } finally {
    clearTimeout(timer);
  }
  if (!json || json.ok !== true) throw new TeamError((json && json.error) || 'server');
  return json;
}

const MESSAGES = {
  'bad-pin': 'PIN이 맞지 않아요.',
  'bad-pin-format': 'PIN은 숫자 4자리예요.',
  'pin-exists': '이 이름은 이미 PIN이 있어요. 그 PIN을 입력해 주세요.',
  'no-pin': '아직 PIN이 없어요. 먼저 PIN을 만들어 주세요.',
  locked: 'PIN을 여러 번 틀려서 15분 동안 잠겼어요. 잊었다면 승환에게 초기화를 부탁해 주세요.',
  network: '팀 기록에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.',
};
export const messageFor = (code) => MESSAGES[code] || '팀 기록에서 문제가 생겼어요. 잠시 뒤 다시 해 주세요.';

// The PIN is kept for this tab only: closing the tab forgets it.
function remembered(name) {
  try {
    const v = sessionStorage.getItem('srq:pin:' + name);
    return v && PIN.test(v) ? v : null;
  } catch {
    return null;
  }
}

function remember(name, pin) {
  try {
    if (pin) sessionStorage.setItem('srq:pin:' + name, pin);
    else sessionStorage.removeItem('srq:pin:' + name);
  } catch {
    /* the member types it again next time */
  }
}

export const forgetPin = (name) => remember(name, null);

function pinField(id, label) {
  return el(
    'p',
    { class: 'pin-field' },
    el('label', { text: label, attrs: { for: id } }),
    el('input', {
      class: 'pin-input',
      attrs: { id, type: 'password', inputmode: 'numeric', pattern: '[0-9]{4}', maxlength: '4', autocomplete: 'off', required: true },
    }),
  );
}

// Asks the member's PIN in a slip dialog, checks it with the sheet (or creates it the first time) and keeps it for
// this tab. Resolves the PIN, or null when the member cancels. Throws TeamError when the sheet cannot be reached.
export async function ensurePin(name) {
  const known = remembered(name);
  if (known) return known;
  const { hasPin } = await call('status', { name });
  const create = !hasPin;

  const first = pinField('pin-1', create ? '새 PIN (숫자 4자리)' : 'PIN (숫자 4자리)');
  const second = create ? pinField('pin-2', '한 번 더') : null;
  const error = el('p', { class: 'pin-error', attrs: { role: 'alert' } });
  const ok = el('button', { class: 'button', text: create ? 'PIN 만들기' : '확인', attrs: { type: 'submit', value: 'ok' } });
  const form = el(
    'form',
    { attrs: { method: 'dialog' } },
    el('h2', { text: create ? 'PIN 만들기' : 'PIN 입력', attrs: { id: 'pin-title' } }),
    el('p', {
      class: 'slip-desc',
      attrs: { id: 'pin-desc' },
      text: create
        ? `${name}님 기록을 열 때 쓸 숫자 4자리를 정해 주세요. 다른 사람은 이 PIN 없이 내 점수와 오답을 볼 수 없어요.`
        : `${name}님의 숫자 4자리 PIN을 입력해 주세요.`,
    }),
    first,
    second,
    error,
    el(
      'div',
      { class: 'confirm-actions' },
      // type=button: Enter in a PIN field must submit 확인, never this
      el('button', { class: 'button button--quiet', text: '취소', attrs: { type: 'button', value: 'cancel' }, on: { click: () => dialog.close() } }),
      ok,
    ),
  );
  const dialog = el('dialog', { class: 'slip-dialog', attrs: { id: 'pin', 'aria-labelledby': 'pin-title', 'aria-describedby': 'pin-desc' } }, form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener('close', () => finish(null));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const pin = first.querySelector('input').value.trim();
      error.textContent = '';
      if (!PIN.test(pin)) {
        error.textContent = messageFor('bad-pin-format');
        return;
      }
      if (create && second.querySelector('input').value.trim() !== pin) {
        error.textContent = '두 PIN이 서로 달라요.';
        return;
      }
      ok.disabled = true;
      try {
        await call(create ? 'setPin' : 'check', { name, pin });
        remember(name, pin);
        finish(pin);
      } catch (err) {
        error.textContent = messageFor(err.code);
        first.querySelector('input').select();
      } finally {
        ok.disabled = false;
      }
    });
    dialog.showModal();
    first.querySelector('input').focus();
  });
}

// { [week]: { takers, questions: { [qid]: { right, total } } } }; {} when off, unreachable, or too few takers.
let statsPromise = null;
export function teamStats({ fresh = false } = {}) {
  if (!statsPromise || fresh) {
    statsPromise = call('stats')
      .then((r) => (r.weeks && typeof r.weeks === 'object' ? r.weeks : {}))
      .catch(() => ({}));
  }
  return statsPromise;
}

// { pct, right, total } for one question, or null.
export function rateOf(stats, week, qid) {
  const cell = stats && stats[week] && stats[week].questions && stats[week].questions[qid];
  if (!cell || !Number.isInteger(cell.total) || cell.total <= 0 || !Number.isInteger(cell.right)) return null;
  return { pct: Math.round((cell.right / cell.total) * 100), right: cell.right, total: cell.total };
}
