# Phase 1: quiz-core — Context

**Gathered:** 2026-10-16
**Status:** Ready for planning
**Source:** User decisions in session + design-taste-frontend direction sheet (`.taste-skill/direction.json`, seed 990815287)

<domain>
## Phase Boundary

A static site (no build step, plain HTML/CSS/JS) where a study member opens the page, picks their name, takes this week's 10-question set, and on submit sees instant grading with answer, ≤5-line explanation and sources above each question. Plus the quiz JSON format, a weekly index file, and a Node validator script. Runs locally (served over a local static server). Deployment (GitHub Pages), the generation skill, review tabs and team stats are LATER phases — do not build them here, but do not paint them into a corner (e.g. keep attempt storage keyed so Phase 4 can list wrong answers across weeks).

Requirements: FMT-01..05, QUIZ-01..05, RSLT-01..05, DSGN-01..02.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Stack
- Plain HTML + CSS + vanilla JS (ES modules OK), **no bundler, no framework, no npm runtime deps for the site**. Must work when served by GitHub Pages from the repo root (relative paths only).
- Validator: a Node script (`scripts/validate-quiz.mjs`, Node 22+, zero dependencies) — `node scripts/validate-quiz.mjs quizzes/<week>.json [--sources <sources.json>]`, exits non-zero with human-readable Korean messages per error.
- Local preview: any static server (e.g. `npx --yes serve .` or a tiny `scripts/serve.mjs`). Opening `index.html` via file:// is not required to work (fetch of JSON needs http).

### Data format
- `quizzes/index.json`: list of weeks `{ id: "2026-W42", title, published: "2026-10-16", file: "quizzes/2026-W42.json" }`, newest first; the site treats the first as "이번 주".
- `quizzes/<id>.json` (one set): `{ id, title, range: {from, to}, estimatedMinutes, sources: [{ id, author, date, title, subject }], questions: [10] }`.
- Question: `{ id: "q1", kind: "concept" | "code", type: "choice" | "short", prompt, code?: string (verbatim, only for kind=code), choices?: [4 strings], answer: index (choice) | string[] accepted answers (short), explanation: string (≤5 lines), concept: { name, ref } (e.g. {name:"groupby", ref:"pandas 공식 문서 · GroupBy"}), sourceIds: [source id] | file?: string }`.
- Exactly 10 questions: 7 `concept` + 3 `code`. Types: only `choice` and `short` (NO essay / self-grading — user decision).
- Source label shown to users is built by the site from `sources[]` as `"{author} · {M/D}"` (e.g. "이주현 · 10/14") — never stored as free text in a question.
- `members.json`: the 6 member display names for the name picker (placeholder names until the user confirms; calendar screenshot shows 김준수, 송지…, 노아…, 이주현, 차승환, 정보경… — confirm full names with user).

### Grading
- choice: selected index === answer.
- short: normalize both sides — trim, collapse internal whitespace, remove all spaces for comparison, lowercase, NFKC (full-width → half-width) — then match against any accepted answer.
- Score: total /10 plus 개념 /7 and 코드 분석 /3.

### Attempt storage (localStorage)
- Key namespace `srq:` . Draft answers autosave per set (`srq:draft:<setId>`), first submitted attempt frozen (`srq:attempt:<setId>` = { member, answers, results, submittedAt }). Chosen member in `srq:member`.
- After submit, reopening the set shows the frozen result (retry behaviour comes in Phase 4).
- All localStorage access wrapped in try/catch; page still works (without persistence) if storage is unavailable.

### Sample content
- Ship one realistic sample set `quizzes/2026-W42.json` modelled on the Notion template (핵심 개념 / 내 말로 설명 / 직접 작성한 코드 / 어려웠던 내용·막힌 이유 / 해결 방법) for a data-analysis study (Python, Pandas, 데이터 시각화, 데이터 분석, 머신러닝), dated 2026-10-13..10-16, with 7 concept + 3 code questions, Korean, realistic distractors drawn from "막힌 이유". Mark clearly in README that it is sample data.
- Also ship 2–3 deliberately broken fixture sets under `tests/fixtures/` that the validator must reject (wrong count, 3 choices, answer out of range, unknown sourceId, explanation > 5 lines).

### Language
- All UI copy, questions, explanations in Korean (DSGN-02). `<html lang="ko">`.
</decisions>

<design>
## Design Direction (LOCKED) — design-taste-frontend

**The user explicitly asked that every screen be made with the `design-taste-frontend` skill.** Executors building any UI MUST invoke the `design-taste-frontend` skill (Skill tool) before writing markup/CSS, follow its house rules, and run its gate before finishing:
```
node .claude/skills/design-taste-frontend/scripts/lint.mjs <site files>
node .claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:<port>/
```
Fix every FAIL; screenshots at 1440/768/390 land in `.taste-skill/inspect/` and must be looked at (critique per `references/critique.md`). Reprint the sheet with `node .claude/skills/design-taste-frontend/scripts/draw.mjs --show`.

**Direction:** "The page is the object" (seed 990815287). Hero blueprint: *Tabbed folder stack*. Palette: *Frost and slate*. Sections: list (Giant word, filled bar rows) → how-it-works (Itinerary on a slip) → work (Book-spine index) → footer (The back of the card). Signature motion: *Index with preview*.

**Idea sentence:** On this page, **this week's six members' Notion review entries (the folders of 개인 복습 기록)** become **a stack of tabbed file folders — each back folder's tab carries a member's name, and the open front folder is this week's 시험지 (exam sheet)**.
- Competitor test: another quiz site has no "이주현 · 10/14 · Pandas groupby" folders; the sources ARE the material.
- **Live thing:** the exam sheet itself — picking answers fills the sheet; on submit the sheet is graded in place (correct / wrong marks set in the margin of each question, answer + explanation + source revealed above each question). On the home page, pointing at (or tapping) a member's folder tab previews which of this week's entries (title · date · subject) the questions came from (the "Index with preview" move).

**Type — redraw recorded:** dealt Literata has **no Hangul**, and the whole UI is Korean (stated constraint) → use **Noto Serif KR** (Google Fonts, weights 400/500/600) in Literata's role and settings: display weight 500, tracking -0.02em, leading 1.05; text 400, leading 1.6. One family only. Code blocks (`<pre><code>`) are the only place monospace is allowed (system mono stack). Type steps:
```css
--step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem);  /* never below 13px */
--step-body:  clamp(1.125rem, 1.05rem + 0.3vw, 1.3125rem);
--step-lead:  clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem);
--step-head:  clamp(2rem, 1.3rem + 3.2vw, 4rem);
/* hero display from the blueprint: clamp(96px, 10vw, 160px) for a ≤12-char Korean line, e.g. "이번 주 시험지" */
```

**Colour — Frost and slate:**
```css
--bg:#f7f9fa; --surface:#ecf0f2; --ink:#1f3038; --muted:#5d6b72; --accent:#0d7480; --accent-ink:#ffffff;
```
Hero ground is dark (use `--ink` as the folder-stack ground; folders are flat bands in surface/bg tones plus 3–4 flat folder colours derived for tabs — keep within a two/three-ink print feel). Accent (teal) once per screen: the primary action. Correct/incorrect marks: use ink and accent with a shape difference (filled circle vs. slash), not a new red.

**Composition notes per screen:**
- **Home (index.html):** dark ground, slim top row (wordmark "스터디 복습 퀴즈" centred, one link right "지난 주차" — disabled/hidden until Phase 4 or links to #), centred one-line headline, one supporting sentence (week, 10문제, 약 15분, N개 기록 · 6명). From ~51% height: folder stack, back folders = members (tab = name), front open folder = this week's sheet with the name picker + single "풀기 시작" button. Below: list section (giant word "출처" / 이번 주 기록 — filled bar rows per member as `<details>`, entries listed date-right with tabular figures), how-it-works as the itinerary slip (월~목 각자 기록 → 금 출제 → 풀기 약 15분 → 제출하면 바로 채점·해설; final inverted row = "손에 남는 것: 점수, 해설, 틀린 문제"), footer as the back of the card (sign-off, credits line for found pictures, imprint).
- **Quiz (exam sheet):** the sheet is a tall paper panel on the contrasting ground with real edges (notched/perforated via clip-path or round-dot borders ≥4px, never 1px outlines). Questions in tidy aligned columns like a printed exam; numbers shown by position/size, NOT "01/02" index labels (house rule) — use a real `<ol>`. Code questions: `<pre><code>` with preserved whitespace, horizontal scroll on phone. Choice answers as large thumb-sized targets (radio inputs, real labels). Short answer: text input. Sticky-free; a submit block at the end with blank-count confirmation (dialog).
- **Result:** same sheet, graded in place: above each question a result block (정답/오답 mark, 정답, ≤5-line 해설, 개념 출처, 노션 출처 "작성자 · 날짜"). Score summary at the top of the sheet (총점 /10, 개념 /7, 코드 분석 /3).

**Imagery:** floor of ≥4 real pictures (inspector checks). Plan: find archival pictures of the world of data analysis and study via `node .claude/skills/design-taste-frontend/scripts/assets.mjs "<query>"` — e.g. Hollerith punch cards / tabulating machine (origin of data processing), census tabulation, library card catalogue drawers (folders/index), exam answer sheets, early statistical charts (Playfair, Nightingale). Download with `--get`, credit on the page (footer), never presented as the members. If network fails, draw in code and say so.

**House rules (inspector-enforced):** headlines ≤2 lines at every width; no eyebrows/pill badges; no monospace outside code; no 01/02/03 numbering; no thin rules/1px boxes; no gradients; no shadows at rest; no glass; no emoji; no icon cards / identical card rows; ≤2 typefaces; running text in full ink ≥16px; one button shape and one radius for the whole site; motion layer (≥8 moving elements, reduced-motion fallback) per SKILL.md step 9.
</design>

<canonical_refs>
## Canonical References
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- `.claude/skills/design-taste-frontend/SKILL.md` and its `references/` (copy, type, colour, layout, imagery, motion, critique)
- `.taste-skill/direction.json` — the dealt direction (reprint with `draw.mjs --show`)
- User screenshots of Notion "개인 복습 기록" template (described in PROJECT.md Context)
</canonical_refs>

<specifics>
## Specific Ideas
- Name picker: the 6 names as large tappable options on the front folder; remembered in localStorage.
- Estimated time shown from `estimatedMinutes`.
- Code blocks must keep indentation exactly (verbatim from Notion).
- Phone width 390px must be fully usable with a thumb.
</specifics>

<deferred>
## Deferred Ideas
- 지난 주차 list, 내가 틀린 문제 tab, retry → Phase 4
- 결과 보내기 (Google Form), 6명 중 N명 정답, 전체 정답률 낮은 문제 → Phase 5
- GitHub Pages deploy, README weekly routine → Phase 3
- Generation skill → Phase 2
</deferred>

---
*Phase: 01-quiz-core*
*Context gathered: 2026-10-16*
