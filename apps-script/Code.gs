// 스터디 복습 퀴즈 · 팀 기록 (Google Apps Script, 구글 시트에 붙여 넣는 코드)
//
// The quiz site POSTs JSON as text/plain (no CORS preflight) to this web app and reads JSON back.
// The sheet keeps only what the team agreed on:
//   results  name | week | question | correct      (one row per question of a first attempt)
//   pins     name | pinHash                        (salted SHA-256 of the 4-digit PIN, never the PIN)
// Nobody but the sheet owner can open the sheet. Through this script a member reads only their own rows
// (with their PIN); everyone else gets per-question totals, and only once MIN_TAKERS people took a week.
//
// Deploy: 배포 > 새 배포 > 웹 앱, 다음 사용자로 실행: 나, 액세스 권한: 모든 사용자.

var MEMBERS = ['김준수', '이주현', '차승환', '송지희', '노아영', '정보경'];
var MIN_TAKERS = 3; // fewer takers than this and a week's totals would give away someone's answers
var MAX_FAILS = 5; // wrong PINs in a row before the name is locked for LOCK_SECONDS
var LOCK_SECONDS = 900;

var WEEK_ID = /^\d{4}-W\d{2}$/;
var QUESTION_ID = /^q\d{1,2}$/;
var PIN = /^\d{4}$/;

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return reply({ ok: false, error: 'bad-request' });
  }
  try {
    return reply(handle(req));
  } catch (err) {
    return reply({ ok: false, error: 'server' });
  }
}

// A plain GET answers that the web app is up (the setup guide opens the URL once to check).
function doGet() {
  return reply({ ok: true, service: 'study-review-quiz' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle(req) {
  var action = req && req.action;
  if (action === 'stats') return stats();
  if (MEMBERS.indexOf(req.name) < 0) return { ok: false, error: 'bad-name' };
  if (action === 'status') return { ok: true, hasPin: pinHashOf(req.name) !== null };
  if (action === 'setPin') return setPin(req.name, req.pin);
  if (action === 'check') return checkPin(req.name, req.pin);
  if (action === 'submit') return submit(req);
  if (action === 'mine') return mine(req);
  return { ok: false, error: 'bad-request' };
}

// ---------------------------------------------------------------- sheets

function sheet(name, header) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var s = book.getSheetByName(name);
  if (!s) {
    s = book.insertSheet(name);
    s.appendRow(header);
  }
  return s;
}

function resultsSheet() {
  return sheet('results', ['name', 'week', 'question', 'correct']);
}

function pinsSheet() {
  return sheet('pins', ['name', 'pinHash']);
}

// Data rows without the header.
function rows(s) {
  return s.getDataRange().getValues().slice(1);
}

// ---------------------------------------------------------------- PIN

function salt() {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty('SALT');
  if (!value) {
    value = Utilities.getUuid();
    props.setProperty('SALT', value);
  }
  return value;
}

function hash(name, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt() + '|' + name + '|' + pin, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function pinHashOf(name) {
  var list = rows(pinsSheet());
  for (var i = 0; i < list.length; i++) if (list[i][0] === name) return String(list[i][1]);
  return null;
}

function setPin(name, pin) {
  if (!PIN.test(String(pin))) return { ok: false, error: 'bad-pin-format' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (pinHashOf(name) !== null) return { ok: false, error: 'pin-exists' };
    pinsSheet().appendRow([name, hash(name, String(pin))]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ok, or the reason it is refused. Wrong PINs are counted per name; MAX_FAILS of them lock the name a while.
function verify(name, pin) {
  var cache = CacheService.getScriptCache();
  var key = 'fails:' + name;
  var fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return 'locked';
  var stored = pinHashOf(name);
  if (stored === null) return 'no-pin';
  if (!PIN.test(String(pin)) || hash(name, String(pin)) !== stored) {
    cache.put(key, String(fails + 1), LOCK_SECONDS);
    return fails + 1 >= MAX_FAILS ? 'locked' : 'bad-pin';
  }
  cache.remove(key);
  return 'ok';
}

function checkPin(name, pin) {
  var v = verify(name, pin);
  return v === 'ok' ? { ok: true } : { ok: false, error: v };
}

// ---------------------------------------------------------------- results

// The first attempt of a week is final: a second submit for the same name and week changes nothing.
function submit(req) {
  var v = verify(req.name, req.pin);
  if (v !== 'ok') return { ok: false, error: v };
  if (!WEEK_ID.test(String(req.week))) return { ok: false, error: 'bad-week' };
  var results = req.results && typeof req.results === 'object' ? req.results : {};
  var ids = Object.keys(results).filter(function (id) {
    return QUESTION_ID.test(id) && typeof results[id] === 'boolean';
  });
  if (ids.length === 0 || ids.length > 20) return { ok: false, error: 'bad-results' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var s = resultsSheet();
    var have = rows(s).some(function (r) {
      return r[0] === req.name && r[1] === req.week;
    });
    if (have) return { ok: true, already: true };
    var add = ids.map(function (id) {
      return [req.name, req.week, id, results[id]];
    });
    s.getRange(s.getLastRow() + 1, 1, add.length, 4).setValues(add);
    return { ok: true, already: false };
  } finally {
    lock.releaseLock();
  }
}

function mine(req) {
  var v = verify(req.name, req.pin);
  if (v !== 'ok') return { ok: false, error: v };
  var out = rows(resultsSheet())
    .filter(function (r) {
      return r[0] === req.name;
    })
    .map(function (r) {
      return { week: String(r[1]), question: String(r[2]), correct: r[3] === true || r[3] === 'TRUE' };
    });
  return { ok: true, rows: out };
}

// { weeks: { "2026-W44": { takers: 4, questions: { q1: { right: 3, total: 4 }, ... } } } }, no names.
function stats() {
  var weeks = {};
  var takers = {};
  rows(resultsSheet()).forEach(function (r) {
    var week = String(r[1]);
    var q = String(r[2]);
    var right = r[3] === true || r[3] === 'TRUE';
    if (!WEEK_ID.test(week) || !QUESTION_ID.test(q)) return;
    var w = (weeks[week] = weeks[week] || { takers: 0, questions: {} });
    var t = (takers[week] = takers[week] || {});
    t[r[0]] = true;
    var cell = (w.questions[q] = w.questions[q] || { right: 0, total: 0 });
    cell.total += 1;
    if (right) cell.right += 1;
  });
  var out = {};
  Object.keys(weeks).forEach(function (week) {
    var n = Object.keys(takers[week]).length;
    if (n < MIN_TAKERS) return;
    weeks[week].takers = n;
    out[week] = weeks[week];
  });
  return { ok: true, minTakers: MIN_TAKERS, weeks: out };
}
