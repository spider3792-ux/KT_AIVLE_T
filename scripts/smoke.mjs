#!/usr/bin/env node
// Browser smoke runner. Zero dependencies: starts scripts/serve.mjs, drives Chrome through the design skill's cdp.mjs.
//   node scripts/smoke.mjs [filter]      run only scenarios whose name contains the filter
// Scenarios: the built-in "skeleton" below, then every scripts/smoke/*.smoke.mjs in alphabetical order
// (default export: async (kit) => {...}; optional named export `name`).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { Browser, sleep } from '../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 8099);
const BASE = `http://127.0.0.1:${PORT}`;
const filter = process.argv[2] || '';

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8').replace(/^﻿/, ''));

async function waitForServer() {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${BASE}/quizzes/index.json`);
      if (res.status === 200) return true;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  return false;
}

function makeKit(browser) {
  const opened = [];
  const index = readJson('quizzes/index.json');
  const kit = {
    BASE,
    browser,
    assert,
    sleep,
    data: {
      index,
      set: readJson(index[0].file),
      members: existsSync(join(root, 'members.json')) ? readJson('members.json').members : [],
    },
    opened,

    // A fresh page at `path` with this origin's localStorage cleared before the page's own scripts run.
    async open(path, { width = 1440, height = 900, mobile = false, reducedMotion = false } = {}) {
      const page = await browser.newPage({ width, height, mobile, reducedMotion });
      opened.push(page);
      await page.goto(`${BASE}/quizzes/index.json`, { settleMs: 50 });
      await page.eval(() => {
        localStorage.clear();
        return true;
      });
      page.href = `${BASE}/${path}`;
      await page.goto(page.href, { settleMs: 400 });
      return page;
    },

    async reload(page) {
      await page.goto(page.href, { settleMs: 400 });
    },

    async waitFor(page, fnOrExpr, { timeout = 6000 } = {}) {
      const until = Date.now() + timeout;
      let last;
      while (Date.now() < until) {
        try {
          last = await page.eval(fnOrExpr);
          if (last) return last;
        } catch (e) {
          last = e.message;
        }
        await sleep(100);
      }
      throw new Error(`timed out waiting for ${String(fnOrExpr).slice(0, 90)} (last: ${String(last).slice(0, 80)})`);
    },

    // mode: 'correct' answers every question right; 'wrong' answers every question wrong.
    async answerAll(page, set, mode) {
      await page.eval(
        ({ questions, mode }) => {
          for (const q of questions) {
            if (q.type === 'choice') {
              const idx = mode === 'correct' ? q.answer : (q.answer + 1) % 4;
              document.querySelector(`input[type="radio"][name="${q.id}"][value="${idx}"]`).click();
            } else {
              const input = document.getElementById(`${q.id}-a`);
              input.value = mode === 'correct' ? ` ${q.answer[0].toUpperCase()} ` : '오답';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          return true;
        },
        { questions: set.questions, mode },
      );
    },

    async submitSheet(page) {
      await page.eval(() => {
        document.querySelector('#submit').click();
        return true;
      });
      await sleep(250);
      const open = await page.eval(() => {
        const d = document.querySelector('dialog#confirm');
        if (d && d.open) {
          d.querySelector('button[value="submit"]').click();
          return true;
        }
        return false;
      });
      if (open) await sleep(250);
    },

    // Checks the home radio, or sets select#sheet-member, whichever this page has.
    async chooseMember(page, name) {
      const ok = await page.eval((name) => {
        const radio = [...document.querySelectorAll('input[type="radio"][name="member"]')].find((r) => r.value === name);
        if (radio) {
          radio.click();
          return 'radio';
        }
        const select = document.querySelector('select#sheet-member');
        if (select) {
          select.value = name;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return 'select';
        }
        return '';
      }, name);
      assert.ok(ok, `no member control found for ${name}`);
    },

    async shot(page, name) {
      if (process.env.SMOKE_SHOTS !== '1') return;
      const dir = join(root, '.taste-skill', 'shots');
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `${name}.jpg`), fullPage: true });
    },
  };
  return kit;
}

// ---------------------------------------------------------------- built-in scenario
async function skeleton(kit) {
  const { assert, data } = kit;
  const { set, members } = data;
  const first = members[0].name;

  // (a) server
  const idxRes = await fetch(`${kit.BASE}/quizzes/index.json`);
  assert.equal(idxRes.status, 200);
  assert.match(idxRes.headers.get('content-type') || '', /application\/json/);
  assert.equal((await fetch(`${kit.BASE}/quizzes/missing.json`)).status, 404);
  const trav = (await fetch(`${kit.BASE}/..%2f..%2fWindows/win.ini`)).status;
  assert.ok(trav === 403 || trav === 404, `traversal answered ${trav}`);

  // (b) desktop sheet, opened directly
  const page = await kit.open('quiz.html');
  await kit.waitFor(page, () => document.querySelectorAll('li.q').length > 0);
  const info = await page.eval(() => ({
    lang: document.documentElement.lang,
    title: document.querySelector('#sheet-title')?.textContent,
    count: document.querySelectorAll('ol#sheet > li.q').length,
  }));
  assert.equal(info.lang, 'ko');
  assert.equal(info.title, set.title);
  assert.equal(info.count, set.questions.length);

  // The full sample week: 10 questions, 7 개념 + 3 코드 분석, three code blocks kept verbatim.
  const shape = await page.eval(() => ({
    total: document.querySelectorAll('li.q').length,
    concept: document.querySelectorAll('li.q[data-kind="concept"]').length,
    code: document.querySelectorAll('li.q[data-kind="code"]').length,
    pres: [...document.querySelectorAll('pre.code')].map((p) => ({ text: p.querySelector('code').textContent, ws: getComputedStyle(p).whiteSpace })),
  }));
  assert.equal(shape.total, 10);
  assert.equal(shape.concept, 7);
  assert.equal(shape.code, 3);
  const codeQs = set.questions.filter((q) => q.code);
  assert.equal(shape.pres.length, 3);
  shape.pres.forEach((p, i) => {
    assert.equal(p.text, codeQs[i].code, `code block ${i + 1} is verbatim`);
    assert.equal(p.ws, 'pre', 'code keeps white-space: pre');
  });

  const codes = await page.eval(() =>
    [...document.querySelectorAll('li.q')].map((li) => ({ id: li.id, code: li.querySelector('pre.code code')?.textContent ?? null })),
  );
  for (const q of set.questions) {
    const got = codes.find((c) => c.id === q.id);
    assert.equal(got.code, q.code ?? null, `code of ${q.id}`);
  }

  await kit.answerAll(page, set, 'correct');
  await kit.submitSheet(page);
  // No name chosen yet: the sheet refuses to grade and asks for the 성명 first.
  const refused = await page.eval(() => ({ score: !!document.querySelector('#score'), status: document.querySelector('#status').textContent }));
  assert.equal(refused.score, false, 'graded without a name');
  assert.ok(refused.status.length > 0, 'status explains the missing name');
  await kit.chooseMember(page, first);
  await kit.submitSheet(page);
  await kit.waitFor(page, () => document.querySelector('#score'));
  const graded = await page.eval(() => ({
    total: document.querySelector('[data-score="total"]')?.textContent,
    results: [...document.querySelectorAll('section.q-result')].map((s) => s.dataset.result),
  }));
  assert.equal(graded.total, String(set.questions.length));
  const parts = await page.eval(() => ({
    total: document.querySelector('[data-score="total"]').textContent,
    concept: document.querySelector('[data-score="concept"]').textContent,
    code: document.querySelector('[data-score="code"]').textContent,
  }));
  assert.deepEqual(parts, { total: '10', concept: '7', code: '3' });
  assert.equal(graded.results.length, set.questions.length);
  assert.ok(graded.results.every((r) => r === 'correct'), 'every result is correct');

  const stored = await page.eval((id) => JSON.parse(localStorage.getItem(`srq:attempt:${id}`)), set.id);
  assert.ok(stored && stored.v === 1, 'attempt stored with v:1');

  await kit.reload(page);
  await kit.waitFor(page, () => document.querySelector('#score'));
  const frozen = await page.eval(() => ({
    enabled: [...document.querySelectorAll('li.q input')].filter((i) => !i.disabled).length,
    submit: !!document.querySelector('#submit'),
  }));
  assert.equal(frozen.enabled, 0, 'no enabled input after reload');
  assert.equal(frozen.submit, false, '#submit gone after reload');
  await kit.shot(page, 'sheet-graded-desktop');

  // (b2) a question id in the address scrolls to it and focuses inside it
  const jump = await kit.open(`quiz.html?set=${set.id}#q9`);
  await kit.waitFor(jump, () => document.querySelector('li#q9') && document.activeElement && document.activeElement.closest('li#q9'));

  // (b3) an id that is not in the index never reaches fetch; the Korean not-found panel shows instead
  const lost = await kit.open('quiz.html?set=2026-W99');
  await kit.waitFor(lost, () => document.querySelector('.error-panel'));
  const lostText = await lost.eval(() => document.querySelector('.error-message').textContent);
  assert.equal(lostText, '이 주차를 찾을 수 없어요.');

  // (c) phone, wrong answers
  const phone = await kit.open('quiz.html', { width: 390, height: 844, mobile: true });
  await kit.waitFor(phone, () => document.querySelectorAll('li.q').length > 0);
  await kit.answerAll(phone, set, 'wrong');
  await kit.chooseMember(phone, first);
  await kit.submitSheet(phone);
  await kit.waitFor(phone, () => document.querySelector('#score'));
  const low = await phone.eval(() => ({
    total: document.querySelector('[data-score="total"]')?.textContent,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.equal(low.total, '0');
  assert.ok(low.scrollWidth <= low.innerWidth, `phone overflow ${low.scrollWidth} > ${low.innerWidth}`);
  await kit.shot(phone, 'sheet-graded-phone');

  // (d) entry page: home -> name -> 풀기 시작 -> sheet with the name filled -> submit
  const home = await kit.open('index.html');
  await kit.waitFor(home, () => document.querySelectorAll('input[name="member"]').length > 0);
  const h = await home.eval(() => ({
    lang: document.documentElement.lang,
    week: document.querySelector('#week-title')?.textContent,
    values: [...document.querySelectorAll('input[name="member"]')].map((i) => i.value),
    path: location.pathname,
  }));
  assert.equal(h.lang, 'ko');
  assert.equal(h.week, data.index[0].title);
  assert.deepEqual(h.values, members.map((m) => m.name));
  await kit.shot(home, 'home-desktop');

  await home.eval(() => {
    document.querySelector('#start').click();
    return true;
  });
  await kit.sleep(300);
  const stay = await home.eval(() => ({ path: location.pathname, hint: document.querySelector('#start-hint').textContent }));
  assert.equal(stay.path, h.path, 'left the home page without a name');
  assert.ok(stay.hint.trim().length > 0, '#start-hint is empty');

  await kit.chooseMember(home, first);
  await home.eval(() => {
    document.querySelector('#start').click();
    return true;
  });
  await kit.waitFor(home, () => location.pathname.endsWith('quiz.html') && document.querySelectorAll('li.q').length > 0);
  const landed = await home.eval(() => ({
    search: location.search,
    member: JSON.parse(localStorage.getItem('srq:member')),
    selected: document.querySelector('select#sheet-member').value,
  }));
  assert.equal(landed.search, `?set=${set.id}`);
  assert.deepEqual(landed.member, { v: 1, name: first });
  assert.equal(landed.selected, first);

  await kit.answerAll(home, set, 'correct');
  await kit.submitSheet(home);
  await kit.waitFor(home, () => document.querySelector('#score'));
  const attempt = await home.eval((id) => JSON.parse(localStorage.getItem(`srq:attempt:${id}`)), set.id);
  assert.equal(attempt.member, first);
}

// ---------------------------------------------------------------- runner
async function main() {
  const server = spawn(process.execPath, [join(root, 'scripts', 'serve.mjs'), String(PORT)], { stdio: ['ignore', 'ignore', 'ignore'] });
  let browser = null;
  let passed = 0;
  let failed = 0;
  try {
    if (!(await waitForServer())) {
      console.log('FAIL server: scripts/serve.mjs did not answer within 5 seconds');
      console.log('SMOKE: 0 passed, 1 failed');
      process.exitCode = 1;
      return;
    }
    browser = await Browser.launch();

    const scenarios = [{ name: 'skeleton', run: skeleton }];
    const dir = join(root, 'scripts', 'smoke');
    if (existsSync(dir)) {
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.smoke.mjs')).sort()) {
        const mod = await import(pathToFileURL(join(dir, f)).href);
        scenarios.push({ name: mod.name || basename(f, '.smoke.mjs'), run: mod.default });
      }
    }

    for (const sc of scenarios) {
      if (filter && !sc.name.includes(filter)) continue;
      const kit = makeKit(browser);
      try {
        await sc.run(kit);
        const errors = kit.opened.flatMap((p) => p.consoleErrors);
        if (errors.length) throw new Error(`uncaught page exception: ${errors[0]}`);
        console.log(`PASS ${sc.name}`);
        passed += 1;
      } catch (e) {
        console.log(`FAIL ${sc.name}: ${String(e && e.message ? e.message : e).split('\n')[0]}`);
        failed += 1;
        if (process.env.SMOKE_VERBOSE) console.log(String(e && e.stack ? e.stack : e));
      } finally {
        for (const p of kit.opened) await p.close();
      }
    }
    console.log(`SMOKE: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
