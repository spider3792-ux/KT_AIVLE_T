# Phase 1: quiz-core (풀이·채점·해설 사이트) - Research

**Researched:** 2026-10-16
**Domain:** Zero-build static site (HTML/CSS/vanilla ES modules) + zero-dependency Node validator, Korean-language quiz grading, localStorage persistence, design-taste-frontend gate
**Confidence:** HIGH (toolchain, grading spec, lint/inspector traps were all executed in this session); MEDIUM (font payload, Pages caching, fallback-font availability)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied from `01-CONTEXT.md` `<decisions>` and `<design>`; executor and planner MUST honor.)

**Stack**
- Plain HTML + CSS + vanilla JS (ES modules OK), **no bundler, no framework, no npm runtime deps for the site**. Must work when served by GitHub Pages from the repo root (relative paths only).
- Validator: a Node script (`scripts/validate-quiz.mjs`, Node 22+, zero dependencies) - `node scripts/validate-quiz.mjs quizzes/<week>.json [--sources <sources.json>]`, exits non-zero with human-readable Korean messages per error.
- Local preview: any static server (e.g. `npx --yes serve .` or a tiny `scripts/serve.mjs`). Opening `index.html` via file:// is not required to work (fetch of JSON needs http).

**Data format**
- `quizzes/index.json`: list of weeks `{ id: "2026-W42", title, published: "2026-10-16", file: "quizzes/2026-W42.json" }`, newest first; the site treats the first as "이번 주".
- `quizzes/<id>.json` (one set): `{ id, title, range: {from, to}, estimatedMinutes, sources: [{ id, author, date, title, subject }], questions: [10] }`.
- Question: `{ id: "q1", kind: "concept" | "code", type: "choice" | "short", prompt, code?: string (verbatim, only for kind=code), choices?: [4 strings], answer: index (choice) | string[] accepted answers (short), explanation: string (≤5 lines), concept: { name, ref } (e.g. {name:"groupby", ref:"pandas 공식 문서 · GroupBy"}), sourceIds: [source id] | file?: string }`.
- Exactly 10 questions: 7 `concept` + 3 `code`. Types: only `choice` and `short` (NO essay / self-grading - user decision).
- Source label shown to users is built by the site from `sources[]` as `"{author} · {M/D}"` (e.g. "이주현 · 10/14") - never stored as free text in a question.
- `members.json`: the 6 member display names for the name picker (placeholder names until the user confirms; calendar screenshot shows 김준수, 송지…, 노아…, 이주현, 차승환, 정보경… - confirm full names with user).

**Grading**
- choice: selected index === answer.
- short: normalize both sides - trim, collapse internal whitespace, remove all spaces for comparison, lowercase, NFKC (full-width → half-width) - then match against any accepted answer.
- Score: total /10 plus 개념 /7 and 코드 분석 /3.

**Attempt storage (localStorage)**
- Key namespace `srq:` . Draft answers autosave per set (`srq:draft:<setId>`), first submitted attempt frozen (`srq:attempt:<setId>` = { member, answers, results, submittedAt }). Chosen member in `srq:member`.
- After submit, reopening the set shows the frozen result (retry behaviour comes in Phase 4).
- All localStorage access wrapped in try/catch; page still works (without persistence) if storage is unavailable.

**Sample content**
- Ship one realistic sample set `quizzes/2026-W42.json` modelled on the Notion template (핵심 개념 / 내 말로 설명 / 직접 작성한 코드 / 어려웠던 내용·막힌 이유 / 해결 방법) for a data-analysis study (Python, Pandas, 데이터 시각화, 데이터 분석, 머신러닝), dated 2026-10-13..10-16, with 7 concept + 3 code questions, Korean, realistic distractors drawn from "막힌 이유". Mark clearly in README that it is sample data.
- Also ship 2-3 deliberately broken fixture sets under `tests/fixtures/` that the validator must reject (wrong count, 3 choices, answer out of range, unknown sourceId, explanation > 5 lines).

**Language**
- All UI copy, questions, explanations in Korean (DSGN-02). `<html lang="ko">`.

**Design Direction (LOCKED) - design-taste-frontend**
- The user explicitly asked that every screen be made with the `design-taste-frontend` skill. Executors building any UI MUST invoke the `design-taste-frontend` skill (Skill tool) before writing markup/CSS, follow its house rules, and run its gate before finishing: `node .claude/skills/design-taste-frontend/scripts/lint.mjs <site files>` and `node .claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:<port>/`. Fix every FAIL; screenshots at 1440/768/390 land in `.taste-skill/inspect/` and must be looked at (critique per `references/critique.md`). Reprint the sheet with `node .claude/skills/design-taste-frontend/scripts/draw.mjs --show`.
- Direction: "The page is the object" (seed 990815287). Hero blueprint: *Tabbed folder stack*. Palette: *Frost and slate*. Sections: list (Giant word, filled bar rows) → how-it-works (Itinerary on a slip) → work (Book-spine index) → footer (The back of the card). Signature motion: *Index with preview*.
- Idea sentence: On this page, this week's six members' Notion review entries (the folders of 개인 복습 기록) become a stack of tabbed file folders - each back folder's tab carries a member's name, and the open front folder is this week's 시험지 (exam sheet). Live thing: the exam sheet itself (graded in place; margin marks; answer + explanation + source above each question); on the home page pointing at / tapping a member's folder tab previews which entries (title · date · subject) the questions came from.
- Type: Noto Serif KR (Google Fonts, weights 400/500/600) in Literata's role: display weight 500, tracking -0.02em, leading 1.05; text 400, leading 1.6. One family only. `<pre><code>` is the only place monospace is allowed (system mono stack). Steps: `--step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)`, `--step-body: clamp(1.125rem, 1.05rem + 0.3vw, 1.3125rem)`, `--step-lead: clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)`, `--step-head: clamp(2rem, 1.3rem + 3.2vw, 4rem)`; hero display `clamp(96px, 10vw, 160px)` for a ≤12-char Korean line e.g. "이번 주 시험지".
- Colour (Frost and slate): `--bg:#f7f9fa; --surface:#ecf0f2; --ink:#1f3038; --muted:#5d6b72; --accent:#0d7480; --accent-ink:#ffffff`. Hero ground dark (`--ink`); accent (teal) once per screen: the primary action. Correct/incorrect marks: ink and accent with a shape difference (filled circle vs. slash), no new red.
- Composition per screen: Home (index.html), Quiz (exam sheet), Result (same sheet graded in place) - see CONTEXT.md `<design>` for the full text (home: slim top row, one-line headline, folder stack from ~51% height, list section as `<details>` bar rows, itinerary slip, footer as back of the card; quiz: tall paper panel with notched/perforated edge, real `<ol>`, `<pre><code>`, thumb-sized radios, text input, submit block with blank-count dialog; result: score summary at top + result block above each question).
- Imagery: floor of ≥4 real pictures (inspector checks), found via `assets.mjs`, downloaded with `--get`, credited in the footer; if network fails draw in code and say so.
- House rules (inspector-enforced): headlines ≤2 lines at every width; no eyebrows/pill badges; no monospace outside code; no 01/02/03 numbering; no thin rules/1px boxes; no gradients; no shadows at rest; no glass; no emoji; no icon cards / identical card rows; ≤2 typefaces; running text in full ink ≥16px; one button shape and one radius for the whole site; motion layer (≥8 moving elements, reduced-motion fallback) per SKILL.md step 9.

### Claude's Discretion

CONTEXT.md has no explicit "Claude's Discretion" section. Items it leaves open ("any static server", "e.g." examples, sourceIds-or-file shape, `--sources` file format, fixture contents beyond the five named, file/module layout, number of HTML pages, test tooling) are discretion; this document recommends concrete choices for each.

### Deferred Ideas (OUT OF SCOPE)

- 지난 주차 list, 내가 틀린 문제 tab, retry → Phase 4
- 결과 보내기 (Google Form), 6명 중 N명 정답, 전체 정답률 낮은 문제 → Phase 5
- GitHub Pages deploy, README weekly routine → Phase 3
- Generation skill → Phase 2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FMT-01 | A week's set is one JSON file with week, range, sources, 10 questions | Data format (CONTEXT) + validator top-level checks; sample set guidance |
| FMT-02 | Each question is choice (4 choices, 1 answer) or short (accepted answers) | Validator rules table; grading spec `normalizeAnswer` |
| FMT-03 | Each question has kind, prompt, code, answer, ≤5-line explanation, concept source, Notion source or file name | Validator required-field rules; `sourceIds`-or-`file` recommendation |
| FMT-04 | Validator checks 10 / 7+3 / 4 unique choices / answer range / accepted ≥1 / ≤5 lines / source exists / code equals input | `scripts/lib/validate-core.mjs` rule table, `--sources` record format, fixtures + `node --test` |
| FMT-05 | Site reads the week-list file to find this week and past weeks | `ROOT`-relative `getJson('quizzes/index.json')`, index validation mode |
| QUIZ-01 | Open link, no login, pick name once (6 names) | `members.json`, `srq:member`, home picker |
| QUIZ-02 | 10 questions in one flow; code readable (mono, whitespace kept) | `<ol>` markup, `<pre><code>` via `textContent`, a11y patterns |
| QUIZ-03 | Draft answers autosaved, resume after closing | `storage.js` factory, debounce + flush, sanitize-on-read |
| QUIZ-04 | Blank-count confirmation, first attempt frozen | `<dialog>` flow, `srq:attempt:<setId>` frozen shape |
| QUIZ-05 | Mobile browser end-to-end | 390px viewport checks, 44px+ targets, IME/keyboard attrs |
| RSLT-01 | Instant grading: choice by index, short by normalized match | Verified `normalizeAnswer` spec (26 cases, 0 mismatches) |
| RSLT-02 | Right/wrong + answer above each question | Result block above `fieldset`, shape-plus-text marks |
| RSLT-03 | ≤5-line explanation shown | `explanationLines()`, validator line rule |
| RSLT-04 | Concept source + Notion source ("작성자 · 날짜") or file name shown | `sourceLabel()` built from `sources[]` |
| RSLT-05 | Total and 개념/코드 분석 scores | `gradeSet()` → `{total, concept, code}` |
| DSGN-01 | design-taste-frontend look on all screens | Gate commands verified on this machine; trap list; quiz.html gate policy |
| DSGN-02 | All screens Korean | `<html lang="ko">`, validator Hangul presence warning, smoke check |
</phase_requirements>

## Summary

This phase is a small static project with one real engineering core (a pure grading/normalization module shared by browser, validator and tests) and one real risk (the design-taste-frontend gate, which is strict and was measured in this session). The whole toolchain was exercised end to end on this Windows 11 / Node v25.7.0 machine: a throwaway static server, a module-script page that fetches JSON and opens a `<dialog>`, `agent-browser` driving it (viewport, localStorage, reduced-motion), `inspect.mjs` running against it, `assets.mjs` reaching the network, and `node --test` discovering tests. Everything works; the traps found are listed in Common Pitfalls and are the most valuable part of this document.

Recommended shape: two HTML pages (`index.html` home, `quiz.html?set=<id>` exam sheet that grades in place), five small ES modules (`grade.js` pure and shared, `storage.js` as an injectable factory, `data.js` with a module-relative `ROOT`, `render.js` DOM builders that only use `textContent`, page controllers), a root `package.json` with `"type": "module"` and no dependencies, `scripts/serve.mjs` (verified 25-line server) and `scripts/validate-quiz.mjs` as a thin CLI over `scripts/lib/validate-core.mjs`. Tests use the built-in `node:test`; browser behaviour is checked with a small CDP smoke script that reuses the design skill's zero-dependency `cdp.mjs`, plus `agent-browser` for screenshots and accessibility snapshots.

The short-answer normalizer is specified and proven below (NFKC, strip invisible characters, lowercase, remove all whitespace, drop empty `()` pairs, drop `_`/middle-dot style separators only between word characters, drop trailing sentence punctuation). It deliberately does NOT strip `-` or `.` so that `-1` vs `1` and `df.groupby` vs `groupby` stay distinct; authors list such variants in the accepted-answers array and the validator normalizes accepted answers too.

**Primary recommendation:** Build `js/grade.js` + `scripts/lib/validate-core.mjs` first with `node --test` fixtures (pure, fast, covers FMT-01..05 and RSLT-01..05), then the two pages; run `lint.mjs` early and often because several of its regexes reject things a normal developer would write (check marks as characters, `--font-mono`, `'01'` strings).

## Project Constraints (from ./.claude/CLAUDE.md)

- Static website: no server, DB, login, AI API; cost 0 won. [VERIFIED: .claude/CLAUDE.md lines 7, 15]
- Hosting: GitHub Pages, build-free HTML/CSS/JS preferred so a non-developer can maintain. [VERIFIED: .claude/CLAUDE.md line 16]
- Storage: personal results in browser localStorage. [VERIFIED: .claude/CLAUDE.md line 17]
- Design: design-taste-frontend standard applied to first screen and whole art direction; quiz/result screens follow the same direction. [VERIFIED: .claude/CLAUDE.md line 18]
- Language: UI, questions and explanations all Korean; mobile browser must work. [VERIFIED: .claude/CLAUDE.md line 19]
- GSD workflow enforcement: file edits only inside a GSD command (`/gsd-execute-phase` for planned phase work); do not edit the repo directly outside a GSD workflow. [VERIFIED: .claude/CLAUDE.md lines 61-71]
- `.planning/config.json`: `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`, `commit_docs: true`. [VERIFIED: .planning/config.json]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render home / exam sheet / graded result | Browser / Client | - | No server; DOM built from fetched JSON |
| Short-answer and choice grading | Browser / Client (pure module `grade.js`) | Node (same module imported by validator + tests) | Answers are in static JSON (accepted trust model); one source of truth for normalization |
| Draft/attempt/member persistence | Browser / Client (localStorage) | In-memory fallback | Locked decision; per-browser only |
| Serving quiz JSON, HTML, assets | CDN / Static (GitHub Pages; `scripts/serve.mjs` locally) | - | Static hosting, relative paths |
| Weekly index and set files (data) | CDN / Static | Authoring-time Node CLI | Files in repo, read-only at runtime |
| Set/index validation | Authoring-time Node CLI (`validate-quiz.mjs`) | `node --test` | Never runs in the browser |
| Web font delivery | Third-party CDN (Google Fonts) | System serif fallback | Locked: Noto Serif KR from Google Fonts |
| Design gate (lint + inspector + screenshots) | Local dev tooling | agent-browser | Skill-provided scripts, run manually/in verification |

## Standard Stack

### Core

No external packages. Everything is a platform API or a Node built-in.

| Piece | Version | Purpose | Why Standard |
|-------|---------|---------|--------------|
| HTML / CSS / ES modules (`<script type="module">`) | browser platform | The site | Locked: no bundler, no framework |
| `fetch`, `URL`, `import.meta.url` | platform | JSON loading, module-relative root | Works unchanged on Pages project sub-path |
| `localStorage` (+ in-memory fallback) | platform | Draft / attempt / member | Locked |
| `<dialog>` + `showModal()` | Baseline widely available since March 2022 [CITED: developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog] | Submit confirmation | Built-in focus containment, Esc, `::backdrop` |
| `node:test` + `node:assert/strict` | Node v25.7.0 here; Node 22+ required | Unit + CLI tests | Zero-dependency runner [VERIFIED: ran `node --test` in scratch project this session] |
| `node:http` / `node:fs` | Node built-in | `scripts/serve.mjs` | 25 lines, verified (below) |
| `node:child_process` (`spawnSync`) | Node built-in | CLI fixture tests | Asserts exit code + Korean message |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| design-taste-frontend `lint.mjs` / `inspect.mjs` / `assets.mjs` / `draw.mjs` | skill v2 in `.claude/skills/` | Design gate, pictures | Every UI task; phase gate [VERIFIED: ran lint/inspect/assets/draw this session] |
| design skill `scripts/lib/cdp.mjs` | same | Zero-dependency CDP client for the smoke script (`Browser.launch`, `page.eval`, `setViewport`, `screenshot`, `reducedMotion`) | `scripts/smoke.mjs` [VERIFIED: read cdp.mjs] |
| `agent-browser` | 0.39.1 (global), own Chrome 155 at `C:\Users\User\.agent-browser\browsers\chrome-155.0.8059.84\chrome.exe` | Screenshots at 390/1440, `snapshot -i` accessibility tree, `storage local`, `set media light reduced-motion` | Verification, visual review [VERIFIED: ran `doctor`, `open`, `eval`, `storage local set`, `reload`, `screenshot`] |
| design skill `assets/base.css` + `assets/base.js` | same | Neutral foundation incl. `data-rise` / `data-reveal` entrance helpers with `.js` guard and reduced-motion media query | Optional start for tokens + motion [VERIFIED: read both files] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `scripts/serve.mjs` | `npx --yes serve .` | Needs network + install each run, and `serve` rewrites clean URLs (`/quiz` → `/quiz.html`), which hides link mistakes that break on Pages. Not chosen. [ASSUMED: serve's cleanUrls default] |
| `scripts/smoke.mjs` over skill's `cdp.mjs` | agent-browser shell scripts | agent-browser is better for screenshots/a11y snapshots; the CDP script is better for assertions in CI-like runs and has no Windows pipe problem (Pitfall 1). Use both. |
| Mutation-based validator tests only | Static fixtures only | CONTEXT requires static broken fixtures (also demoable via CLI). Ship 5 static fixtures AND mutate the valid sample in unit tests for the long tail. |
| Single-page hash router | Two pages | Two pages = no router code, each page inspectable by path, simpler Pages behaviour. Recommended. |

**Installation:** none. `package.json` is added only for `"type": "module"` and scripts:

```json
{
  "name": "study-review-quiz",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "serve": "node scripts/serve.mjs",
    "test": "node --test \"tests/**/*.test.mjs\"",
    "validate": "node scripts/validate-quiz.mjs quizzes/index.json && node scripts/validate-quiz.mjs quizzes/2026-W42.json",
    "lint:design": "node .claude/skills/design-taste-frontend/scripts/lint.mjs .",
    "check": "npm test && npm run validate && npm run lint:design"
  }
}
```

Why `"type": "module"`: Node treats `.js` as CommonJS unless told otherwise; on Node 25 module syntax detection made a bare `export` in `js/norm.js` work without a package.json in a scratch test [VERIFIED: scratch run this session], but Node 22.0-22.6 users would fail, so declare it explicitly. GitHub Pages ignores `package.json`.

**Version verification:** no registry packages; versions above are of the tools installed on this machine (`node --version` v25.7.0, `npm --version` 11.10.1, `agent-browser --version` 0.39.1). [VERIFIED: shell]

## Package Legitimacy Audit

No external packages are installed by this phase (site has none by decision; validator, server and tests use Node built-ins). `gsd-tools query package-legitimacy check` is therefore not applicable.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Not recommended:** `npx --yes serve` (runtime download of an unpinned package on every run; unnecessary given the 25-line server below).
Runtime third-party resource (not a package): Google Fonts CSS + font files (`fonts.googleapis.com`, `fonts.gstatic.com`), locked by CONTEXT.

## Architecture Patterns

### System Architecture Diagram

```
 authoring time (Node, Windows)                         runtime (visitor's browser)
 ──────────────────────────────                         ───────────────────────────
 quizzes/<id>.json ──┐                                  index.html ──(module)── home.js
 quizzes/index.json ─┤  scripts/validate-quiz.mjs          │  getJson('quizzes/index.json')  ─┐
 members.json ───────┤    └─ scripts/lib/validate-core.mjs │  getJson(newest.file)            ├─ ROOT = new URL('../', import.meta.url)
 [--sources file] ───┘         │ imports                    │  getJson('members.json')        ─┘
                               ▼                            │  member picker ──► store.set('member')
                         js/grade.js  ◄──── imported by ────┤                    └─► location → quiz.html?set=<id>
                         (pure: normalize,                  ▼
                          gradeQuestion, gradeSet,     quiz.html ──(module)── quiz.js
                          sourceLabel, explanationLines)     │ store.get('attempt:<id>') ?
                               ▲                             │   yes ─► render graded sheet (frozen results)
                               │                             │   no  ─► render blank sheet + draft restore (sanitize)
 tests/*.test.mjs ─────────────┘                             │ input/change ─► debounce ─► store.set('draft:<id>')
 (node --test)                                               │ 제출 click ─► count blanks ─► <dialog> confirm
                                                             │   submit ─► gradeSet() ─► store.set('attempt:<id>'), remove draft
 scripts/serve.mjs (127.0.0.1) ◄── dev / inspect.mjs         │           ─► re-render in place, focus score heading
 GitHub Pages (Phase 3) ◄── same files, relative URLs        └ storage unavailable ─► in-memory Map, banner "저장 안 됨"
```

### Recommended Project Structure

```
/                         (repo root = Pages root)
├── index.html            home: folder stack, name picker, list/slip/spines/footer
├── quiz.html             exam sheet (?set=2026-W42, default = newest in index.json)
├── members.json          { "members": ["김준수", ...6 names] }
├── package.json          type=module, scripts only, NO dependencies
├── css/
│   ├── site.css          tokens + base + type + controls (one radius, one button)
│   ├── home.css          folder stack, bars, slip, spines, footer
│   └── sheet.css         paper panel, questions, result blocks, dialog
├── js/
│   ├── boot.js           classic script: adds .js class (keeps inline script out; CSP-friendly)
│   ├── grade.js          PURE shared module (browser + Node)
│   ├── storage.js        createStore(backendFactory) - injectable for tests
│   ├── data.js           ROOT, getJson()
│   ├── render.js         DOM builders (createElement + textContent only)
│   ├── home.js  quiz.js  page controllers
│   └── motion.js         reveal + index-with-preview (reduced-motion aware)
├── assets/               downloaded archival pictures + credits file (assets.mjs --get)
├── quizzes/              index.json, 2026-W42.json   (SAMPLE DATA - say so in README)
├── scripts/
│   ├── serve.mjs         dev server
│   ├── validate-quiz.mjs thin CLI
│   ├── lib/validate-core.mjs   validateSet(), validateIndex() - pure, exported
│   └── smoke.mjs         CDP browser smoke (optional but recommended)
└── tests/
    ├── grade.test.mjs  storage.test.mjs  validate.test.mjs  cli.test.mjs
    └── fixtures/         valid + broken sets, sources.json
```

Keep tests in `tests/`, never a directory literally named `test/` (Node's default discovery would execute every file inside it). [CITED: nodejs.org test runner docs, discovery rules; behaviour VERIFIED for `tests/` this session]

### Pattern 1: Pure shared grading module (verified)

**What:** One ES module with no DOM and no storage, imported by `quiz.js`, `validate-core.mjs`, and tests.
**When to use:** all grading, normalization, scoring, source labels, explanation line counting.
**Example:** (this exact normalizer was executed against 26 cases with 0 mismatches; code points are listed numerically so no invisible characters live in the source)

```js
// js/grade.js
const chars = (...cps) => cps.map((c) => String.fromCodePoint(c)).join('');
const span = (a, b) => `${chars(a)}-${chars(b)}`;

// soft hyphen, zero-width + bidi marks, bidi embeddings, word joiner..invisible operators, BOM
const INVISIBLE = new RegExp(`[${chars(0xAD)}${span(0x200B, 0x200F)}${span(0x202A, 0x202E)}${span(0x2060, 0x2064)}${chars(0xFEFF)}]`, 'g');
// separators people type inside terms: _  middle dot  araea (raw U+318D, post-NFKC U+119E)  hyphenation point  katakana middle dot  bullet operator  bullet
const SEP = chars(0x5F, 0xB7, 0x119E, 0x318D, 0x2027, 0x30FB, 0x2219, 0x2022);
// NO lookbehind (Safari < 16.4 throws SyntaxError at module parse time): capture the left char instead
const SEPARATORS = new RegExp(String.raw`([\p{L}\p{N}])[${SEP}]+(?=[\p{L}\p{N}])`, 'gu');

export function normalizeAnswer(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')            // full-width -> half-width, composes decomposed Hangul, compat forms
    .replace(INVISIBLE, '')
    .toLowerCase()                // locale-independent on purpose (NOT toLocaleLowerCase: Turkish I)
    .replace(/\s+/g, '')          // every space kind (NBSP, ideographic space already folded by NFKC)
    .replace(/\(\)/g, '')         // groupby() == groupby ; isna().sum() -> isna.sum
    .replace(SEPARATORS, '$1')    // train_test_split == traintestsplit ; 결측치·처리 == 결측치처리
    .replace(/[.!?]+$/, '');      // trailing sentence punctuation only
}

export const isBlank = (q, given) =>
  q.type === 'choice' ? !Number.isInteger(given) : normalizeAnswer(given) === '';

export function gradeQuestion(q, given) {
  if (isBlank(q, given)) return { correct: false, blank: true };
  if (q.type === 'choice') return { correct: given === q.answer, blank: false };
  const g = normalizeAnswer(given);
  return { correct: q.answer.some((a) => normalizeAnswer(a) === g), blank: false };
}

export function gradeSet(set, answers) {
  const results = {}; const score = { total: 0, concept: 0, code: 0 };
  for (const q of set.questions) {
    const r = gradeQuestion(q, answers[q.id]);
    results[q.id] = r;
    if (r.correct) { score.total++; score[q.kind === 'code' ? 'code' : 'concept']++; }
  }
  return { results, score, max: { total: 10, concept: 7, code: 3 } };
}

export const sourceLabel = (s) => { const [, m, d] = s.date.split('-'); return `${s.author} · ${Number(m)}/${Number(d)}`; }; // no padStart: lint WARN
export const explanationLines = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
```

Verified behaviour of `normalizeAnswer` (all pass): `GroupBy`, full-width `ＧｒｏｕｐＢｙ`, ` group by `, `groupby()`, full-width `groupby（）` → `groupby`; `df.groupby()` → `df.groupby`; `train_test_split` and `train test split` → `traintestsplit`; `결측치·처리`, `결측치ㆍ처리`, `결측치 처리.` → `결측치처리`; decomposed Hangul jamo → `한글`; `한<U+200B>글` → `한글`; full-width `１２３` → `123`; NBSP / U+3000 inside words removed; `I` → `i`; `-1` stays `-1` and differs from `1`; `0.5` untouched; `_x` and `x_` untouched; whitespace-only → empty string. [VERIFIED: node run of 26-case table this session]

### Pattern 2: Injectable storage store (degrades, never throws)

```js
// js/storage.js - keys are namespaced "srq:" ; values carry a schema version {v:1,...}
const NS = 'srq:'; const V = 1;

export function createStore(backendFactory = () => window.localStorage) {
  const memory = new Map();
  let backend = null;
  try {                                   // reading window.localStorage itself can throw SecurityError
    const b = backendFactory();
    b.setItem(NS + 'probe', '1');         // zero-quota private modes throw QuotaExceededError here
    b.removeItem(NS + 'probe');
    backend = b;
  } catch { backend = null; }

  return {
    get persistent() { return backend !== null; },
    get(key) {
      let raw = memory.get(key) ?? null;
      try { if (backend) raw = backend.getItem(NS + key) ?? raw; } catch { /* keep memory copy */ }
      if (raw == null) return null;
      try { const o = JSON.parse(raw); return o && o.v === V ? o : null; } catch { return null; }
    },
    set(key, value) {
      const raw = JSON.stringify({ v: V, ...value });
      memory.set(key, raw);               // session keeps working even when disk write fails
      if (!backend) return false;
      try { backend.setItem(NS + key, raw); return true; } catch { backend = null; return false; }
    },
    remove(key) { memory.delete(key); try { backend?.removeItem(NS + key); } catch { /* ignore */ } },
    keys(prefix) {                        // Phase 4: store.keys('attempt:') lists every frozen attempt
      const out = new Set([...memory.keys()].filter((k) => k.startsWith(prefix)));
      try { for (let i = 0; backend && i < backend.length; i++) { const k = backend.key(i); if (k?.startsWith(NS + prefix)) out.add(k.slice(NS.length)); } } catch { /* ignore */ }
      return [...out];
    },
  };
}
```

MDN confirms the failure modes: private browsing may return a `localStorage` with zero quota, and storage can be disabled while the global still exists, so existence checks are not enough; a `QuotaExceededError` on write is the signal. [CITED: developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API] When `store.persistent` is false, show a Korean notice ("이 브라우저에서는 답이 저장되지 않아요. 창을 닫으면 사라져요.").

Stored shapes (keys exactly as locked in CONTEXT; `v` added inside the value so key names stay as decided):

```json
// srq:member
{ "v": 1, "name": "이주현" }
// srq:draft:2026-W42   (deleted on submit)
{ "v": 1, "member": "이주현", "answers": { "q1": 2, "q3": "isna().sum()" }, "updatedAt": "2026-10-16T09:01:12.000Z" }
// srq:attempt:2026-W42 (written once, never overwritten in Phase 1)
{ "v": 1, "setId": "2026-W42", "member": "이주현", "submittedAt": "2026-10-16T09:12:44.000Z",
  "answers": { "q1": 2, "q3": "isna().sum()" },
  "results": { "q1": { "correct": true, "blank": false }, "q2": { "correct": false, "blank": true } },
  "score": { "total": 7, "concept": 5, "code": 2 } }
```

Key by question `id` (not array index) and store per-question `results` so Phase 4 can list wrong answers across weeks (`store.keys('attempt:')`) and Phase 5 can prefill a form without re-grading. Treat stored data as untrusted on read: drop unknown ids, accept only integer 0..3 for choice and string ≤ 200 chars for short.

### Pattern 3: Module-relative root and robust fetch

```js
// js/data.js
export const ROOT = new URL('../', import.meta.url);   // site root, independent of which HTML page imported us
export async function getJson(path) {                   // path is root-relative, e.g. "quizzes/index.json"
  const res = await fetch(new URL(path, ROOT), { cache: 'no-cache' });  // revalidate; Pages caches ~10 min [ASSUMED]
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);          // a Pages 404 returns an HTML page - never .json() it blindly
  return res.json();                                    // fetch's UTF-8 decode strips a BOM
}
```

`index.json` `file` values (`"quizzes/2026-W42.json"`) are root-relative; resolve them against `ROOT`, not against the index file's URL. Plain `fetch('quizzes/x.json')` resolves against the document URL and breaks the moment a page lives in a sub-folder.

### Pattern 4: Submit confirmation with `<dialog>`

```html
<dialog id="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
  <form method="dialog">
    <h2 id="confirm-title">제출할까요?</h2>
    <p id="confirm-desc">비어 있는 문항이 <span id="blank-count">0</span>개 있어요. 제출하면 첫 시도 답이 고정돼요.</p>
    <button value="cancel" autofocus>돌아가서 마저 풀기</button>
    <button value="submit">제출하기</button>
  </form>
</dialog>
```
```js
const dlg = document.querySelector('#confirm');
submitBtn.addEventListener('click', () => {
  blankCount.textContent = String(countBlanks());
  dlg.returnValue = '';                       // reset: returnValue persists between openings (stale 'submit' would auto-submit)
  dlg.addEventListener('close', () => { if (dlg.returnValue === 'submit') doSubmit(); }, { once: true });
  dlg.showModal();                            // focus moves inside, page behind is inert, Esc closes with '' (= cancel)
});
```
`showModal()` makes the rest of the page inert, Esc dismisses, `::backdrop` is styleable, `<form method="dialog">` closes it and sets `returnValue` to the pressed button's value; put `autofocus` on the least destructive control. [CITED: developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog] Do not use `window.confirm()`: the design skill's CDP client auto-dismisses JS dialogs, so it also cannot be tested. A modal dialog is one of the two things house rules allow a shadow on (it truly floats); keep `::backdrop` a flat colour, no `backdrop-filter`.

After grading: re-render in place, move focus to the score heading and announce:
```js
const h = document.querySelector('#score-heading');
h.tabIndex = -1; h.focus({ preventScroll: true });
h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
statusRegion.textContent = `채점이 끝났어요. 10문제 중 ${score.total}문제 정답이에요.`;   // <p role="status">, short text only
```

### Pattern 5: Accessible question markup

```html
<ol class="sheet" id="sheet">
  <li id="q1" class="q" data-kind="concept">
    <div class="q-body">                                   <!-- grid lives on this inner wrapper -->
      <section class="q-result" aria-label="1번 문제 채점 결과" hidden>…정답/오답, 정답, 해설, 출처…</section>
      <fieldset aria-describedby="q1-result">
        <legend>groupby만 쓰고 출력하면 무엇이 나오나요?</legend>   <!-- short prompt only -->
        <label class="opt"><input type="radio" name="q1" value="0"><span>…</span></label> <!-- x4 -->
      </fieldset>
    </div>
  </li>
  <li id="q8" class="q" data-kind="code">
    <div class="q-body">
      <pre id="q8-code" tabindex="0" aria-label="코드"><code></code></pre>   <!-- code.textContent = q.code -->
      <fieldset aria-describedby="q8-code">…</fieldset>
    </div>
  </li>
  <li id="q3" class="q"><div class="q-body">
      <label for="q3-a" id="q3-p">결측치 개수를 열별로 세는 메서드 체인은?</label>
      <input id="q3-a" name="q3" type="text" maxlength="100" autocomplete="off" autocapitalize="none"
             autocorrect="off" spellcheck="false" enterkeyhint="next"></div></li>
</ol>
```
Rules: choice → `fieldset`/`legend` + native radios in labels (whole label is the 44px+ target); short → real `<label for>`; long code goes in a focusable `<pre>` (scrollable regions must be keyboard reachable), referenced with `aria-describedby`, not inside `<legend>`. Question prompts are `legend`/`label`, NOT `h1-h6` (the inspector's two-line headline rule applies to headings). Result status is text plus a shape (filled circle for correct, slash for wrong, drawn with CSS) so it never relies on colour alone. Keep the numbers native: leave `<li>` as `display: list-item` and style `li::marker` (allowed properties include font-*, color, content, counter-*, white-space; applies only to `display: list-item`) [CITED: developer.mozilla.org/en-US/docs/Web/CSS/::marker]; put any grid on the inner `.q-body`. Do not set `list-style: none` (Safari drops list semantics) [ASSUMED]; if a custom number is unavoidable use `counter-increment` + `::before` and `role="list"`.

### Pattern 6: Zero-dependency dev server (verified)

```js
#!/usr/bin/env node
// scripts/serve.mjs - node scripts/serve.mjs [port]   (127.0.0.1 only)
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };

createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = resolve(join(root, normalize(pathname)));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end('forbidden'); }
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('404'); }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
```
Executed this session: JSON served `200 application/json; charset=utf-8`, missing file `404`, `..%2f..%2fWindows/win.ini` `404`; a module page fetching JSON and opening a `<dialog>` ran correctly in agent-browser. [VERIFIED: scratch run]

### Pattern 7: Validator = thin CLI over a pure core

`scripts/validate-quiz.mjs` parses args, reads files (strip a leading BOM, `\uFEFF`, before `JSON.parse`), calls `validateSet(set, ctx)` / `validateIndex(index, ctx)` from `scripts/lib/validate-core.mjs`, prints errors to stderr and exits. No `import.meta.main` detection needed (core and CLI are separate files; `import.meta.main` availability on Node 22 is not guaranteed [ASSUMED]).

- Exit codes: `0` ok (summary on stdout), `1` validation errors, `2` usage / unreadable file / invalid JSON.
- Output: one line per problem, Korean, with a JSON-path prefix: `questions[3] (q4): 객관식 보기는 4개여야 합니다 (현재 3개)`. Collect all errors, don't stop at the first. `ERROR` fails the run; `WARN` prints but exits 0 (unless `--strict`).
- Mode is chosen by basename: `index.json` → `validateIndex`; anything else → `validateSet`.

| Rule (ERROR unless noted) | Req | Static fixture |
|---|---|---|
| Top-level keys `id,title,range{from,to},estimatedMinutes,sources,questions` present; `id` matches `^\d{4}-W\d{2}$` and equals file basename; dates are real calendar dates (`YYYY-MM-DD`, round-trip through `Date`); `range.from <= to`; `estimatedMinutes` positive integer (WARN outside 10..20) | FMT-01 | `bad-header.json` (optional) |
| `questions.length === 10` | FMT-04 | `wrong-count.json` (9 questions) |
| 7 `concept` + 3 `code` (report actual counts) | FMT-04 | mutation test |
| Question ids unique and match `^q([1-9]|10)$` | FMT-01 | mutation |
| `type` ∈ {choice, short}; `kind` ∈ {concept, code}; no other values | FMT-02 | mutation |
| choice: exactly 4 non-empty string `choices`, no duplicates (compare trimmed + `normalizeAnswer`), `answer` integer 0..3 | FMT-02/04 | `three-choices.json`, `answer-out-of-range.json`, mutation (duplicates) |
| short: `answer` is a non-empty array of non-empty strings; none normalizes to `''`; no two normalize equal (WARN) | FMT-02/04 | mutation |
| `kind=code` requires non-empty `code`; `kind=concept` must not have `code`; `code` contains no `\r` | FMT-03 | mutation |
| `explanation` non-empty and `explanationLines(...).length <= 5` (WARN if any line > 100 chars: it wraps on phones) | FMT-03/04, RSLT-03 | `long-explanation.json` (6 lines) |
| `concept.name` and `concept.ref` non-empty | FMT-03, RSLT-04 | mutation |
| each question has non-empty `sourceIds` (all exist in `sources[].id`) OR non-empty `file` string | FMT-03/04 | `unknown-source.json` |
| `sources[]`: ids unique; `author` ∈ `members.json` (default `members.json` at repo root if present); `date` valid; date inside `range` (WARN); `title`, `subject` non-empty | FMT-01/04 | mutation |
| Every `sources[]` entry referenced by ≥1 question (WARN) | FMT-04 | mutation |
| Hangul present in `title`, every `prompt`, `explanation` (WARN: DSGN-02/GEN) | DSGN-02 | mutation |
| Correct-answer index not the same for ≥6 of the choice questions (WARN) | quality | optional |
| `--sources records.json`: every `set.sources[i]` matches a record by `id`, and `author`/`date` equal; each `code` question's `code` is a substring (after `\r\n`→`\n`, trailing newline trimmed, **internal whitespace untouched**) of some `codeBlocks[]` of a cited record | FMT-04 | `code-mismatch.json` + `records.json` |
| Index: array non-empty; entries have `id,title,published(YYYY-MM-DD),file`; ids unique; `file === "quizzes/" + id + ".json"`; sorted newest first by `published` (tie → `id` desc); file exists with **exact-case** name (`readdirSync` listing, because Windows `existsSync` is case-insensitive and GitHub Pages is not); the file's own `id` equals the entry's | FMT-05 | `bad-index.json` |

Proposed `--sources` file (Phase 2 will generate it; it is "입력 기록 목록" in FMT-04): `{ "records": [ { "id": "s1", "author": "이주현", "date": "2026-10-14", "title": "...", "subject": "Pandas", "codeBlocks": ["...verbatim code..."], "files": ["sales.csv"] } ] }`. [ASSUMED: shape is this document's recommendation; CONTEXT only names the flag]

### Anti-Patterns to Avoid

- **`innerHTML` with any data field** (prompt, choices, code, explanation, member names): data is repo-authored today but Phase 2 generates it from Notion text. Use `createElement` + `textContent`; code goes in `code.textContent`.
- **`fetch('quizzes/…')` relative to the document** inside shared modules: use `new URL(path, ROOT)`.
- **Absolute URLs (`/css/site.css`)**: break on a Pages project site (`https://user.github.io/<repo>/`). Relative only.
- **Leading-zero strings, `padStart(2,'0')`, `✓ ✗ ★` characters in source**: all caught by `lint.mjs` (Pitfall 3).
- **Grading in the DOM layer**: keep every rule in `grade.js` so validator and tests share it.
- **Comparing raw accepted answers**: always `normalizeAnswer` both sides, in the browser and in the validator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal confirm with focus trap | custom overlay + focus trap | native `<dialog>` + `showModal()` | Inert background, Esc, backdrop, form return values built in |
| Test runner / assertions | custom harness or jest | `node:test` + `node:assert/strict` | Zero deps; discovered by plain `node --test` |
| Dev server / HTTP | `npx serve`, Express | the 25-line `serve.mjs` above | Parity with Pages (no clean-URL rewriting), no network |
| Unicode folding (full-width, composed Hangul) | char-code tables | `String.prototype.normalize('NFKC')` | Handles full-width Latin/digits, decomposed jamo, ligatures |
| Date validity | regex-only date check | `new Date(y, m-1, d)` round-trip compare | Catches 2026-02-31 |
| Radio / group semantics | div + ARIA roles | native `fieldset`/`legend`/`input[type=radio]` in `label` | Keyboard arrows, grouping, large hit area for free |
| Entrance/reveal animation + `.js` guard | custom observers | skill's `assets/base.css` + `base.js` (`data-rise`, `data-reveal`) | Already reduced-motion aware, content visible without JS |
| Picture search/credit | manual image hunting | `assets.mjs "<query>"`, `--get`, `--credits` | Records licence + credit line for the footer |
| Browser driving for smoke | add Playwright/Puppeteer | skill `cdp.mjs` (zero deps) + `agent-browser` | Already on this machine; no new dependencies |

**Key insight:** this project's value is in being dependency-free and maintainable by a non-developer; every "library" above is a platform feature or an already-present tool. The only genuinely custom logic is the ~60-line grading module and the validator rules.

## Runtime State Inventory

Not a rename/refactor/migration phase (greenfield; the repo currently holds only `.planning/`, `.claude/`, `.taste-skill/`, `skills-lock.json`). Section omitted.

## Common Pitfalls

### Pitfall 1: `agent-browser open` hangs when its output is piped (Windows Git Bash)
**What goes wrong:** the first command of a new session starts a daemon that inherits the stdout pipe, so `agent-browser open URL | tail` never returns (the tool call times out at 120 s). Reproduced twice. [VERIFIED: this session]
**How to avoid:** redirect to a file and detach stdin: `agent-browser open URL > ab.log 2>&1 < /dev/null`; use a named session (`export AGENT_BROWSER_SESSION=quiz-p1`) and `agent-browser close --all` when done. In Node scripts use `stdio: ['ignore', fd, fd]` with file descriptors, not pipes.
**Warning signs:** command "moved to background after timeout".

### Pitfall 2: `node --test tests/` fails on Node 25
**What goes wrong:** a directory argument is treated as a module path and fails (`test at tests:1:1 ✖ tests`). [VERIFIED: scratch run]
**How to avoid:** `node --test` with no arguments, or a quoted glob `node --test "tests/**/*.test.mjs"` (both verified). Name helper files without the `.test.` infix.

### Pitfall 3: `lint.mjs` rejects things that look innocent
Verified by reading `scripts/lint.mjs` regexes:
- **Emoji rule covers U+2600-26FF and U+2700-27BF**, so `✓ ✗ ✕ ★ ☐` in HTML/JS/CSS source FAIL. Draw correct/incorrect marks with CSS (filled circle vs slash) or inline SVG; `●○×→` are outside those ranges.
- **`mono` matches `--font-mono` and `ui-monospace` anywhere on a line** unless the line/selector is `pre|code|kbd|samp`. Declare the stack inside the `pre, code { font-family: ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace; }` rule; never as a `:root` custom property.
- **`numbering` FAIL on quoted `'01'`..`'09'` and `>01<`; WARN on `padStart(2,'0')`.** Format `M/D` with `Number(m)` as above.
- **`hairline`/`outlined-box`:** `border-top: 1px`, `height: 1px`, `<hr>`, `border: 1px solid` fail; `fieldset`, `input`, `textarea`, `table` selectors are exempt. Make choice options filled bars (surface tone, selected = ink fill), not outlined boxes. The probe flags `dashed` borders under 3px as WARN but a 4px dotted perforation is allowed. [VERIFIED: probe.mjs:339-340]
- `transition: all`, `ease-in`, `scale(0)`, `100vh` (use `svh`), `backdrop-filter`, `animate-pulse` are WARNs. English `Submit` button text is a WARN (Korean copy avoids it). More than 4 em dashes in non-comment lines is a WARN: avoid "—" in UI copy.
- `lint.mjs .` scans only `.html .css .js` etc. (not `.mjs`, not `.json`) and skips dot-directories, `tests`-style `.mjs` files and `node_modules`; running it on `.` is safe. [VERIFIED: lint.mjs:15-16, 21]

### Pitfall 4: Inspector floors apply to every page you point it at
`inspect.mjs` FAILs at 1440 width when a page has fewer than 4 real pictures (`few-pictures`), fewer than 8 moving elements (`still-page`), or no dominant first-screen element (`focal-point`: largest type under 4.5vw ≈ 65px at 1440 and no picture covering a third of the viewport); WARNs on no video (`no-footage`). [VERIFIED: rules.mjs:109-116, 129-131; inspect.mjs:147-152; confirmed on the scratch page: 3 FAIL, 2 WARN]
- `--step-head` tops out at 4rem = 64px = 4.4vw at 1440, which FAILS `focal-point` on `quiz.html`. Set the sheet's `h1` around `clamp(2.5rem, 7vw, 6rem)` (≈100px at 1440), still ≤2 lines on 390px.
- Decide the policy for `quiz.html` explicitly (Open Question 2): either give it ≥4 real pictures and motion, or run `inspect.mjs quiz.html --allow few-pictures,still-page,no-footage` and report the allowance (the skill itself says it is "Not for dashboards or app screens"). The home page must pass with no allowances.
- `empty-screens` FAILs when ≥2 desktop screens are under 20% filled: the home page's list/slip/spines/footer must be dense.
- Motion is counted from CSS animations/transitions/WAAPI/scripted style changes that actually run during load plus scroll (hover-only transitions never run in the inspector). Reveal-on-scroll with transitions across heading, text, five folders, bars, slip rows, spines and footer reaches 8 easily; the skill's `data-rise` / `data-reveal` helpers do this and keep content visible without JS. [VERIFIED: inspect.mjs MOTION_RECORDER; base.css lines 85-97]
- Run on a file path (`node …/inspect.mjs quiz.html`) and the inspector serves the repo root itself on a throwaway port; no separate `serve.mjs` needed. To inspect a URL with a query string use an `http://127.0.0.1:<port>/quiz.html?set=…` URL with `serve.mjs` running. Make `quiz.html` with no query load the newest set so it is inspectable by path. [VERIFIED: inspect.mjs:35-52]
- The inspector only sees the initial (ungraded) state. Verify the graded state with the smoke script or agent-browser (seed `storage local set srq:attempt:… ` then `reload`, or answer + submit through the UI).
- Chrome is found at `C:\Program Files\Google\Chrome\Application\chrome.exe` (Edge also present); override with `CHROME_PATH`. [VERIFIED: ls + cdp.mjs:11-34]

### Pitfall 5: Colour combinations that fail contrast on the dark hero ground
Computed contrast ratios for the locked palette: ink on bg 12.93, ink on surface 11.91, muted on bg 5.22, muted on surface 4.80, bg on ink 12.93, surface on ink 11.91, **muted on ink 2.48**, **accent on ink 2.49**, white on accent 5.49. [VERIFIED: node computation this session] So: on the dark `--ink` ground set all text in `--bg`/`--surface`, never `--muted`; the teal button is white-on-accent and should sit on a light folder (it does: the front folder). Body copy must be full `--ink` (inspector `grey-body` wants ≥7:1); `--muted` only for secondary notes on light grounds.

### Pitfall 6: Korean line breaking and headline arithmetic
Default browsers may break Korean mid-word. Use `word-break: keep-all; overflow-wrap: break-word` on running text and headings (not on `pre`), so "이번 주 시험지" breaks only at spaces. A Hangul syllable is ~1em wide, so width ≈ (syllables + 0.25 per space) × font-size × 0.98: "이번 주 시험지" at 144px (10vw @1440) ≈ 917px ≈ 64% of the width (blueprint wants ~70%), but on a 390px phone even 15vw (58px) is ≈ 380px > 358px content width, so it wraps to two lines ("이번 주" / "시험지") - allowed by the blueprint and by the two-line rule. Tracking: keep -0.02em only for the large display sizes; use 0 below ~32px (tight tracking hurts Hangul). Cap running text at ~60ch (≈30 syllables) to stay under the inspector's 88-character `measure` warning.

### Pitfall 7: Hangul IME behaviour in text inputs
- Pressing Enter in a text input inside a `<form>` triggers implicit submission, and with an IME the Enter that commits the last syllable can also fire a second event. Make the real submit control a `type="button"` that opens the dialog, add `form.addEventListener('submit', e => e.preventDefault())`, and swallow Enter on short-answer inputs (`keydown` `Enter` → `preventDefault()`). [ASSUMED: browser-specific double-fire details; the mitigation is safe regardless]
- Do not read/store mid-composition text as final: autosave on `input` with a ~300 ms debounce, and flush on `change`, `visibilitychange` (hidden) and `pagehide`; always read the live `input.value` when submitting.
- Mobile keyboards autocorrect/capitalize identifiers: `autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"`. Inputs must render at ≥16px or iOS Safari zooms on focus [ASSUMED]; body is already 18-21px, but set `font: inherit` on inputs.
- NFKC converts compatibility jamo (U+3131..) to conjoining jamo and may partially compose them, so a raw-compared accepted answer of `ㅎㅏㄴ` would look odd in logs; harmless because both sides go through `normalizeAnswer`. The validator must normalize accepted answers too, never compare raw.

### Pitfall 8: Regex lookbehind breaks old Safari at parse time
`(?<=…)` throws a SyntaxError when the module is parsed on Safari < 16.4, killing the whole quiz on older iPhones. [ASSUMED: browser version from training data] The normalizer above uses a capture group instead; keep that rule for every regex in browser-loaded modules (`grade.js` is imported by the browser).

### Pitfall 9: GitHub Pages is case-sensitive; Windows is not
`quizzes/2026-w42.json` works locally on Windows and 404s on Pages. The index validator checks exact-case names from a `readdirSync` listing (rule table). Keep ids upper-case `W` everywhere.

### Pitfall 10: Caching and 404 behaviour on Pages
Pages has historically served assets with `Cache-Control: max-age=600` and offers no way to change headers (secondary sources only; verify on the real site in Phase 3). [ASSUMED] Use `fetch(..., { cache: 'no-cache' })` for the two JSON file types so a new week appears immediately; JS/CSS may be up to ~10 min stale, so keep JSON backward compatible with the previous JS (tolerate unknown keys). A missing file returns Pages' HTML 404 with status 404: always check `res.ok`, and show a Korean error panel with a retry button instead of a blank page.

### Pitfall 11: `<dialog>` returnValue and `li` markers
Reset `dlg.returnValue = ''` before each `showModal()` (it persists). `display: grid/flex` on an `<li>` removes its marker because markers exist only for `display: list-item` [CITED: MDN `::marker` page (applies to `display: list-item`); the grid case is spec reasoning, ASSUMED] - put the grid on a wrapper inside the `<li>`.

### Pitfall 12: BOM, CRLF and PowerShell encodings in data files
PowerShell 5.x `Out-File`/`>` writes UTF-16 or UTF-8-with-BOM; `JSON.parse` of a string starting with U+FEFF throws. The validator strips a leading BOM and reports a friendly Korean message on parse failure (with position). Reject `\r` inside `code` (warn the author to use `\n`). Console output of Korean from Node to a legacy-codepage Windows console can look garbled when piped; tests decode as UTF-8 and assert on substrings.

### Pitfall 13: Font payload, the 372 `@font-face` rules, and a locally installed Noto Serif KR
Google serves Noto Serif KR as 124 unicode-range slices x 3 weights = 372 `@font-face` rules (each slice is one variable woff2 shared by the 400/500/600 rules, e.g. latin slice `3Jn7SDn90Gmq2mr3blnHaTZXRudj1Q.woff2` is referenced by all three). [VERIFIED: fetched CSS with a Chrome user agent this session] The browser downloads only slices whose characters appear on the page; six sampled Hangul slices were 42-68 KB (mean ~54 KB), so a text-heavy Korean page plausibly downloads tens of slices (order of 1-2 MB worst case; the exact number depends on the distinct syllables used). [ASSUMED: slice count per page] Mitigations that need no build: `preconnect` to both hosts (as in the direction sheet), `display=swap`, request only `wght@400;500;600`, a same-kind fallback stack. A non-browser user agent receives a single TTF without `unicode-range` (not what real browsers get). IMPORTANT: this development machine has Noto Serif KR and Noto Sans KR installed locally, so screenshots here can render the local font even if the web font failed; check the Network panel or `document.fonts` for the gstatic requests before trusting a render. [VERIFIED: font family listing this session]

Fallback stack (same broad kind: serif, Korean-capable first): `"Noto Serif KR", "Batang", "AppleMyungjo", "Noto Serif CJK KR", "Source Han Serif K", serif`. Batang (Windows), AppleMyungjo (macOS/iOS) and Noto Serif CJK (Android) availability is [ASSUMED]; this machine has no Batang or Malgun Gothic at all, so do not assume Windows fallbacks exist.

### Pitfall 14: Shared device and set-keyed attempts
`srq:attempt:<setId>` has no member in the key (locked). On a shared browser the second person sees the first person's frozen result. Accepted for "one browser = one person" (project constraint) but surface it: show `attempt.member` in the result header so a mismatch is visible. Do not fix by changing the key without a user decision.

### Pitfall 15: Short-answer authoring quality (guidance for sample data and Phase 2)
Ask for a single term, not a sentence. List 2-5 accepted variants per question: Korean + English names, with and without the object prefix, e.g. for "결측치 개수를 열별로 세는 메서드 체인": `["isna().sum()", "isnull().sum()", "df.isna().sum()", "df.isnull().sum()", "결측치 확인"]` - note `isna().sum()` normalizes to `isna.sum` while `df.isna().sum()` normalizes to `df.isna.sum`, which are different strings, so both must be listed. The validator WARNs when two accepted answers normalize equal.

## Code Examples

### CLI fixture test

```js
// tests/cli.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const run = (...args) => spawnSync(process.execPath, ['scripts/validate-quiz.mjs', ...args], { encoding: 'utf8' });

test('valid sample passes', () => {
  const r = run('quizzes/2026-W42.json');
  assert.equal(r.status, 0, r.stderr);
});
for (const [file, needle] of [
  ['tests/fixtures/wrong-count.json', '10문제'],
  ['tests/fixtures/three-choices.json', '보기는 4개'],
  ['tests/fixtures/answer-out-of-range.json', '정답 번호'],
  ['tests/fixtures/unknown-source.json', '출처'],
  ['tests/fixtures/long-explanation.json', '5줄'],
]) {
  test(`${file} is rejected with a Korean reason`, () => {
    const r = run(file);
    assert.equal(r.status, 1);
    assert.match(r.stderr, new RegExp(needle));
  });
}
```

### Unit test for grading

```js
// tests/grade.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, gradeQuestion, gradeSet } from '../js/grade.js';

const cp = (...c) => c.map((x) => String.fromCodePoint(x)).join('');
test('normalizeAnswer table', () => {
  for (const [input, want] of [
    ['GroupBy', 'groupby'], [cp(0xFF27, 0xFF52, 0xFF4F, 0xFF55, 0xFF50, 0xFF22, 0xFF59), 'groupby'],
    ['groupby()', 'groupby'], ['train_test_split', 'traintestsplit'], ['결측치' + cp(0xB7) + '처리', '결측치처리'],
    [cp(0x1112, 0x1161, 0x11AB, 0x1100, 0x1173, 0x11AF), '한글'], ['-1', '-1'], ['  ', ''],
  ]) assert.equal(normalizeAnswer(input), want);
  assert.notEqual(normalizeAnswer('-1'), normalizeAnswer('1'));
});
test('blank short answer is wrong and blank', () => {
  assert.deepEqual(gradeQuestion({ type: 'short', answer: ['x'] }, '   '), { correct: false, blank: true });
});
```

### Storage degradation test

```js
// tests/storage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';

const fake = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };

test('round trip + versioned', () => { const s = createStore(fake); s.set('member', { name: '이주현' }); assert.equal(s.get('member').name, '이주현'); });
test('unavailable backend degrades to memory', () => {
  const s = createStore(() => { throw new DOMException('blocked', 'SecurityError'); });
  assert.equal(s.persistent, false); s.set('draft:x', { answers: {} }); assert.ok(s.get('draft:x'));
});
test('quota error on write flips persistent off but keeps the value', () => {
  const b = fake(); const s = createStore(() => b);
  b.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.equal(s.set('attempt:x', { score: {} }), false); assert.ok(s.get('attempt:x')); assert.equal(s.persistent, false);
});
```

### Smoke script outline (`scripts/smoke.mjs`, run with `node scripts/smoke.mjs`)

Spawn `scripts/serve.mjs` on a fixed port (e.g. 8099), then use the skill's client:
```js
import { Browser, sleep } from '../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const b = await Browser.launch(); const page = await b.newPage({ width: 390, height: 844, mobile: true });
await page.goto('http://127.0.0.1:8099/index.html');
// drive with page.eval(): click member radio, click start, answer, set input.value + dispatchEvent(new Event('input', {bubbles:true})),
// click #submit, read dialog.open + #blank-count, click button[value=submit], then assert DOM (see Validation Architecture)
```
Note it drives the DOM synthetically (no real IME/keyboard); pair it with an `agent-browser` pass for real clicks, `snapshot -i` and screenshots.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom modal overlay + focus trap | `<dialog>` + `showModal()` | Baseline widely available since March 2022 [CITED: MDN dialog] | Use natively |
| Jest/Mocha for tiny Node tools | built-in `node:test` runner, no-arg discovery | stable in current Node (v25.7.0 here) | Zero deps |
| Static-site toolchains for tiny sites | plain ES modules + `import.meta.url` | - | No build, Pages-compatible |
| Google Fonts monolithic Korean files | unicode-range slices (124) of a variable woff2 | current API behaviour [VERIFIED: fetched CSS] | Pay per used syllable slice |

**Deprecated/outdated for this project:** `npx serve` for local preview (needs network, rewrites URLs); `window.confirm()` for submit confirmation (untestable and ugly); locale-dependent `toLocaleLowerCase()` for case folding.

## Sample Data Guidance (item 8)

Shape of the sample set `quizzes/2026-W42.json` (2026-10-16 is a Friday and ISO week 42 [VERIFIED: node computation], so `id "2026-W42"` and `published "2026-10-16"` are consistent; `range` should be `{ "from": "2026-10-09", "to": "2026-10-16" }` per the Friday-to-Friday window in STATE.md/GEN-02 even though entries are dated 10/13..10/16).

Six sources, one per member, authors taken from `members.json`, dates 2026-10-13..16, `subject` from the Notion property (Python / Pandas / 데이터 시각화 / 데이터 분석 / 머신러닝). Suggested content (executor writes the Korean text; keep each `explanation` to ≤5 short lines):

| Q | kind / type | Topic | Distractor idea (from "막힌 이유") |
|---|---|---|---|
| 1 | concept / choice | `groupby` returns a GroupBy object; nothing is computed until an aggregation | "바로 집계된 DataFrame이 출력된다" |
| 2 | concept / choice | `merge(how="left")` keeps all left rows vs `inner` row loss | assuming inner is default-left; duplicate keys multiply rows |
| 3 | concept / short | count missing values per column: `isna().sum()` (list variants, Pitfall 15) | `isnull().count()` counts non-null too |
| 4 | concept / choice | matplotlib `fig, ax = plt.subplots()` object-oriented vs `plt.plot` state machine | forgetting `plt.show()`/mixing APIs |
| 5 | concept / choice | seaborn chart choice for category-wise distribution (boxplot vs lineplot) | using lineplot on categories |
| 6 | concept / short | 데이터 누수 (data leakage): scaling/imputing before the split; accepted `["데이터 누수","데이터누수","data leakage","leakage"]` | - |
| 7 | concept / choice | accuracy misleads on imbalanced classes; prefer recall/F1 | "정확도가 높으면 모델이 좋다" |
| 8 | code / choice | monthly sales: `groupby(df["날짜"].dt.to_period("M"))["매출"].sum().reset_index()` - which analysis stage/purpose (EDA aggregation) | confusing with 전처리 / 모델링 |
| 9 | code / short | `df["나이"].fillna(df["나이"].median())` - which method/term (중앙값 대체) | mean vs median |
| 10 | code / choice | `StandardScaler().fit_transform(X)` before `train_test_split` - what is wrong / which line | fitting scaler on test set |

Guidance: 7 choice-leaning + 3 short total is plenty; vary the correct index (not all 0); code questions ask about **stage/purpose**, not syntax trivia (GEN-04). `code` strings contain real indentation and `\n` in JSON; they must also appear verbatim in the `--sources` fixture `codeBlocks`. Sources used only by file (`file: "sales.csv"`) should appear in at least one question to exercise the "실습 파일 · sales.csv" display path (RSLT-04). Mark the files as sample data in the README (CONTEXT requirement). `members.json` placeholders: the calendar screenshot names are truncated (송지…, 노아…, 정보경…), so use the readable names known from the screenshot and flag them for confirmation (Open Question 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Batang (Windows), AppleMyungjo (macOS/iOS), Noto Serif CJK (Android) exist as Korean serif fallbacks | Pitfall 13 | Fallback renders in a default sans/serif for the brief swap period only; low |
| A2 | GitHub Pages sends `Cache-Control: max-age=600` and cannot be changed | Pitfall 10 | If caching is longer, new weeks could appear late; `cache: 'no-cache'` on JSON mitigates; re-check headers with `curl -I` in Phase 3 |
| A3 | A text-heavy Korean page downloads tens of Noto Serif KR slices (~1-2 MB worst case) | Pitfall 13 | Page weight on mobile data; measure in Network panel after build |
| A4 | `display: grid/flex` on `<li>` removes its marker; `list-style: none` drops list semantics in Safari | Pattern 5 / Pitfall 11 | Recommendation (wrapper div) is safe either way |
| A5 | Safari < 16.4 lacks regex lookbehind | Pitfall 8 | Recommendation (no lookbehind) is safe either way |
| A6 | iOS Safari zooms on focus for inputs < 16px | Pitfall 7 | Input font already ≥16px; no cost |
| A7 | IME Enter can double-fire / trigger implicit form submission | Pitfall 7 | Mitigation is harmless |
| A8 | `--sources` records file shape (`records[].codeBlocks`, `files`) | Pattern 7 | Phase 2 must produce what the validator expects; confirm at Phase 2 planning |
| A9 | Author must be a member name (ERROR) and date outside `range` is WARN | Pattern 7 | A stricter/looser rule than the user wants; easy to flip |
| A10 | `import.meta.main` may be unavailable on Node 22 | Pattern 7 | Avoided by design |
| A11 | `npx serve` rewrites clean URLs by default | Alternatives | Only a reason against it; the custom server is chosen anyway |
| A12 | Allowing `--allow few-pictures,still-page,no-footage` for `quiz.html` is acceptable to the user | Pitfall 4 | If not acceptable the quiz page needs ≥4 pictures and motion; more design work |

## Open Questions (RESOLVED)

1. **Member full names** — RESOLVED: orchestrator decision 1 (김준수, 이주현, 차승환 + 스터디원 4/5/6 placeholders with `confirm: true`; user fills real names)
   - What we know: CONTEXT says placeholders until confirmed; screenshot shows 김준수, 송지…, 노아…, 이주현, 차승환, 정보경….
   - What's unclear: the exact six names.
   - Recommendation: ship `members.json` with the best readable names plus a README "SAMPLE" note; the validator checks `author ∈ members`, so a later rename is a one-file change. Ask the user at the human-verify checkpoint.

2. **Inspector policy for `quiz.html` (and any later screen without pictures)** — RESOLVED: orchestrator decision 2 (revised) — no `few-pictures` allowance at phase end; the sheet carries ≥4 tipped-in plates; only a defended `no-footage` WARN
   - What we know: the pictures/motion/focal-point floors apply to whatever page is inspected; the skill says it is "Not for dashboards or app screens"; CONTEXT says every screen goes through the gate.
   - What's unclear: whether the exam sheet should carry ≥4 pictures and 8 moving elements, or use documented `--allow` flags.
   - Recommendation: home passes with zero allowances; `quiz.html` gets a large `h1` plus a slim picture band and entrance motion if cheap, otherwise `--allow few-pictures,still-page,no-footage` stated in the report. Put it in the plan as a decision for the user at the checkpoint.

3. **Shared browser / set-keyed attempt** (Pitfall 14): RESOLVED: orchestrator decision 3 — keep the locked key, show the member name on the result; revisit in Phase 4.

4. **Phase 3 heads-up: what Pages will publish.** RESOLVED: orchestrator decision 5 (no `.nojekyll` in Phase 1; decide in Phase 3). The repo root contains `.planning/`, `.claude/`, `.taste-skill/`. Jekyll (default) excludes dot-directories and underscore paths; adding `.nojekyll` publishes everything. [CITED: docs.github.com "Files that start with an underscore are missing" - Jekyll skips hidden/underscore files; `.nojekyll` disables Jekyll and publishes sources unmodified] Do not add `.nojekyll` casually; decide in Phase 3 (deploy only needed files via Actions, or keep Jekyll).

5. **`no-footage` WARN.** RESOLVED: defended in 01-04 T2 (no honest clip; slow drift on a photograph is the moving picture). `assets.mjs --video "punched card computer"` returned one unrelated portrait clip and a 64.8 MB 1951 film (over the 25 MB cap, 10:53 long); ffmpeg is not installed to trim. Recommendation: defend the WARN (no honest short clip fits) and use a slow scale/drift on a photograph as the "one moving picture".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | validator, serve, tests, design scripts (needs 22+) | yes | v25.7.0 | - |
| npm | optional scripts only | yes | 11.10.1 | run `node` directly |
| Chrome / Edge (for `inspect.mjs`, `cdp.mjs`) | design gate, smoke | yes | Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`; Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` | `CHROME_PATH` |
| agent-browser | screenshots, a11y snapshot | yes | 0.39.1, own Chrome 155 | skill `inspect.mjs` screenshots |
| Network (assets.mjs, Google Fonts CSS) | pictures, fonts | yes | `assets.mjs` searches succeeded; fonts.googleapis.com fetched | draw in code and say so (skill rule) |
| ffmpeg | `agent-browser record`, trimming clips | no | - | not needed |
| Python | - | no | - | not needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** ffmpeg (not required).

Candidate pictures found this session via `assets.mjs` (all searched with `--no-check`; licences as printed; prefer public-domain ones to avoid share-alike duties; `--get <ref>` downloads and records credit; use `--width 1400` to keep weight down; check each visually before choosing):
- `commons:30538485` Hollerith Punched Card (1895), 1200x538, public domain
- `commons:547255` 1890 U.S. Census form, portrait, public domain
- `commons:17290929` card puncher used for the US Census tabulation system, 1920x1513, public domain
- `commons:4339099` Playfair piecharts (1801), 1920x1052, public domain
- `commons:1474443` Nightingale-mortality (1858), 1920x1050, public domain
- `commons:62596842` MIT physical examination room (1917-18), 1920x1267, public domain
- Card catalogue (`commons:153582894`, `153582891`, Indiana State Library) are CC BY-SA 4.0 (credit + share-alike); punch-card sorter/duplicator on Openverse are CC BY 2.5 / CC BY-SA 3.0.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built into Node v25.7.0; Node 22+ required) |
| Config file | none - discovery by glob; `package.json` `"type": "module"` |
| Quick run command | `node --test "tests/**/*.test.mjs"` (expect < 5 s) |
| Full suite command | `npm run check` (test + validate sample/index + `lint.mjs .`), then `node scripts/smoke.mjs` |
| Phase gate | full suite + `node .claude/skills/design-taste-frontend/scripts/inspect.mjs index.html` (0 FAIL) + `inspect.mjs quiz.html [documented --allow]` + screenshots at 1440/768/390 reviewed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FMT-01 | Sample set has header, range, sources, 10 questions | unit/CLI | `node scripts/validate-quiz.mjs quizzes/2026-W42.json` (exit 0) + `tests/validate.test.mjs` | Wave 0 |
| FMT-02 | choice = 4 unique choices + index in range; short = non-empty accepted list | unit | `node --test tests/validate.test.mjs` (mutations + `three-choices`, `answer-out-of-range`) | Wave 0 |
| FMT-03 | Required per-question fields; sourceIds-or-file; concept ref | unit | `node --test tests/validate.test.mjs` | Wave 0 |
| FMT-04 | Every checker rule fires with Korean message and exit 1 | CLI | `node --test tests/cli.test.mjs` (5 static fixtures + code-mismatch with `--sources`) | Wave 0 |
| FMT-05 | Index validated; newest first; home shows first as "이번 주" | unit + smoke | `node scripts/validate-quiz.mjs quizzes/index.json`; smoke: home title equals `index[0].title` | Wave 0 |
| QUIZ-01 | Pick name once, no login, name remembered | smoke | `node scripts/smoke.mjs` (select member → `srq:member` set → quiz.html loads) | Wave 0 |
| QUIZ-02 | 10 `li` in `ol`; 3 `pre code` whose `textContent` equals JSON `code` verbatim; computed `white-space: pre` | smoke | `node scripts/smoke.mjs` | Wave 0 |
| QUIZ-03 | Answer persists across reload; draft key written | unit + smoke | `node --test tests/storage.test.mjs`; smoke: answer, reload, still checked | Wave 0 |
| QUIZ-04 | Dialog shows blank count; submit freezes attempt; reload shows result; draft removed; cancel changes nothing | smoke | `node scripts/smoke.mjs` | Wave 0 |
| QUIZ-05 | At 390x844: no horizontal overflow (`scrollWidth <= innerWidth`), radio labels ≥ 44 px tall, flow completes | smoke + inspect | `node scripts/smoke.mjs` (mobile page) ; `inspect.mjs` 390 viewport `overflow` finding absent | Wave 0 |
| RSLT-01 | Normalization table; blank = wrong; typed " GroupBy() " graded correct in browser | unit + smoke | `node --test tests/grade.test.mjs`; smoke types variant | Wave 0 |
| RSLT-02 | Result block precedes each question (DOM order) with text 정답/오답 and the correct answer | smoke | `node scripts/smoke.mjs` (`compareDocumentPosition`) | Wave 0 |
| RSLT-03 | Explanation shown, ≤5 lines | unit + smoke | validator rule; smoke counts rendered lines | Wave 0 |
| RSLT-04 | Concept `name · ref` and `"{author} · {M/D}"` (or file name) shown | unit + smoke | `sourceLabel` unit test; smoke text assertion | Wave 0 |
| RSLT-05 | Summary text equals `gradeSet()` total/개념/코드 | unit + smoke | `node --test tests/grade.test.mjs`; smoke compares DOM with computed score | Wave 0 |
| DSGN-01 | House rules satisfied; one direction across screens | lint + inspector + manual | `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` ; `inspect.mjs index.html` / `quiz.html` ; critique of screenshots per `references/critique.md` (manual, cannot be automated) | tools present |
| DSGN-02 | All UI Korean, `lang="ko"` | smoke + validator | smoke: `document.documentElement.lang === 'ko'`, visible headings/buttons/labels contain Hangul; validator Hangul WARN | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test "tests/**/*.test.mjs"` (+ `lint.mjs .` after any HTML/CSS/JS task)
- **Per wave merge:** `npm run check` and `node scripts/smoke.mjs`
- **Phase gate:** all of the above green, `inspect.mjs` 0 FAIL on home (and on quiz per Open Question 2), screenshots viewed at 1440/768/390 for home, quiz (blank), quiz (graded; produced via smoke or agent-browser seeding), plus an `agent-browser snapshot -i` pass confirming radiogroup/legend names.

### Wave 0 Gaps
- [ ] `package.json` (type=module, scripts, no deps)
- [ ] `js/grade.js` + `tests/grade.test.mjs`
- [ ] `js/storage.js` + `tests/storage.test.mjs`
- [ ] `scripts/lib/validate-core.mjs` + `scripts/validate-quiz.mjs` + `tests/validate.test.mjs` + `tests/cli.test.mjs`
- [ ] `tests/fixtures/` (wrong-count, three-choices, answer-out-of-range, unknown-source, long-explanation, code-mismatch + `records.json`, bad-index)
- [ ] `scripts/serve.mjs`, `scripts/smoke.mjs`
- [ ] Framework install: none needed

## Security Domain

> `security_enforcement: true`, ASVS level 1, block on high. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No login by design |
| V3 Session Management | no | No sessions; localStorage holds only name/answers |
| V4 Access Control | no | Public static data; answers are in the JSON by accepted decision (REQUIREMENTS Out of Scope) |
| V5 Input Validation / output encoding | yes | Render all data with `textContent`/`createElement`; validate JSON in the CLI; sanitize localStorage on read; cap input length |
| V6 Cryptography | no | None used |
| V7 Error handling | yes | Friendly Korean error panel; never expose stack traces; storage failures swallowed and surfaced as a notice |
| V8 Data protection | yes (low) | localStorage stores a display name and quiz answers; no secrets; note shared-device behaviour |
| V10/V14 Configuration & dependencies | yes | Zero npm dependencies; third-party fonts only; optional CSP `<meta>` |

### Known Threat Patterns for static site + localStorage + generated JSON

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DOM XSS from quiz JSON (Phase 2 content comes from Notion text/LLM) | Tampering / Elevation | `textContent` only, never `innerHTML` for data; code via `code.textContent`; no `eval`/`new Function`; no `javascript:` links from data |
| Tampered or stale localStorage (other schema, hand-edited) | Tampering | `{v:1}` check, JSON.parse in try/catch, drop unknown question ids, type/range-check answers; impact limited to the user's own browser |
| Prototype pollution via keys like `__proto__` | Tampering | Question ids constrained by the validator (`^q([1-9]|10)$`); never deep-merge parsed JSON |
| Path traversal in `serve.mjs` | Info disclosure | Resolve and check `startsWith(root + sep)`, bind to 127.0.0.1 (verified: traversal request returned 404) |
| Third-party font host sees visitor IPs | Info disclosure | Accepted (locked decision), preconnect only to googleapis/gstatic; self-hosting is a later option |
| Reverse tabnabbing on external links (credits) | Spoofing | `rel="noopener noreferrer"` on any `target="_blank"` link |
| Optional defence in depth | - | `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; base-uri 'self'; form-action 'self'">`. Requires no inline `<script>` (use `js/boot.js`) and no inline `style=""` markup (CSSOM `el.style.x=` is allowed). Decide in planning; note `frame-ancestors` cannot be set via meta. |

## Sources

### Primary (HIGH confidence)
- Executed this session: `node --test` discovery on Node v25.7.0; throwaway static server + module page + `<dialog>` in `agent-browser` 0.39.1; `inspect.mjs` on a scratch page; `assets.mjs` searches; `draw.mjs --show`; Google Fonts CSS fetch with a Chrome user agent; 26-case normalizer table; contrast computation; ISO-week/weekday computation.
- Read in full or in the relevant parts: `.planning/phases/01-quiz-core/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/config.json`, `.claude/CLAUDE.md`, `.claude/skills/design-taste-frontend/SKILL.md`, `scripts/inspect.mjs`, `scripts/lint.mjs`, `scripts/lib/rules.mjs`, `scripts/lib/cdp.mjs`, `scripts/lib/probe.mjs` (relevant lines), `assets/base.css`, `assets/base.js`, `references/motion.md` (preview recipe), `references/type.md` §5.
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API - feature detection, zero-quota private mode, storage event
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog - `showModal()`, `returnValue`, autofocus, Baseline since March 2022
- https://developer.mozilla.org/en-US/docs/Web/CSS/::marker - allowed properties, `display: list-item`

### Secondary (MEDIUM confidence)
- https://docs.github.com/en/enterprise/2.14/user/articles/files-that-start-with-an-underscore-are-missing - Jekyll skips hidden/underscore files; `.nojekyll`
- Secondary web results on GitHub Pages `max-age=600` (2013 Stack Overflow thread mirror, third-party guides) - not official; flagged A2.

### Tertiary (LOW confidence)
- Training-knowledge claims tagged `[ASSUMED]` in the Assumptions Log (fallback font availability, Safari/iOS behaviours, IME double-fire details).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no external packages; every tool exercised on this machine.
- Architecture: HIGH for module split, storage, validator; MEDIUM for the exact folder/page layout (planner may adjust).
- Pitfalls: HIGH for lint/inspector/agent-browser/node-test (reproduced or read from source); MEDIUM for browser quirks marked ASSUMED.
- Grading spec: HIGH - executed table of 26 cases, 0 mismatches.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable platform features; re-check `agent-browser`/skill versions and Google Fonts slice count if the build slips)
