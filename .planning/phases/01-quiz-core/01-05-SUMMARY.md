---
phase: 01-quiz-core
plan: 05
subsystem: ui
tags: [exam-sheet, perforated-paper, tipped-in-plates, draft-autosave, storage-degradation, motion, design-taste-frontend]

requires:
  - phase: 01-quiz-core/01
    provides: "js/site.js (el, store, ROOT, loadWeek, loadMembers), js/grade.js sanitizeAnswers, js/storage.js createStore, sheet DOM hooks, smoke kit"
  - phase: 01-quiz-core/03
    provides: "js/boot.js, js/motion.js reveal/stagger, shared .plate treatment in css/site.css, eight credited pictures in assets/"
provides:
  - "quiz.html taking state as a printed exam: perforated paper on the ink ground, header fields (성명, 범위, 문항, 예상 시간), part strips, 44px+ choice bars (2x2 for four short choices), verbatim code scrolling inside its block, tear-off submit stub"
  - "Seven credited archival plates tipped onto the sheet (one in the header, five on the ground beside the paper, one beside the stub) with p.credits at the foot of the paper"
  - "Draft autosave and restore: srq:draft:<set> debounced 300ms on input, immediate on change, flushed on visibilitychange and pagehide, restored through sanitizeAnswers; span#save-state; p#storage-notice when storage is blocked"
  - "tests/storage.test.mjs (7 cases) and scripts/smoke/sheet.smoke.mjs (scenario 'sheet')"
affects: [01-06, phase-04]

actuals:
  tokens: 13300
  tasks: 2
  commits: 2

commits: 2
plan_head_before: ccf599c3d35643dd5f50cc7f59fd87514d01236d
plan_head_after: 3a6d6d5ecd96c59c8596e752603762a74c11b2e8

tech-stack:
  added: []
  patterns:
    - "Paper edge = border-inline 10px dotted in the ground colour on the paper element, top corners notched by two ground-coloured triangles (clip-path on ::before/::after); the paper itself is unclipped so plates can hang out into the ground"
    - "Ground plates are absolutely positioned children of the question they sit beside (left/right offset from --pad-x, --edge, --num-w, --plate-w), display none below 1200px"
    - "Part strip ('개념 · 1–7번', '코드 분석 · 8–10번') hung in the gap above the first question of each kind, so the li::marker pin and the ordered list stay intact"
    - "Draft save reads live control values at save time; storage failure on any set() surfaces the same #storage-notice created on demand"

key-files:
  created:
    - tests/storage.test.mjs
    - scripts/smoke/sheet.smoke.mjs
  modified:
    - quiz.html
    - css/sheet.css
    - js/quiz.js
    - scripts/smoke.mjs

key-decisions:
  - "Plates anchored in the margin, not in a grid column: the paper element is not clipped, its notched corners are laid-over triangles, so plates can sit beside the question they relate to"
  - "Ground plates appear from 1200px (not 1100px): at 1100px the ground beside a 780px paper is 160px, too small for a 160px plate plus gap; below 1200px only the header plate (from 720px) remains"
  - "Code blocks always stack above their question's choices (the two-column code layout of 01-01 was dropped) because the 780px paper leaves ~280px columns"
  - "Credits list all seven plates the sheet can show at its widest layout; on a phone no picture renders but the foot still credits them"

patterns-established:
  - "Sheet plates: figure.plate.sheet-plate[data-pic] with per-picture object-position; one 4:3 ratio (the machines photograph is 3:4), one multiply treatment from the shared .plate"

requirements-completed: [QUIZ-02, QUIZ-03, QUIZ-05, DSGN-01, DSGN-02]

coverage:
  - id: D1
    description: "Sheet reads as a printed exam: perforated paper on the dark ground, header fields as a description list, ten questions numbered by a real ol (li::marker) in a margin column, part strips, tear-off stub"
    requirement: "QUIZ-02, DSGN-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (title, 7 select options, 10 li display list-item, 범위 M/D–M/D, 문항, 예상 시간, #submit inside the paper)"
        status: pass
      - kind: automated_ui
        ref: "inspect.mjs quiz.html (no --allow): RESULT 0 FAIL, 2 WARN (first-action, no-footage, both defended below)"
        status: pass
    human_judgment: true
    rationale: "The printed-exam feel and thumb comfort are visual/physical judgements (plan human-check, not run by a person)"
  - id: D2
    description: "Code verbatim with indentation, scrolls inside its own block; choices and the 성명 select at least 44px; short inputs at 16px or more; no sideways page scroll at 390px"
    requirement: "QUIZ-02, QUIZ-05"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (3 pre.code equal the JSON, white-space pre; at 390x844 scrollWidth <= innerWidth, every choice label >= 44px, each pre overflow-x auto with scrollWidth >= clientWidth, answer + submit still grades 10/10)"
        status: pass
    human_judgment: true
    rationale: "Actual thumb comfort on a phone was not exercised by a person"
  - id: D3
    description: "At least four credited archival plates on wide screens, none over text; Korean alt text; p.credits names each"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (at 1440x900 after scroll: >= 4 assets/ images loaded at 160x120 or more, none intersects #sheet-title, legend, label, pre.code or #submit; each in credits.json and named in p.credits; no overflow)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sheet moves in once on load; every [data-reveal] is visible under reduced motion; content shows even if scripts fail"
    requirement: "DSGN-02"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (reduced-motion page: every [data-reveal] at opacity 1 within 500ms)"
        status: pass
      - kind: automated_ui
        ref: "inspect.mjs quiz.html: no still-page finding"
        status: pass
    human_judgment: true
    rationale: "Feel of the entrances was judged from screenshots only; the no-script 4s/6s failsafes are CSS-only and were not run with scripts blocked"
  - id: D5
    description: "Draft autosave and restore (QUIZ-03): answers and 성명 survive a reload; a submitted sheet drops its draft"
    requirement: "QUIZ-03"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (srq:draft:2026-W42 stored with v 1, answers and member; reload restores q1 radio, q3 text and select; #save-state '자동 저장됨 · HH:MM' after the next change; draft removed after submit). Mutation check: removing the input/change listeners fails the scenario"
        status: pass
    human_judgment: false
  - id: D6
    description: "Tampered draft is never trusted: out-of-range choice, wrong-type answer, unknown id, 300-character answer and unknown member are all dropped without an exception"
    requirement: "QUIZ-03"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (scenario b; page.consoleErrors empty for every page the runner opened)"
        status: pass
    human_judgment: false
  - id: D7
    description: "With storage blocked (localStorage getter throws SecurityError) the sheet still renders, answers and grades, and says in Korean that answers will not be kept"
    requirement: "QUIZ-03"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs sheet (scenario c: #storage-notice visible with the exact sentence, 10 questions, answering works, grading gives 10, consoleErrors empty). Mutation check: removing the notice call fails the scenario"
        status: pass
      - kind: unit
        ref: "node --test tests/storage.test.mjs (7 pass: round trip, throwing factory, QuotaExceededError, zero-quota probe, version/invalid JSON, remove, keys prefix)"
        status: pass
    human_judgment: false

duration: 18 min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 05: The exam sheet as a printed paper, with drafts that survive a closed tab Summary

**quiz.html now reads as a printed exam on the folder ground: a perforated-edge paper with a headline, 성명/범위/문항/예상 시간 fields, part strips, thumb-sized answer bars, verbatim scrolling code, a tear-off 답안 제출 stub and seven credited archival plates tipped in beside it on wide screens; answers autosave to `srq:draft:<set>`, restore through `sanitizeAnswers`, and a Korean notice appears when the browser refuses storage.**

## Performance

- **Duration:** 18 min (from the previous plan's last commit 20:52 to the Task 2 commit 21:10, local time)
- **Tasks:** 2 (both `auto`)
- **Files:** 2 created, 4 modified (about 13k tokens by chars/4 across the touched files)
- **Commits:** 2 task commits, measured from the ledger (see frontmatter)
- Design record: skill `design-taste-frontend` invoked and the sheet reprinted with `draw.mjs --show` at the start of both tasks. Direction "The page is the object", seed 990815287, Frost and slate, Noto Serif KR in Literata's role. No redraw.

## Accomplishments

- **Task 1 (acb8c77):** `quiz.html` (boot.js in the head), `css/sheet.css` (rewritten), `js/quiz.js` (header, part strips, choices wrapper, plates, credits, entrances), `scripts/smoke/sheet.smoke.mjs` (structure, plates, phone, reduced motion).
- **Task 2 (3a6d6d5):** draft autosave/restore and storage notice in `js/quiz.js`, `tests/storage.test.mjs`, three more smoke scenarios (resume, tampered draft, blocked storage), a `#storage-notice` style.
- `js/storage.js`: **not changed**; no test exposed a defect.

## The sheet as built

- **Paper:** `--bg` on the `--ink` ground, 860px wide on tablet and 780px from 1200px up, full width minus 12px on a phone. Sides perforated with a 10px round-dot dotted border in the ground colour, top corners notched by two ground triangles. No outline, no shadow, no gradient.
- **Header:** `h1#sheet-title` at 96px on two lines (1440), 40px on two lines at 390. Under it a description list: 성명 (the select, 48px tall, full row), 범위 `10/9–10/16`, 문항 `10문제 · 개념 7 · 코드 분석 3`, 예상 시간 `약 15분`; quiet `span#save-state` and, only when needed, `p#storage-notice` (a filled ink note) below.
- **Questions:** real `ol#sheet`, number from `li::marker` in a margin column. Filled `--ink` strips "개념 · 1–7번" and "코드 분석 · 8–10번" mark where each part starts. Prompts stay `legend`/`label` text. Choices are `--surface` bars at least 48px tall; four choices of 14 characters or less sit 2x2 from 720px (only q5 qualifies in the sample), otherwise one column; checked = `--ink` fill with `--bg` text. Code on `--surface`, `white-space: pre`, `overflow-x: auto`, focusable.
- **Stub:** a `--surface` strip below an `--ink` round-dot perforation, the one teal `답안 제출`, "제출하면 첫 시도 답이 고정돼요." and `p#status`.
- **Motion:** header parts (`data-reveal="load"`) and each question (`data-reveal="q"`, the first three staggered 70ms) rise 24px with opacity once; plates arrive as plates; press/hover/focus feedback on bars, select, inputs and the submit button; Nightingale plate drifts (scroll-linked, transform only); reduced motion shows everything still; below-the-fold parts carry a 6s CSS failsafe.

## Plates used (all from the 01-03 set; none added, none deleted)

| Picture | Placement at 1440 | Title as credited | Creator | Licence | Source page |
|---|---|---|---|---|---|
| assets/hollerith-punched-card.jpg | in the paper header, beside the fields (from 720px) | Hollerith Punched Card | unknown | public domain | https://commons.wikimedia.org/wiki/File:Hollerith_Punched_Card.jpg |
| assets/tabulating-machines-census.jpg (3:4) | ground, left of the title | Tabulating machines, Census LCCN2016823353 | National Photo Company Collection | public domain | https://commons.wikimedia.org/wiki/File:Tabulating_machines,_Census_LCCN2016823353.jpg |
| assets/hollerith-census-machine.jpg | ground, right of question 2 | Hollerith census machine at CHM by Tomwsulcer | Tomwsulcer | CC0 | https://commons.wikimedia.org/w/index.php?curid=46063689 |
| assets/card-catalog-drawers.jpg | ground, left of question 4 | Wooden Card Catalog Furniture | MarkBuckawicki | CC0 | https://commons.wikimedia.org/w/index.php?curid=68147692 |
| assets/nightingale-mortality.jpg | ground, left of question 7 (the break to the 코드 분석 part), drifts | Nightingale-mortality | Florence Nightingale | public domain | https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg |
| assets/playfair-piecharts.jpg | ground, right of question 9 (beside the code area) | Playfair piecharts | William Playfair | public domain | https://commons.wikimedia.org/wiki/File:Playfair_piecharts.jpg |
| assets/census-form-1890.jpg | ground, right of the submit stub | 1890 U.S. Census form | unknown | public domain | https://commons.wikimedia.org/wiki/File:1890_U.S._Census_form.jpg |

Seven plates, one treatment (shared `.plate`: greyscale, multiply on `--surface`, square corners), 4:3 except the portrait machines photograph. Rendered 260x195 on the ground at 1440 (floor 168px wide at 1200). All carry Korean alt text describing the picture, never a member. Credits sit in `p.credits` at the foot of the paper, full ink, links same-tab. At 1100px and below 1200px the ground plates are not rendered (see deviations); below 720px nothing is rendered.

## Critique (references/critique.md format)

```
ROUND 1 (desktop-fold, desktop-page-01/02, tablet-fold, mobile-fold, mobile-page-01; inspector run on the first build)
Seen in one second: a huge title on a white perforated sheet over dark slate, with a black-and-white photograph beside it.
Idea (one sentence): This week's exam is the printed paper itself, the front folder of the home page made full size, with archival data-processing photographs pasted beside it.
Live thing: the sheet keeps itself; close the tab and every answer is back.
Layout words by section: header=statement + fields list / questions=aligned list with part strips / stub=tear-off strip / margin=plates
Scores: design 7.5 · usability 8.0 · creativity 7.5 · content 7.5 -> overall 7.6
Caps applied: none after round 1 (0 FAIL, five images counted, the page moves); first build carried [contrast] and [empty-screens] FAILs (below).
Top three problems:
1. (inspector) [contrast] 1:1 on every paper text: the inspector reads the paper's colour from the element, and I had put it on a ::before. Fix: background and perforated border on .paper itself, notched corners as two ground triangles. Done.
2. (desktop-fold) The first screen had no picture on the ground; plates only began at question 2, and the ground beside the title was empty. Fix: a tall ground plate (machines photograph) beside the title, a second picture beside question 2 and one at question 4, seven plates in all. Done.
3. (desktop/phone) The radio dot in each choice bar (--bg on --surface, 16px) was almost invisible, so unchecked bars did not read as options. Fix: 20px dot. Partly done (still pale; the bar and the checked ink fill carry the affordance).
ROUND 2 (after the fixes; inspector re-run, tablet and phone re-read)
Scores: design 7.8 · usability 8.0 · creativity 7.5 · content 7.5 -> overall 7.7. Nothing a stranger would notice that was not already listed under Remaining.
Remaining (not fixed here): the header takes a screen and a half of paper at 1440 (96px two-line title plus fields) so the first question starts at y 830; on the phone the credits paragraph is 17 lines for pictures that are not rendered there; the part strip is a heavy ink bar; the right ground beside the header is empty on the first screen (the stub plate is far below).
```

Rounds used: 2 of 3. Screenshots of the draft state were read separately: `.taste-skill/shots/notice-blocked.jpg` (the filled ink note under the fields, wording exact) and `.taste-skill/shots/saved-phone.jpg` ("자동 저장됨 · 21:10" under the fields after a choice).

## Verification (real outputs)

| Command | Result |
|---|---|
| `node scripts/smoke.mjs sheet` (Task 1) | `PASS sheet`, `SMOKE: 1 passed, 0 failed` |
| `node scripts/smoke.mjs sheet` (Task 2, final) | `PASS sheet`, `SMOKE: 1 passed, 0 failed` |
| `node scripts/smoke.mjs` (all scenarios) | `PASS skeleton`, `PASS home`, `PASS sheet`, `SMOKE: 3 passed, 0 failed` |
| `node --test "tests/**/*.test.mjs"` | `tests 93, pass 93, fail 0` |
| `node --test tests/storage.test.mjs` | `pass 7, fail 0` |
| `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` | `RESULT: 0 FAIL, 0 WARN` (a first Task 2 run warned `padStart(2, '0')` in the clock; replaced by `toLocaleTimeString('en-GB', ...)`) |
| `node .claude/skills/design-taste-frontend/scripts/inspect.mjs quiz.html` (no --allow, final) | exit 0, **`RESULT: 0 FAIL, 2 WARN — measurements pass.`** (`first-action`, `no-footage`) |
| `grep -n 'class="credits"' quiz.html js/quiz.js` | `js/quiz.js:111` (the comment above `creditsFor`; the element itself is built with `class: 'credits'`) |
| boot.js head one-liner | exit 0 |
| `grep -n "::marker" css/sheet.css` | line 135 |
| `grep -n "pagehide\|visibilitychange\|storage-notice" js/quiz.js` | present (lines 302, 305, 352, 353) |

Mutation checks (to be sure the smoke run is not vacuous): with the `input`/`change` listeners removed the scenario fails at "draft stored with v: 1"; with the load-time `showStorageNotice()` call removed it fails at the notice assertion. Both were restored before the commit.

The two remaining inspector WARNs, defended:
- **first-action:** the exam sheet's one action, 답안 제출, sits after the ten questions by design (an exam is answered before it is handed in); defended already in 01-01 for the same page.
- **no-footage:** no honest clip exists for this subject (RESEARCH Open Question 5, defended again in 01-04); the one moving picture is the scroll-linked drift on the Nightingale plate.

Not run: the Task 1 `human-check` (a person answering the ten questions with a thumb on a phone and scrolling the code blocks); coverage D1, D2 and D4 are marked `human_judgment: true` for that reason. The reduced-motion path was exercised through the smoke kit's `reducedMotion` page only, and the CSS failsafes (4s/6s) were not run with scripts blocked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Paper background was invisible to the contrast meter**
- **Found during:** Task 1 first inspector run (`[contrast]` 1:1 on every paper text)
- **Issue:** the paper colour lived on a `::before` pseudo-element so plates could hang outside; the inspector measures the element's own background chain and saw ink on ink.
- **Fix:** `.paper` carries its own background and perforated border; the notched corners became two ground triangles. **Files:** css/sheet.css. **Commit:** acb8c77

**2. [Rule 1 - Bug] First screen carried no picture on the ground, and a screenful of empty ground (`[empty-screens]` FAIL)**
- **Found during:** Task 1 first inspector run and screenshots
- **Fix:** three more plates (beside the title, question 2, question 4). **Files:** js/quiz.js, css/sheet.css. **Commit:** acb8c77

**3. [Rule 3 - Blocking] Smoke kit did not expose `browser`**
- **Found during:** Task 2 (the plan's scenario (c) uses `kit.browser.newPage`, and the interface line of the plan lists `browser`)
- **Fix:** one line, `browser,` added to the kit in `scripts/smoke.mjs` (a 01-01 file, already touched by 01-04). No change to existing scenarios. **Commit:** 3a6d6d5

### Plan-text refinements (decisions, not behaviour changes)

- **Ground plates from 1200px, not "about 1100px":** a 780px paper at 1100px leaves 160px of ground per side, too small for a 160px plate plus gap. The 1440 gate (the one the smoke and inspector run) is unaffected.
- **Seven plates, not four:** more than the floor, to fill the first screen and to follow the exam down the page; each is lazy-loaded and absent below 1200px, so the phone downloads none of the ground plates.
- **Code stacks above its choices at every width** (the 01-01 two-column code layout is gone): the 780px paper leaves about 280px columns.
- **Part strip** is a filled `--ink` bar hung in the gap above the first question of each kind (not a line beside the number), because the marker pin needs the first in-flow line to be the prompt line.
- **Header plate** (the punched card) sits inside the paper from 720px up, as the plan allows; below 720px nothing is rendered.
- **Credits** name all seven plates the sheet can show; on a phone no picture renders but the credit stays.
- **`#storage-notice`** moved from the graded section (01-01) to the sheet header and is shown in both states; one element, one id.

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking) plus the decisions above. **Impact:** none on scope.

## Authentication Gates

None.

## Known Stubs

- Member names `스터디원 4/5/6` and all of `quizzes/*.json` remain SAMPLE DATA from 01-01; the sheet renders whatever the set holds.
- `#past-weeks` stays hidden until Phase 4.
- The graded state (`section#score`, `.q-result` blocks) is still the plain 01-01 version; 01-06 rebuilds it.

## Threat Flags

None beyond the plan's register. T-01-14: a draft is parsed through the `v: 1` check in the store and `sanitizeAnswers` before any control is touched; the 성명 is accepted only if it is an existing option (smoke scenario b proves all five tampered fields are dropped). T-01-15: `createStore` never throws and falls back to memory; `#storage-notice` tells the member (scenario c plus the storage tests). T-01-16 accepted. T-01-SC: no installs. Static-safety test stays green (all DOM built through `el()`/`textContent`; plates are `img` elements with CSP-allowed `'self'` sources).

## Issues Encountered

- The first full-page smoke screenshot showed only question 1: the below-the-fold questions were still hidden by their entrance (nothing had scrolled them into view). The assertions were unaffected; I used the inspector's screenshots, which scroll the page, for the critique.
- Untracked and pre-existing files (`.claude/skills/`, `skills-lock.json`, `.planning/WINDOWS.md`, `.planning/milestone.lock`, `.planning/state.json`, the modified `.planning/config.json`) were left unstaged as instructed. Git prints CRLF warnings for the working copies; no content change.

## Next Phase Readiness

01-06 can rebuild the graded state on the same paper: hooks kept (`#sheet-title`, `select#sheet-member`, `ol#sheet`, `li.q[id][data-qid][data-kind] > .q-body`, `pre.code#qN-code > code`, `#submit`, `#status`, `#storage-notice`, `.sheet-head`, `section#score`, `.q-result`). The result blocks still use the 01-01 rules at the end of `css/sheet.css`. 01-06 adds the dialog and one plate beside the score summary: `plate(key, 'sheet-plate--left'|'--right')` and `GROUND_PLATES` in `js/quiz.js` are the pattern, and `creditsFor()` must be given any new picture so `p.credits` stays exact. `js/quiz.js` exports nothing new; `setupDraft(...).stop()` removes the draft when an attempt is stored.

## Self-Check: PASSED

quiz.html, css/sheet.css, js/quiz.js, tests/storage.test.mjs, scripts/smoke/sheet.smoke.mjs and scripts/smoke.mjs exist on disk; commits acb8c77 and 3a6d6d5 are ancestors of HEAD on `gsd/phase-1-quiz-core`.
