// Runs apps-script/Code.gs in Node with an in-memory stand-in for the Google services it touches
// (SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities, ContentService).
// Used by tests/apps-script.test.mjs and by `scripts/serve.mjs --fake-sheet` for the browser smoke.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE = new URL('../../apps-script/Code.gs', import.meta.url);

function fakeSheet(name) {
  const values = [];
  return {
    name,
    values,
    appendRow(row) {
      values.push([...row]);
    },
    getDataRange() {
      return { getValues: () => values.map((r) => [...r]) };
    },
    getLastRow() {
      return values.length;
    },
    getRange(row, col, numRows, numCols) {
      return {
        setValues(rows) {
          if (rows.length !== numRows || rows.some((r) => r.length !== numCols)) throw new Error('range size mismatch');
          rows.forEach((r, i) => {
            values[row - 1 + i] = [...r];
          });
        },
      };
    },
  };
}

export function loadAppsScript() {
  const sheets = new Map();
  const props = new Map();
  const cache = new Map();
  const book = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => {
      const s = fakeSheet(n);
      sheets.set(n, s);
      return s;
    },
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, String(v)) }),
    },
    CacheService: {
      getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, String(v)), remove: (k) => cache.delete(k) }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      getUuid: () => randomUUID(),
      computeDigest: (alg, text) => [...createHash(alg).update(text, 'utf8').digest()],
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(CODE, 'utf8'), context, { filename: 'Code.gs' });
  return {
    // body: the object the site sends; returns the parsed JSON reply.
    post(body) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      return JSON.parse(context.doPost({ postData: { contents: raw } }).text);
    },
    get() {
      return JSON.parse(context.doGet().text);
    },
    sheet: (n) => sheets.get(n)?.values ?? null,
    expireLocks: () => cache.clear(),
  };
}
