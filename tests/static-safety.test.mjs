// Durable guard for the browser code. Every later plan keeps this green:
// no HTML-string sinks in js/, no regex lookbehind in the shared grading module (old Safari refuses to parse it),
// and the two pages stay free of inline scripts / inline styles with a CSP and lang="ko".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');

// Removes // and /* */ comments while leaving string, template and regex-free code intact.
// A small state machine, because a plain regex would eat the "//" inside 'https://...'.
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i += 1;
    } else if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') {
          out += src[i];
          i += 1;
        }
        if (i < n) out += src[i];
        i += 1;
      }
      if (i < n) out += quote;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const SINKS = [
  [/\.\s*(innerHTML|outerHTML)\s*(\+|\|\||\?\?)?=(?!=)/, 'assignment to innerHTML / outerHTML'],
  [/\binsertAdjacentHTML\s*\(/, 'insertAdjacentHTML call'],
];
const sinksIn = (code) => SINKS.filter(([re]) => re.test(code)).map(([, label]) => label);
const lookbehindIn = (code) => /\(\?<[=!]/.test(code);

function pageProblems(html) {
  const problems = [];
  if (!/<html\b[^>]*\blang="ko"/i.test(html)) problems.push('html lang="ko" is missing');
  if (!/<meta\b[^>]*http-equiv="Content-Security-Policy"/i.test(html)) problems.push('Content-Security-Policy meta is missing');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/.test(m[1])) problems.push('script element without src');
    if (m[2].trim() !== '') problems.push('script element with an inline body');
  }
  if (/<style\b/i.test(html)) problems.push('style element');
  if (/<[a-z][^>]*\sstyle\s*=/i.test(html)) problems.push('inline style attribute');
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    if (/\btarget\s*=\s*["']?_blank/i.test(m[0]) && !/\brel\s*=\s*["'][^"']*\bnoopener\b/i.test(m[0])) {
      problems.push(`target="_blank" link without rel="noopener": ${m[0]}`);
    }
  }
  return problems;
}

const jsFiles = readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js'));

test('js/ holds at least the shared modules', () => {
  for (const f of ['grade.js', 'storage.js', 'site.js']) assert.ok(jsFiles.includes(f), f);
});

for (const f of jsFiles) {
  test(`js/${f}: no HTML-string sinks`, () => {
    assert.deepEqual(sinksIn(stripComments(read(`js/${f}`))), []);
  });
}

test('js/grade.js: no regex lookbehind', () => {
  assert.equal(lookbehindIn(stripComments(read('js/grade.js'))), false);
});

for (const page of ['index.html', 'quiz.html']) {
  test(`${page}: lang, CSP, external scripts only, no inline style, safe blank-target links`, () => {
    assert.deepEqual(pageProblems(read(page)), []);
  });
}

test('the guard itself catches what it guards against', () => {
  assert.deepEqual(sinksIn(stripComments('el.innerHTML = x;')), ['assignment to innerHTML / outerHTML']);
  assert.deepEqual(sinksIn(stripComments('el.outerHTML += x;')), ['assignment to innerHTML / outerHTML']);
  assert.deepEqual(sinksIn(stripComments('el.insertAdjacentHTML("beforeend", x)')), ['insertAdjacentHTML call']);
  assert.deepEqual(sinksIn(stripComments('if (el.innerHTML === x) {}')), []);
  assert.deepEqual(sinksIn(stripComments('// el.innerHTML = x\n/* el.outerHTML = y */ const a = "https://x.y";')), []);
  assert.equal(lookbehindIn('a.replace(/(?<=x)y/, "")'), true);
  assert.equal(lookbehindIn('a.replace(/(?:x)y/, "")'), false);

  const bad = '<html><head><script>alert(1)</script><script type="module"></script></head><body style="x"><a href="u" target="_blank">x</a></body></html>';
  const problems = pageProblems(bad);
  assert.ok(problems.some((p) => p.includes('lang')));
  assert.ok(problems.some((p) => p.includes('Content-Security-Policy')));
  assert.ok(problems.some((p) => p.includes('inline body')));
  assert.ok(problems.some((p) => p.includes('without src')));
  assert.ok(problems.some((p) => p.includes('inline style')));
  assert.ok(problems.some((p) => p.includes('noopener')));
  const good = '<html lang="ko"><head><meta http-equiv="Content-Security-Policy" content="x"><script type="module" src="a.js"></script></head><body><a href="u" target="_blank" rel="noopener noreferrer">x</a></body></html>';
  assert.deepEqual(pageProblems(good), []);
});
