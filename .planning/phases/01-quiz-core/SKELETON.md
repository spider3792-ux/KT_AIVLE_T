# Walking Skeleton — 스터디 복습 퀴즈 (Weekly Review Quiz)

**Phase:** 1
**Generated:** 2026-10-16

## Capability Proven End-to-End

A study member opens the locally served site, picks their name once, takes this week's sample set on the exam sheet, submits, and sees it graded in place (score, 정답/오답, 정답) — and reopening the set shows the same frozen result read back from localStorage.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | None. Plain HTML + CSS + vanilla ES modules (`<script type="module">`), no bundler, no npm runtime deps | Locked in CONTEXT (Stack). GitHub Pages serves the repo root as-is; a non-developer can maintain it |
| Pages | Two documents: `index.html` (home, folder stack, name picker) and `quiz.html?set=<id>` (exam sheet that grades in place). `quiz.html` with no query opens the newest set | No router code; each page inspectable by path (`inspect.mjs quiz.html`) |
| Data layer (read) | Static JSON: `quizzes/index.json` (array, newest first, first = 이번 주), `quizzes/<id>.json` (one set), `members.json` (6 names). Fetched with `getJson()` relative to a module-computed `ROOT`, `cache: 'no-cache'`, `res.ok` checked | Locked format (CONTEXT Data format); works on a Pages project sub-path |
| Data layer (write) | `localStorage` through `createStore()` (namespace `srq:`, every value wrapped `{ v: 1, ... }`, in-memory fallback, never throws). Keys: `srq:member`, `srq:draft:<setId>`, `srq:attempt:<setId>` | Locked keys (CONTEXT Attempt storage, orchestrator decision 3). Per-question `results` stored so Phase 4 lists wrong answers via `store.keys('attempt:')` and Phase 5 prefills a form without re-grading |
| Grading | One pure module `js/grade.js` imported by the browser, the validator and the tests | One source of truth for short-answer normalization |
| Auth | None. Name picker only (trust-based study); answers are in the public JSON by decision | REQUIREMENTS Out of Scope |
| Authoring check | `node scripts/validate-quiz.mjs <file> [--sources <records.json>] [--members <members.json>] [--strict]` = thin CLI over pure `scripts/lib/validate-core.mjs`. Exit 0 ok / 1 errors / 2 usage or unreadable | Locked (CONTEXT Stack). Phase 2's skill calls it |
| `--sources` records shape | `{ "records": [ { id, author, date, title, subject, codeBlocks: [string], files: [string] } ] }`, parsed and checked only inside `parseRecords()` / `checkAgainstRecords()` in validate-core | Orchestrator decision 4: a proposal, isolated so Phase 2 can change it |
| Deployment target (dev) | `node scripts/serve.mjs [port]` (default 8080, 127.0.0.1 only, traversal-safe, no clean-URL rewriting, `cache-control: no-store`) → http://127.0.0.1:8080/ | Parity with GitHub Pages (Phase 3). No `.nojekyll` in this phase (orchestrator decision 5) |
| Tests | `node:test` via `node --test "tests/**/*.test.mjs"` (quoted glob; bare `tests/` fails on Node 25). Browser smoke: `node scripts/smoke.mjs [filter]` over the design skill's zero-dependency `cdp.mjs` | Zero dependencies |
| Design gate | `design-taste-frontend` skill for every UI task: sheet reprint (`draw.mjs --show`, seed 990815287), `lint.mjs .`, `inspect.mjs <page>`, screenshot critique per `references/critique.md` (max 3 rounds), motion layer | User mandate (CONTEXT `<design>`) |
| Type | Noto Serif KR 400/500/600 from Google Fonts in Literata's role (redraw recorded in CONTEXT: Literata has no Hangul). Monospace only inside the `pre`/`code` rule | CONTEXT `<design>` |
| Colour | Frost and slate: `--bg #f7f9fa`, `--surface #ecf0f2`, `--ink #1f3038`, `--muted #5d6b72`, `--accent #0d7480`, `--accent-ink #ffffff`. `--muted` never on the `--ink` ground (2.48:1) | CONTEXT `<design>`, RESEARCH Pitfall 5 |
| Shape | One radius token `--radius: 0`; one button style `.button` (flat accent fill, tab-cut top corners via `clip-path`, focus ring kept visible inside the clip) | House rule: one button shape and one radius for the whole site |
| CSP | `<meta http-equiv="Content-Security-Policy">` on both pages: `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Hence no inline scripts and no inline style attributes; CSSOM `el.style.setProperty()` is used for stagger indexes | XSS defence in depth for Phase 2 generated content |
| Directory layout | See below | Pages root = repo root |

```
/                          repo root = Pages root
├── index.html             home (01-01 entry, 01-03 hero, 01-04 sections)
├── quiz.html              exam sheet (01-01 tracer, 01-05 taking state, 01-06 graded state)
├── members.json           { "members": [ { "name", "confirm"?, "note"? } x6 ] }
├── package.json           type=module, scripts only, NO dependencies (01-02)
├── README.md              sample-data notice, names to confirm, run/validate/test (01-02)
├── css/site.css           tokens, base, type, .button, motion helper rules (shared)
├── css/home.css           home only (01-03, 01-04)
├── css/sheet.css          exam sheet only (01-01, 01-05, 01-06)
├── js/grade.js            PURE shared module (browser + Node)
├── js/storage.js          createStore(backendFactory)
├── js/site.js             ROOT, getJson, el, store, loadWeek, loadMembers, renderError (browser)
├── js/boot.js             classic script: adds class "js" to <html> (01-03)
├── js/motion.js           reveal() / stagger() helpers, reduced-motion aware (01-03)
├── js/home.js  js/quiz.js js/result.js   page controllers (result.js from 01-06)
├── assets/                found pictures + credits.json (assets.mjs --get; 01-03/01-04)
├── quizzes/index.json  quizzes/2026-W42.json      SAMPLE DATA
├── scripts/serve.mjs  scripts/smoke.mjs  scripts/smoke/*.smoke.mjs
├── scripts/validate-quiz.mjs  scripts/lib/validate-core.mjs
└── tests/*.test.mjs  tests/fixtures/*.json
```

## Module Contracts (later plans build on these; keep signatures stable)

`js/grade.js` (pure; no DOM, no storage; no regex lookbehind)
- `normalizeAnswer(input) -> string` — NFKC, strip invisible code points, lowercase (not locale), remove all whitespace, drop empty `()` pairs, drop `_`/middle-dot separators between letters/digits, drop trailing `.!?`
- `isBlank(q, given) -> boolean`
- `gradeQuestion(q, given) -> { correct, blank }`
- `gradeSet(set, answers) -> { results: { [qid]: { correct, blank } }, score: { total, concept, code }, max: { total, concept, code } }` (max counted from the set)
- `sourceLabel(source) -> "{author} · {M}/{D}"`
- `explanationLines(text) -> string[]`
- `correctAnswerText(q) -> string` (choice → `choices[answer]`, short → `answer[0]`)
- `sanitizeAnswers(set, raw) -> { [qid]: number | string }` (known ids only; choice integer in range; short string ≤ 200 chars)

`js/storage.js`
- `createStore(backendFactory = () => window.localStorage) -> { persistent, get(key), set(key, value) -> boolean, remove(key), keys(prefix) -> string[] }`

`js/site.js` (browser)
- `ROOT`, `getJson(path)`, `el(tag, props, ...children)`, `store`, `loadWeek(requestedId) -> { weeks, entry, set }`, `loadMembers() -> [{ name, confirm }]`, `renderError(container, message, { retry, link })`

`js/motion.js` (from 01-03)
- `reveal(root = document)` — adds `.is-in` to `[data-reveal]` once in view; safety net after load
- `stagger(container, selector)` — sets `--i` on matched children via `style.setProperty`

`scripts/lib/validate-core.mjs` (from 01-02)
- `validateSet(set, ctx) -> { errors: [{ path, message }], warnings: [...] }`, `validateIndex(index, ctx)`, `memberNames(membersJson)`, `parseRecords(json)`, `checkAgainstRecords(set, records)`

## Stored Shapes

```
srq:member            { "v": 1, "name": "이주현" }
srq:draft:2026-W42    { "v": 1, "member": "이주현", "answers": { "q1": 2, "q3": "isna().sum()" }, "updatedAt": "<ISO>" }   (removed on submit)
srq:attempt:2026-W42  { "v": 1, "setId": "2026-W42", "member": "이주현", "submittedAt": "<ISO>",
                        "answers": { ... }, "results": { "q1": { "correct": true, "blank": false }, ... },
                        "score": { "total": 7, "concept": 5, "code": 2 } }   (written once; never overwritten in Phase 1)
```

## DOM Hook Contract (smoke scenarios depend on these; every plan keeps them)

Home (`index.html`)
- `#week-title` — text equals `index[0].title`
- `input[type=radio][name="member"]` — one per member, `value` = name
- `#start` — `<button type="button">`; with no member chosen it shows `#start-hint` and stays; otherwise stores `srq:member` and opens `quiz.html?set=<id>`
- `#past-weeks` — present with the `hidden` attribute until Phase 4

Sheet (`quiz.html`)
- `#sheet-title` (the `h1`), `select#sheet-member` (성명 field), `ol#sheet`
- `li.q` with `id` = question id, `data-qid`, `data-kind` (`concept` | `code`); grid lives on the inner `.q-body`
- choice: `input[type=radio][name="<qid>"][value="<index>"]` inside labels; short: `input#<qid>-a[type=text][name="<qid>"]`
- code: `pre.code#<qid>-code > code` (textContent = JSON `code` verbatim)
- `#submit` (`type="button"`), `#status` (`role="status"`), `#storage-notice` (01-05)
- `dialog#confirm` with `#blank-count`, `button[value="cancel"]`, `button[value="submit"]` (01-06)
- graded: `section#score` > `#score-heading` + `[data-score="total"|"concept"|"code"]`, `#attempt-member` (01-06); per question `section.q-result[data-result="correct"|"wrong"]` placed before the question's fieldset/label inside the `li`
- `location.hash` naming a question id scrolls to it after render (used by 01-04's spines)

## Stack Touched in Phase 1

- [x] Project scaffold — static pages, `package.json` (type=module, no deps), design lint + inspector, `node:test` runner, smoke runner
- [x] Routing — `index.html` and `quiz.html?set=<id>` (id resolved only through `quizzes/index.json`)
- [x] Database — real reads (`quizzes/*.json`, `members.json`, `srq:*`) and real writes (`srq:member`, `srq:draft:*`, `srq:attempt:*`)
- [x] UI — name picker → 풀기 시작 → answer → 답안 제출 → graded in place
- [x] Deployment — documented local run `node scripts/serve.mjs` → http://127.0.0.1:8080/ (GitHub Pages is Phase 3)

## Out of Scope (Deferred to Later Slices)

- GitHub Pages deploy, `.nojekyll` decision, README weekly routine → Phase 3
- Generation skill (Notion export → set), real `--sources` records produced from Notion → Phase 2
- 지난 주차 list, 내가 틀린 문제, retry that does not touch the first attempt, per-member attempt keys → Phase 4
- 결과 보내기 (Google Form), "6명 중 N명 정답", 전체 정답률 낮은 문제 → Phase 5
- Essay / self-graded questions (never; user decision)

## Subsequent Slice Plan

- Phase 2: 승환 runs "이번 주 퀴즈 만들어 줘" and gets a validator-passing set built from that week's Notion export (writes `quizzes/<id>.json` + a `--sources` records file)
- Phase 3: the same files go live on GitHub Pages; the skill appends to `quizzes/index.json` and pushes
- Phase 4: review tabs read `store.keys('attempt:')`; past weeks come from `quizzes/index.json`; `#past-weeks` loses `hidden`
- Phase 5: the graded sheet gains 결과 보내기 (prefilled Google Form from `attempt.results`) and team stats JSON
