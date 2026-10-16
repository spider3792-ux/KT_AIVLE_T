---
phase: 01-quiz-core
plan: 01
subsystem: ui
tags: [static-site, vanilla-es-modules, localstorage, grading, node-smoke, design-taste-frontend]

requires: []
provides:
  - "Walking skeleton: serve.mjs -> JSON (index, set, members) -> ES modules -> exam sheet -> pure grading -> localStorage -> frozen reopen, proven by a real-browser smoke run"
  - "Module contracts of SKELETON.md: js/grade.js, js/storage.js, js/site.js"
  - "DOM hook contract for home (#week-title, input[name=member], #start, #start-hint, #past-weeks) and sheet (#sheet-title, select#sheet-member, ol#sheet, li.q, pre.code, #submit, #status, section#score, section.q-result)"
  - "SAMPLE DATA: quizzes/2026-W42.json (10 questions, 7 concept + 3 code, 6 sources), quizzes/index.json, members.json (6 names)"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, phase-02, phase-04, phase-05]

actuals:
  tokens: 15300
  tasks: 3
  commits: 3

commits: 3
plan_head_before: 2337f7df55fc5c728fb4c7ee0cf15e445982e913
plan_head_after: 4914c8bcab09acaa668380a62d0726e6cc2771dd

tech-stack:
  added: []
  patterns:
    - "Zero dependencies: platform ES modules, node:http server, CDP smoke over the design skill's cdp.mjs"
    - "All data reaches the DOM through el() (createElement + textContent); no HTML-string sinks"
    - "Stored data is untrusted on read: {v:1} check, sanitizeAnswers, stored results used only for known ids"
    - "Module-relative ROOT + getJson(): works on a Pages sub-path; ?set= resolved only through quizzes/index.json"
    - "CSP meta on both pages; no inline scripts or style attributes"

key-files:
  created:
    - scripts/serve.mjs
    - scripts/smoke.mjs
    - quizzes/index.json
    - quizzes/2026-W42.json
    - members.json
    - js/grade.js
    - js/storage.js
    - js/site.js
    - js/quiz.js
    - js/home.js
    - css/site.css
    - css/sheet.css
    - quiz.html
    - index.html
    - .gitignore
  modified: []

key-decisions:
  - "Noto Serif KR stands in Literata's role (recorded redraw): Literata has no Hangul and the whole UI is Korean"
  - "Home rules live in a commented HOME block in css/site.css; plan 01-03 moves them to css/home.css"
  - "#start, #start-hint and the member fieldset are static markup in index.html (JS fills and wires them), so the hook exists without script"
  - "Sheet rejects grading until a 성명 is chosen, but only when members.json actually loaded (a members.json failure never blocks the sheet)"
  - "Grading state is shared in place: first attempt is frozen, a second submit re-renders the stored attempt and never overwrites it"

patterns-established:
  - "Marker pinning: a zero-height ZWSP line at the top of li.q:not(.graded) keeps the native li::marker on the prompt line (a fieldset's baseline is its first option)"
  - "Smoke kit (open/answerAll/submitSheet/chooseMember/waitFor/shot) for scripts/smoke/*.smoke.mjs scenarios"

requirements-completed: [FMT-01, FMT-02, FMT-03, FMT-05, QUIZ-01, QUIZ-02, RSLT-01, RSLT-05, DSGN-02]

coverage:
  - id: D1
    description: "scripts/serve.mjs serves the repo on 127.0.0.1 only, traversal-safe (403/404 on ..%2f paths, 404 on missing files)"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs skeleton (server assertions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Static JSON (index, set, members) is read by ES modules and rendered as an exam sheet with 10 questions (7 concept, 3 code), code blocks verbatim"
    requirement: "FMT-01, FMT-02, FMT-03, FMT-05, QUIZ-02"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs skeleton (li.q 10/7/3, pre.code textContent equals JSON, white-space pre)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Grading: choice by index, short answers normalized (NFKC, case, spaces, empty parentheses, separators); score total /10, 개념 /7, 코드 분석 /3; 정답/오답 plus 정답 above each question"
    requirement: "RSLT-01, RSLT-05"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs skeleton (all-correct gives 10/7/3, all-wrong gives 0, every section.q-result data-result)"
        status: pass
      - kind: other
        ref: "node -e normalizeAnswer / sourceLabel acceptance one-liner"
        status: pass
    human_judgment: false
  - id: D4
    description: "Name picked once on the home page and remembered; the sheet's 성명 field is preselected; the attempt records the member"
    requirement: "QUIZ-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs skeleton (home -> #start hint -> name -> quiz.html?set=2026-W42 -> srq:member -> select#sheet-member -> attempt.member)"
        status: pass
    human_judgment: false
  - id: D5
    description: "First attempt frozen in srq:attempt:<setId>; reload shows the same graded sheet (no enabled input, no #submit)"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs skeleton (reload after submit)"
        status: pass
    human_judgment: false
  - id: D6
    description: "All visible copy Korean, both pages lang=ko, no horizontal overflow at 390px"
    requirement: "DSGN-02"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs skeleton (lang ko; phone scrollWidth <= innerWidth)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Realism and quality of the Korean sample questions, distractors and 5-line explanations"
    verification: []
    human_judgment: true
    rationale: "Content quality of study questions cannot be judged by a script (plan Task 3 human-check)"
  - id: D8
    description: "Visual quality of home and exam sheet against the dealt direction (critique rounds below)"
    verification:
      - kind: automated_ui
        ref: "inspect.mjs index.html and quiz.html: 0 FAIL with the interim allowance"
        status: pass
    human_judgment: true
    rationale: "Taste and composition need a human eye; inspector passing is only the floor"

duration: 23 min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 01: Walking skeleton Summary

**Zero-dependency static quiz site on one proven path: a member picks a name, takes the 10-question 2026-W42 sample on a paper exam sheet, 답안 제출 grades it in place with a pure shared module, the first attempt is frozen in localStorage and reloads as the same result, driven end to end by a real-browser smoke runner.**

## Performance

- **Duration:** 23 min (2026-10-16T06:39:58Z to 07:02:32Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files created:** 15 (about 15.3k tokens by chars/4)
- **Commits:** 3 task commits (measured from the ledger, see frontmatter)

## Accomplishments

- **Tracer (e7220de):** `scripts/serve.mjs`, `scripts/smoke.mjs`, `js/grade.js`, `js/storage.js`, `js/site.js`, `quiz.html` + `js/quiz.js`, `css/site.css`, `css/sheet.css`, `quizzes/index.json`, seed set. Tracer verified end-to-end before expansion (smoke green, lint 0 FAIL, inspector 0 FAIL).
- **Entry page (e082f01):** `members.json`, `index.html` + `js/home.js`, `loadMembers()`, `select#sheet-member`; smoke now covers home -> name -> sheet -> submit.
- **Full sample week (4914c8b):** 10 questions (q1-q7 concept, q8-q10 code), short answers q3/q6/q9, six sources one per member, sales.csv file citation; `#qN` hash focus; smoke asserts 10/7/3 shape.
- Verified results of every `<verify>` command are listed under Verification.

## Design record (user mandate)

- Skill `design-taste-frontend` invoked and the sheet reprinted with `draw.mjs --show` at the start of each task. Direction "The page is the object", **seed 990815287**, hero "Tabbed folder stack", palette "Frost and slate", motion "Index with preview".
- **Redraw recorded (from CONTEXT, not re-run):** Noto Serif KR (400/500/600) in Literata's role at Literata's settings (display 500 / -0.02em / 1.05, text 400 / 1.6), because the dealt Literata has no Hangul and every screen is Korean. One family; monospace only inside the `pre, code` rule.
- Idea sentence (CONTEXT): this week's six members' Notion entries become a stack of tabbed file folders; the open front folder is the exam sheet. At this depth: the front folder with its trapezoid tab (CSS `clip-path`) on the home page and the paper sheet with cut top corners and a perforated stub above the submit block. Back folders, member tabs and the preview move arrive in 01-03/01-04.

## Critique rounds (references/critique.md format)

```
ROUND 1 (quiz.html, graded desktop 1440 + phone 390)
Seen in one second: the huge title "10월 셋째 주 시험지" on a white sheet over dark slate.
Idea (one sentence): The week's study entries become the exam paper; at this depth only the paper object exists (folders come in 01-03).
Live thing: the sheet grades itself in place (정답/오답 mark, 정답 above each question, score block).
Layout words by section: title=statement / score=filled block / questions=aligned list with side-by-side code columns / submit=stub
Scores: design 6.5 · usability 7.5 · creativity 6 · content 7 → overall 6.7
Caps applied: fewer than four real pictures (design <= 6.5); still page (design <= 7). Both are the interim allowance.
Top three problems:
1. (sheet-graded-desktop) The code block stretched to the full row height, leaving a big dead ink slab under 6 lines. Fix: align-self start on pre.code. Done.
2. (sheet-graded-phone) The list number sat on the first choice, not on the prompt (a fieldset baseline is its first option), so numbers floated 100px below their questions. Fix: block flow for .q-body plus a zero-height prompt-sized line to pin the marker. Done in round 2.
3. (sheet-graded-desktop) The perforation under the questions was --surface on --bg and vanished; the score heading showed a focus ring after the programmatic focus. Fix: dots in --muted, outline none on #score-heading:focus. Done.

ROUND 2 (index.html desktop/mobile folds, quiz.html 10-question sheet)
Seen in one second: the giant white "이번 주 시험지" on dark slate with a paper folder under it.
Idea (one sentence): same as above; the front folder is there, the stack of member folders is not yet.
Live thing: the name picker (six thumb-sized bars) feeding 풀기 시작.
Layout words by section: hero=centred statement / folder=picker grid / sheet=list with code columns
Scores: design 6.8 · usability 7.8 · creativity 6.2 · content 7 → overall 6.9
Caps applied: fewer than four real pictures (design <= 6.5), still page (design <= 7): interim allowance.
Top three problems:
1. (index desktop-fold) A faint seam between the folder tab and body from clip-path anti-aliasing, and the folder ended above the bottom edge leaving dead ground. Fix: tab overlaps the body by 1px; folder flexes to the bottom edge. Done.
2. (quiz desktop-page-01) Number markers drifted below their prompts on every ungraded question. Fix: marker pin (see pattern-established). Done.
3. (quiz desktop-page-01) Short-answer inputs read as empty grey bars. Fix: placeholder "답을 입력하세요" in --muted. Done.
Remaining (not fixed here, owned by later plans): no real pictures and no motion layer (01-03..01-06); home has one folder, not the stack; the result block repeats the word 정답 ("정답 정답: ...", 01-06 rebuilds result blocks); the code block scrolls sideways on lines longer than its column (by design, acceptable).
```

## Interim inspector allowance

Both pages were inspected with `--allow few-pictures,still-page,empty-screens` as the plan states (the picture floor, the motion layer and the fullness floor). They are closed by: home pictures and motion in **01-03 / 01-04** (allowance removed there); sheet pictures and motion in **01-05 / 01-06**. Every other inspector finding was fixed; the remaining WARNs below are defended or owned.

- `first-action` WARN on quiz.html: the exam sheet's single action (답안 제출) is at the end of the 10 questions by design; defended.
- `no-footage` WARN: no honest short clip exists (RESEARCH Open Question 5, defended again in 01-04).

## Members to confirm (SAMPLE DATA)

`members.json` has six names. Three are real and confirmed (김준수, 이주현, 차승환). Three are placeholders flagged `confirm: true` and must be replaced with the real names (README in 01-02 says so): **스터디원 4** (calendar shows '송지…'), **스터디원 5** ('노아…'), **스터디원 6** ('정보경…'). Sources s4 to s6 in the sample set carry these placeholder names as authors, so renaming a member also means renaming those source authors. All of `quizzes/*.json` is SAMPLE DATA.

## Verification (real outputs)

| Command | Result |
|---|---|
| `node scripts/smoke.mjs skeleton` | `PASS skeleton`, `SMOKE: 1 passed, 0 failed` (exit 0), re-run after every task and at the end |
| `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` | `RESULT: 0 FAIL, 0 WARN` |
| `inspect.mjs quiz.html --allow few-pictures,still-page,empty-screens` | `RESULT: 0 FAIL, 2 WARN` (first-action, no-footage), exit 0 |
| `inspect.mjs index.html --allow few-pictures,still-page,empty-screens` | `RESULT: 0 FAIL, 1 WARN` (no-footage), exit 0 |
| Task 3 structural one-liner (10 / 7+3 / 4 unique choices / <=5 lines / sources all cited) | exit 0 |
| Distribution one-liner (short = q3,q6,q9; no choice index answers 6+; no CR/TAB; sales.csv present) | exit 0 |
| normalizeAnswer / sourceLabel one-liner; storage degradation one-liner | exit 0 both |
| No regex lookbehind in js/grade.js; no HTML-string sinks in js/; HTML script/style/CSP/lang node check (both pages); members.json check; past-weeks hidden check | all exit 0 |
| `grep -n "127.0.0.1" scripts/serve.mjs`, `grep -n "Noto+Serif+KR:wght@400;500;600" quiz.html`, `grep -n 'id="start"' index.html`, `grep -n "quiz.html?set=" js/home.js` | all print the expected lines |

Not run: the Task 3 `human-check` (a person reading all ten questions at http://127.0.0.1:8080/quiz.html); recorded as coverage D7 with `human_judgment: true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase branch instead of master**
- **Found during:** pre-commit assertion before Task 1
- **Issue:** the working tree was on `master`, which `git.base-branch --is-protected` reports as protected (origin/HEAD unresolved, five-name fallback); the executor protocol forbids committing there and forbids overriding it.
- **Fix:** created and committed on `gsd/phase-1-quiz-core` (the protocol's own remedy: re-home onto a phase branch). No config key was changed. **The orchestrator must merge this branch (fast-forward) into master**; STATE.md/ROADMAP.md updates and the SUMMARY commit are on the same branch.
- **Files modified:** none (branch only)

**2. [Rule 2 - Missing critical] `.gitignore` for generated tool output**
- **Found during:** Task 1 commit
- **Issue:** `.taste-skill/inspect/` and `.taste-skill/shots/` are generated and must never be committed (plan), but showed up untracked.
- **Fix:** `.gitignore` with those two paths (`.taste-skill/direction.json` stays tracked).
- **Commit:** e7220de

**3. [Rule 1 - Bug] Layout and alignment defects found in the screenshot critique** (code block stretched, list numbers detached from prompts, invisible perforation, seam on the folder tab, focus ring on the score heading, empty-looking short answers). Fixed in the same tasks; see the critique rounds. Commits e7220de, e082f01, 4914c8b.

**4. [Rule 2 - Missing critical] Small additions beyond the plan text**
- `#storage-notice` rendered when `store.persistent` is false (the plan reserves that hook for 01-05; added now because "never throws, still works without persistence" is a CONTEXT requirement). 01-05 should reuse this element rather than add a second one.
- `index.html` keeps `#start` / `#start-hint` / the member fieldset as static markup (acceptance greps `id="start"` in index.html).
- Smoke also asserts the unknown `?set=` id shows the Korean not-found panel (threat T-01-03).
- `select#sheet-member` is disabled in the graded state and shows the attempt's member.

**Total deviations:** 4 (1 blocking, 2 missing-critical, 1 bug group). **Impact:** none on scope; item 1 needs a merge step by the orchestrator.

## Authentication Gates

None.

## Known Stubs

- `members.json` placeholders (스터디원 4/5/6) and all of `quizzes/*.json` are intentional SAMPLE DATA, resolved by the user (names) and Phase 2 (real sets).
- `#past-weeks` is hidden until Phase 4 (CONTEXT).
- `index.html` `#start` does nothing without JavaScript (a noscript sentence explains).

## Threat Flags

None beyond the plan's threat model. T-01-01 (textContent only, el() refuses on* and javascript: URLs), T-01-02 (traversal-safe server, smoke asserts it), T-01-03 (only index ids are fetched, smoke asserts not-found), T-01-05 (CSP meta, no inline scripts or style attributes) are implemented and checked.

## Issues Encountered

- The smoke runner passed on the first run, so I opened the screenshots and added assertions (code verbatim, 10/7/3, hash focus, not-found) to be sure it was not vacuous.
- Shell tool-call quoting stripped a backslash from a regex written through a heredoc (`\d`); caught by the new #q9 smoke assertion and fixed (`[0-9]`).

## Next Phase Readiness

Ready for **01-02** (validator, tests, README, package.json): it can import `js/grade.js` directly and use `quizzes/2026-W42.json` as the valid fixture (note short answers are normalization-distinct). 01-03/01-04 take over `index.html` and move the HOME block of `css/site.css` into `css/home.css`; 01-05/01-06 art-direct the sheet on the existing hooks. **Merge `gsd/phase-1-quiz-core` into master before dispatching further plans, or keep dispatching on this branch.**

## Self-Check: PASSED

All 15 created files exist on disk; commits e7220de, e082f01 and 4914c8b are ancestors of HEAD on `gsd/phase-1-quiz-core`.
