---
phase: 01-quiz-core
verified: 2026-10-16T13:05:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/01-quiz-core/01-01-PLAN.md"
  - ".planning/phases/01-quiz-core/01-01-SUMMARY.md"
  - ".planning/phases/01-quiz-core/01-02-PLAN.md"
  - ".planning/phases/01-quiz-core/01-02-SUMMARY.md"
  - ".planning/phases/01-quiz-core/01-03-PLAN.md"
  - ".planning/phases/01-quiz-core/01-03-SUMMARY.md"
  - ".planning/phases/01-quiz-core/01-04-PLAN.md"
  - ".planning/phases/01-quiz-core/01-04-SUMMARY.md"
  - ".planning/phases/01-quiz-core/01-05-PLAN.md"
  - ".planning/phases/01-quiz-core/01-05-SUMMARY.md"
  - ".planning/phases/01-quiz-core/01-06-PLAN.md"
  - ".planning/phases/01-quiz-core/01-06-SUMMARY.md"
  - "README.md"
  - "css/home.css"
  - "css/sheet.css"
  - "css/site.css"
  - "index.html"
  - "js/grade.js"
  - "js/home.js"
  - "js/motion.js"
  - "js/quiz.js"
  - "js/result.js"
  - "js/site.js"
  - "js/storage.js"
  - "members.json"
  - "package.json"
  - "quiz.html"
  - "quizzes/2026-W42.json"
  - "quizzes/index.json"
  - "scripts/lib/validate-core.mjs"
  - "scripts/validate-quiz.mjs"
covered_digest: "v3:sha256:c2716ff3ba419d26ba75369f934b08b9d586956c81d69527f139303cfc02d869"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Phone thumb check: open the served site on a real phone (or a device with touch), pick a name, answer all ten questions, scroll the code blocks sideways, open and dismiss the confirm dialog, submit."
    expected: "Every name option and answer bar is comfortably tappable with a thumb, code blocks scroll sideways inside their box without the page scrolling sideways, the dialog buttons are reachable, and the graded sheet is readable."
    why_human: "Automated checks only prove the measured target heights (48px minimum on the sheet, no horizontal overflow at 390px). Real thumb reach, IME (Hangul) typing in the short-answer fields and mobile Safari/Chrome behaviour need a physical device."
  - test: "Reduced-motion feel: turn on 'reduce motion' in the OS, then load index.html and quiz.html (taking and graded states)."
    expected: "Everything is visible and still from the first paint; nothing is hidden waiting for an animation; with motion on, entrances feel deliberate rather than slow or janky."
    why_human: "The smoke suite checks the structural fallback (hidden states only inside prefers-reduced-motion: no-preference); the felt quality of the motion layer is a judgment call."
  - test: "Read all ten questions of quizzes/2026-W42.json on the sheet (and their explanations in the graded view)."
    expected: "Questions are sensible Korean, one defensible answer each, distractors plausible, code snippets correct and consistent with their explanations, nothing misleading for a study group."
    why_human: "The validator and tests prove shape (7+3, 4 choices, answer range, <=5 explanation lines, source format), not whether a question is good or technically correct."
  - test: "Confirm the three placeholder member names in members.json ('스터디원 4', '스터디원 5', '스터디원 6'; flagged confirm:true) with the user and replace them."
    expected: "The six real names appear in the name picker, on the folder tabs and in the 출처 bars."
    why_human: "Requires the user's knowledge of the real names (CONTEXT: calendar screenshot shows 송지…, 노아…, 정보경… only partially). Not a code defect, but visible on the first screen."
  - test: "Design-taste critique of the three screens (home, taking sheet, graded sheet) at 1440 / 768 / 390 against references/critique.md, using .taste-skill/inspect/*.jpg."
    expected: "One consistent direction ('The page is the object'), no generic or templated feel; the two defended inspector WARNs (no-footage on all pages, first-action on the quiz pages) are acceptable to the user."
    why_human: "The inspector reports 0 FAIL, which is the floor not the grade; taste is a human call."
---

# Phase 1: quiz-core Verification Report

**Phase Goal:** 스터디원이 한 주 세트를 풀고 제출하면 즉시 채점되어 정답·5줄 해설·출처를 보는 정적 사이트가, 정해진 JSON 형식과 검사 스크립트 위에서 동작한다
**Verified:** 2026-10-16T13:05:00Z
**Status:** human_needed (all automated and independent checks pass; five human-judgment items remain)
**Re-verification:** No, initial verification

## Commands I ran myself (from C:/Users/User/Desktop/Claude)

| Command | Result |
| ------- | ------ |
| `npm run check` | exit 0. 94 tests, 94 pass, 0 fail. `validate`: week list passes, `quizzes/2026-W42.json` passes (10 questions, 개념 7 / 코드 분석 3, 6 sources). `lint:design`: 0 FAIL, 0 WARN on 13 files |
| `node scripts/smoke.mjs` | exit 0. `PASS skeleton / home / result / sheet`, `SMOKE: 4 passed, 0 failed` (real-browser CDP runs) |
| `node .claude/skills/design-taste-frontend/scripts/inspect.mjs index.html` | exit 0, `RESULT: 0 FAIL, 1 WARN` (no-footage). No `--allow` |
| `node .claude/skills/design-taste-frontend/scripts/inspect.mjs quiz.html` | exit 0, `RESULT: 0 FAIL, 2 WARN` (first-action, no-footage). No `--allow` |
| `node scripts/inspect-url.mjs "quiz.html?set=2026-W42&review=graded"` | exit 0, `RESULT: 0 FAIL, 2 WARN` (first-action, no-footage). No `--allow` |
| `node scripts/validate-quiz.mjs tests/fixtures/broken-structure.json` | exit 1, four Korean located errors (count 9, mix 6+3, 3 choices, answer 4) |
| `node scripts/validate-quiz.mjs tests/fixtures/broken-sources.json` | exit 1, four Korean located errors (bad date, unknown author, unknown sourceId s9, 6-line explanation) |
| `node scripts/validate-quiz.mjs quizzes/2026-W42.json --sources tests/fixtures/records-2026-W42.json` | exit 0 |
| `grep -rn -- "--allow" package.json scripts` | no match: no script or smoke relies on an inspector allowance |

Independent agent-browser pass (served on 127.0.0.1:8123, server killed afterwards), viewport 390x844:
- Home: `lang=ko`, h1 "이번 주 시험지", six name radios from members.json, no horizontal overflow, 풀기 시작 inside the first screen (top 753px of 844).
- Picked 이주현, 풀기 시작 landed on `quiz.html?set=2026-W42` with the name preselected, 10 `li.q` in a real `ol#sheet` (7 concept, 3 code), code in monospace with `white-space: pre`, smallest choice bar 48px, no overflow.
- Answered q2, q4 (choice) and q3, q6, q9 (short, including ` ISNA().SUM ` and `Median`), reloaded: choices and typed answers restored from `srq:draft:2026-W42`.
- 답안 제출 opened the dialog stating "비어 있는 문항이 8개 있어요"; 돌아가서 마저 풀기 changed nothing (no graded state, draft intact); 제출하기 graded: 10문제 중 5문제 정답, 개념 4/7, 코드 분석 1/3, which matches the answers given (q2, q3, q4, q6 correct, q9 correct). Case/space/`()` variants graded correct.
- Every question shows a result block above it: 정답/오답 verdict with mark, 정답, (other accepted answers), 내 답, 4 explanation lines (max 4 across the set, limit 5), 관련 개념 "groupby · pandas 공식 문서 · GroupBy", 노션 출처 "김준수 · 10/13 · …", and 실습 파일 for q8.
- Reload after submit: same graded sheet, no 답안 제출 button, inputs disabled, `srq:draft` removed, `srq:attempt:2026-W42` holds the frozen score.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the contract)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Opening the site locally shows the sample set (10 questions, 개념 7 + 코드 분석 3), a name can be picked, and it can be solved to the end at desktop and mobile widths | ✓ VERIFIED | My 390px agent-browser run (home, name pick, sheet with 10 `li.q`, 7 concept / 3 code, no overflow, 48px targets); inspect at 1440/768/390 for both pages exit 0; sheet/home smoke pass. Real-device thumb use is human item 1 |
| 2 | Draft answers survive a reload; the blank-question count is confirmed before submit; submitting freezes the first attempt | ✓ VERIFIED | `js/quiz.js` `setupDraft` (debounced autosave to `draft:<id>`, flush on visibilitychange/pagehide, restore through `sanitizeAnswers`); `confirmSubmit` native dialog with blank count; `doSubmit` writes `attempt:<id>` once and re-reads an existing attempt before ever overwriting. Confirmed live: reload restored answers, cancel changed nothing, submit froze, reload showed the frozen result. Result smoke covers dialog, freeze, tampered storage |
| 3 | Instant auto-grading of choice and short answers (short ignores spaces/case); above each question: correctness, answer, <=5-line explanation, concept source, "작성자 · 날짜" source | ✓ VERIFIED | `js/grade.js` `gradeSet` / `normalizeAnswer` (NFKC, invisible chars, lowercase, whitespace, `()`, separators, trailing punctuation), pinned by `tests/grade.test.mjs`; `js/result.js` `renderResultBlock` prepended above each question by `showGraded`. Live run output above matches the format exactly |
| 4 | The checker passes the correct sample and rejects deliberately broken samples (count, mix, choice count, answer range, source format) saying where | ✓ VERIFIED | `scripts/validate-quiz.mjs` + `scripts/lib/validate-core.mjs`; I ran the CLI on the sample (exit 0), both broken fixtures (exit 1 with located Korean messages: `questions[0] (q1): 객관식 보기는 4개여야 합니다 (현재 3개)` etc.) and `--sources` cross-check; 94 tests incl. `tests/cli.test.mjs` |
| 5 | Home, quiz and result screens share one design-taste-frontend direction and all copy is Korean | ✓ VERIFIED (visual judgment is human item 5) | `inspect.mjs` 0 FAIL on index.html, quiz.html and the graded view, no `--allow`; `lint.mjs` 0 FAIL / 0 WARN; one direction recorded (seed 990815287, Frost and slate, Noto Serif KR); screenshots viewed; `lang="ko"` on both pages; remaining Latin text on the pages is image credit titles and licence names only |

**Score:** 5/5 truths verified, 0 present-but-behavior-unverified. Behavior-dependent truths (draft restore, first-attempt freeze, dialog cancel) have real-browser evidence both from the smoke suite and from my own run.

### Design-skill mandate

The user required every screen to be built with design-taste-frontend. The SUMMARYs record it:
- 01-01, 01-03, 01-04, 01-05, 01-06 each state "skill `design-taste-frontend` invoked and the sheet reprinted with `draw.mjs --show`" at the start of each task (01-04 four times), with direction "The page is the object", seed 990815287.
- 01-02 touched no UI (validator, tests, README) and records that the mandate did not trigger; `lint.mjs` still 0 FAIL.
- Interim `--allow few-pictures,still-page,empty-screens` in 01-01 and `--allow few-pictures,empty-screens` in 01-03 were explicitly scheduled to be closed; 01-04/01-05/01-06 run with none, and I re-ran all three gates with no `--allow` myself: 0 FAIL.
- Defended WARNs (01-06 SUMMARY lines 221-223): `first-action` on quiz pages (the sheet's one action, 답안 제출, correctly sits after the ten questions) and `no-footage` (no honest clip for the subject; a scroll-linked plate drift is the moving picture). I judge these defensible; the user may disagree (human item 5).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `js/grade.js` | pure grading, label, sanitize | ✓ VERIFIED | 91 lines, no DOM; imported by quiz.js, result.js, home.js and validate-core.mjs |
| `js/storage.js` | `srq:` store with memory fallback | ✓ VERIFIED | 72 lines; never throws; `persistent` flag drives the Korean storage notice |
| `js/quiz.js` | sheet, draft, dialog, freeze, graded render | ✓ VERIFIED | 611 lines, all paths exercised live |
| `js/result.js` | `renderScore`, `renderResultBlock` | ✓ VERIFIED | 75 lines, used by `showGraded` |
| `js/home.js`, `js/motion.js`, `js/site.js`, `js/boot.js` | home render, motion helpers, loaders | ✓ VERIFIED | home smoke passes; `reveal`/`stagger` imported by home.js and quiz.js |
| `quizzes/2026-W42.json`, `quizzes/index.json`, `members.json` | sample set, week list, six names | ✓ VERIFIED | 7 concept + 3 code, 6 sources, 4-line explanations, code verbatim; three member names are placeholders flagged `confirm:true` |
| `scripts/validate-quiz.mjs`, `scripts/lib/validate-core.mjs` | checker CLI + pure core | ✓ VERIFIED | see Truth 4 |
| `scripts/serve.mjs`, `scripts/smoke.mjs`, `scripts/smoke/*.mjs`, `scripts/inspect-url.mjs` | local server and real-browser checks | ✓ VERIFIED | all run green |
| `tests/*.test.mjs`, `tests/fixtures/*` | 94 tests, 2 broken fixtures + records | ✓ VERIFIED | CONTEXT asked for 2-3 broken fixtures; 2 broken files cover count, mix, 3 choices, answer range, unknown sourceId, bad date, unknown author and 6-line explanation (all five required cases) |
| `index.html`, `quiz.html`, `css/*.css`, `assets/*` | pages, styles, 8 credited pictures | ✓ VERIFIED | `assets/credits.json` plus on-page credit lines |
| `README.md`, `package.json` | sample-data notice, commands, scripts | ✓ VERIFIED | `npm run check` composes test + validate + lint |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `js/quiz.js` | `quizzes/index.json` | `loadWeek()` resolves `?set=` only through index | ✓ WIRED (live: `?set=2026-W42` loads) |
| `js/quiz.js` | `js/grade.js` | `gradeSet`, `isBlank`, `sanitizeAnswers` | ✓ WIRED |
| `js/quiz.js` | `js/storage.js` | `draft:` / `attempt:` keys, `store.remove('draft:…')` on submit | ✓ WIRED (localStorage keys inspected live) |
| `js/quiz.js` | `js/result.js` | `renderResultBlock`, `renderScore` in `showGraded` | ✓ WIRED |
| `js/quiz.js` | `dialog#confirm` | `confirmSubmit` -> `showModal()` -> close with `returnValue==='submit'` | ✓ WIRED (live) |
| `js/home.js` | `members.json`, `quiz.html?set=` | name radios, `#start` | ✓ WIRED (live) |
| `scripts/lib/validate-core.mjs` | `js/grade.js` | shared `normalizeAnswer`, `explanationLines` | ✓ WIRED |
| `js/home.js` spines | `quiz.html#qN` | `focusFromHash` | ✓ WIRED (home + result smoke) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| Result blocks | verdict, answer, explanation, concept, source | `quizzes/2026-W42.json` via `loadWeek`, `set.sources[]` for the label | Yes (live output shows the real strings) | ✓ FLOWING |
| Score panel | 총점 / 개념 / 코드 분석 | `gradeSet` over stored answers | Yes (5 = 4 + 1 matched the answers given) | ✓ FLOWING |
| Home folder preview, 출처 bars, spines | per-author entries, question counts | the same set JSON | Yes (home smoke) | ✓ FLOWING |
| Name picker | six names | `members.json` | Yes (three are placeholders, see human item 4) | ✓ FLOWING |

### Behavioral Spot-Checks

All covered by the table at the top (suite, smoke, CLI, and the live 390px flow). No server left running: PID 27512 killed, port 8123 no longer listening.

### Probe Execution

No `probe-*.sh` declared or present. Step skipped; `scripts/smoke.mjs` is the phase's runnable check and was run above.

### Requirements Coverage

Union of PLAN frontmatter `requirements:` (01: FMT-01/02/03/05, QUIZ-01/02, RSLT-01/05, DSGN-02; 02: FMT-01..05, RSLT-01/03; 03: DSGN-01/02, QUIZ-01/05, FMT-05; 04: DSGN-01/02, FMT-05, QUIZ-05; 05: QUIZ-02/03/05, DSGN-01/02; 06: QUIZ-04, RSLT-01..05, DSGN-01/02) covers all 17 IDs from the task. REQUIREMENTS.md maps exactly these 17 to Phase 1; no orphans.

| Requirement | Source Plan(s) | Status | Evidence |
| ----------- | -------------- | ------ | -------- |
| FMT-01 | 01, 02 | ✓ SATISFIED | one JSON per week with id, range, sources, 10 questions |
| FMT-02 | 01, 02 | ✓ SATISFIED | choice (4 options, one answer) or short (accepted list); validator enforces |
| FMT-03 | 01, 02 | ✓ SATISFIED | kind, prompt, verbatim code, answer, explanation, concept {name, ref}, sourceIds or file |
| FMT-04 | 02 | ✓ SATISFIED | CLI + core: 10 / 7+3 / 4 unique choices / range / short >=1 / <=5 lines / source exists / code equals record via `--sources` |
| FMT-05 | 01, 02, 03, 04 | ✓ SATISFIED | `quizzes/index.json`, `validateIndex`, `loadWeek`; home treats first entry as this week |
| QUIZ-01 | 01, 03 | ✓ SATISFIED | no login, six-name picker remembered in `srq:member` |
| QUIZ-02 | 01, 05 | ✓ SATISFIED | one ordered list, monospace `pre` with preserved whitespace |
| QUIZ-03 | 05 | ✓ SATISFIED | draft autosave/restore verified live |
| QUIZ-04 | 06 | ✓ SATISFIED | blank-count dialog, frozen first attempt verified live |
| QUIZ-05 | 03, 04, 05 | ✓ SATISFIED (device check pending) | 390px: no overflow, 48px targets; human item 1 |
| RSLT-01 | 01, 02, 06 | ✓ SATISFIED | `gradeSet` + 26-case normalizer tests |
| RSLT-02 | 06 | ✓ SATISFIED | verdict + 정답 above each question |
| RSLT-03 | 02, 06 | ✓ SATISFIED | explanation lines, max 4 in sample, validator cap 5 |
| RSLT-04 | 06 | ✓ SATISFIED | 관련 개념 name + ref, 노션 출처 "작성자 · M/D", 실습 파일 |
| RSLT-05 | 01, 06 | ✓ SATISFIED | 총점 / 개념 / 코드 분석 panel |
| DSGN-01 | 03-06 | ✓ SATISFIED (taste pending) | inspector 0 FAIL, lint clean, skill invocation recorded; human item 5 |
| DSGN-02 | 01, 03-06 | ✓ SATISFIED | `lang="ko"`, all copy Korean |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | `TBD`/`FIXME`/`XXX` grep over js, css, scripts, tests, html, README, members, quizzes: no matches. `TODO`/`HACK`/`PLACEHOLDER` over js, css, scripts, html: no matches | - | no debt markers; no stubs found in read code |

Observations (not gaps):
- `members.json` ships three placeholder names (flagged `confirm:true`, noted in README). Documented, user-input dependent (human item 4).
- During my live run the very first radio click right after a fresh load did not register; a repeat click on the same control (and all later clicks, after reload and after a 2.5s wait) registered and persisted. I attribute it to the automation clicking an element still sliding in during its entrance animation, not to a defect, and cannot rule on it without a real device. Folded into human items 1 and 2.
- Fonts load from Google Fonts (allowed in the CSP); offline the page falls back to a system serif. Acceptable for a static site, worth knowing.
- `.claude/skills/`, `skills-lock.json`, `.planning/WINDOWS.md`, `.planning/milestone.lock`, `.planning/state.json`, `.planning/config.json` (modified) are untracked or modified in the working tree and are intentionally not staged.

### Human Verification Required

1. **Phone thumb check.** Test: on a real phone, pick a name, answer all ten (Hangul IME in the short fields), scroll the code blocks sideways, open and dismiss the dialog, submit. Expected: comfortable thumb targets, no page-level sideways scroll, readable graded sheet. Why human: only measured sizes and emulated 390px were checked.
2. **Reduced-motion feel.** Test: OS reduce-motion on, load home, sheet, graded sheet; then motion on. Expected: everything visible and still, and the motion layer feels intentional. Why human: structural fallback is automated, feel is not.
3. **Read all ten questions.** Test: read the questions, distractors, code and explanations. Expected: technically correct, one defensible answer each. Why human: validators check shape, not quality.
4. **Confirm member names.** Test: replace the three `스터디원 N` placeholders. Expected: real names across the picker, tabs and bars. Why human: needs the user.
5. **Design taste review and WARN acceptance.** Test: look at `.taste-skill/inspect/*.jpg` against `references/critique.md`; accept or reject the defended `no-footage` and `first-action` WARNs. Expected: one coherent, non-generic direction. Why human: 0 FAIL is the floor, not the grade.

### Gaps Summary

No gaps. Every ROADMAP success criterion and all 17 requirement IDs are satisfied by code I read and behavior I exercised in a real browser, the checks the task named all exit 0, the design-skill invocation is recorded in every UI plan, and the final inspector gates pass with no `--allow`. The phase is `human_needed` only because the user's mandated device, motion-feel, content-reading, naming and taste checks cannot be settled by automation.

---

_Verified: 2026-10-16T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
