---
phase: 01-quiz-core
plan: 04
subsystem: ui
tags: [home-sections, giant-word-bars, itinerary-slip, book-spine-shelf, card-back-footer, credits, motion, design-taste-frontend]

requires:
  - phase: 01-quiz-core/01
    provides: "js/site.js (el, loadWeek, loadMembers), js/grade.js sourceLabel, quiz.html?set=<id>#<qid> scroll contract, smoke kit"
  - phase: 01-quiz-core/03
    provides: "folder-stack hero, js/motion.js reveal/stagger, .plate picture treatment in css/site.css, eight credited pictures in assets/"
provides:
  - "index.html sections #sources (출처 bars), #how (itinerary slip), #contents (book-spine shelf) and the footer #back (back of the card) with credits"
  - "css/home.css: giant word in container units, filled details bars with ::details-content accordion, slip with zigzag clip-path and 4px dotted leaders, vertical-rl spines with four highlighter tones, scalloped card edge"
  - "js/home.js renderers built from the set: renderSources, renderSlip, renderShelf, renderCard, numberEntrances"
  - "Home gate: inspect.mjs index.html with NO --allow, RESULT 0 FAIL"
affects: [01-05, 01-06, phase-04]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 4654759d244ef1237b6765c2addacb961a1ed852
plan_head_after: 80b814fac912b1a9cb987de806972ee7d4a3bdec

tech-stack:
  added: []
  patterns:
    - "Per-section entrance manner through data-reveal variants (bar, plate, slip, row, spine) overriding only translate and animation-name; the shared hidden state from site.css is untouched"
    - "Below-the-fold data-reveal parts carry a 6s CSS failsafe (reveal-failsafe) so a failed script never leaves them hidden"
    - "Scalloped card edge = a fixed-height strip clipped by an inline SVG clipPath (objectBoundingBox), not a gradient mask"
    - "One moving picture: scroll-linked drift (animation-timeline: view()) on the census-form plate, transform only, under @supports and no-preference"

key-files:
  created: []
  modified:
    - index.html
    - css/home.css
    - js/home.js
    - scripts/smoke/home.smoke.mjs
    - scripts/smoke.mjs

key-decisions:
  - "Section grounds: ink (hero + 출처) -> pale blue --band-1 (slip) -> slate --band-2 (shelf) -> ink (card back). Every paper piece stands on a contrasting ground"
  - "Anchor lines at grid columns 1 (heading column), 2 (footer card) and 7 (plates, slip)"
  - "Spines at the lead step (26px) and 22em tall, up to 132px wide, so ten spines fill the 1440 width instead of a thin 45% shelf"
  - "Credits list all eight pictures of assets/credits.json because the preview frame can show any of them; nothing was deleted from assets/"

patterns-established:
  - "Spine label + highlighter band: label centred in the spine, band stretched across it, tone assigned by order of first subject (Pandas 1, 데이터 시각화 2, 데이터 분석 3, 머신러닝 4)"

requirements-completed: [DSGN-01, DSGN-02, FMT-05, QUIZ-05]

coverage:
  - id: D1
    description: "출처: one details bar per member (first open), entries with title and M/D in tabular figures, subject and cited-question count, each row id source-<id>"
    requirement: "QUIZ-05, DSGN-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs home (bars = members in order, only first open, every #source-<id> row with title and M/D, tabular-nums)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Slip with stages, dotted leaders and the inverted last row naming 점수, 해설, 틀린 문제 with the real minutes; ten spines linking quiz.html?set=2026-W42#q1..#q10"
    requirement: "QUIZ-05, DSGN-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs home (inverted row text and ink background; ten hrefs end ?set=2026-W42#qN in order; aria-label starts N번 문제; hovered spine turns ink)"
        status: pass
    human_judgment: true
    rationale: "Following a spine into the sheet is asserted by the 01-06 final gate (01-05 edits the sheet in parallel); the look of the spine shelf is a visual judgement"
  - id: D3
    description: "Back of the card: sign-off, four links, stamp, imprint with 샘플 데이터로 만든 화면, credits naming every picture the page can show"
    requirement: "DSGN-01, DSGN-02"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs home (every assets/ img title is in footer .credits; #sources/#how/#contents resolve; sheet link carries ?set=; imprint >= 13px; no target=_blank without rel)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Four or more real pictures visible at 1440, no overflow at 390, reduced motion shows every part at once, inspector passes with no allowance"
    requirement: "DSGN-01, DSGN-02, FMT-05"
    verification:
      - kind: automated_ui
        ref: "node .claude/skills/design-taste-frontend/scripts/inspect.mjs index.html: RESULT 0 FAIL, 1 WARN (no-footage, defended below)"
        status: pass
      - kind: e2e
        ref: "node scripts/smoke.mjs home (>= 4 distinct pictures loaded, opaque, 160x120+; scrollWidth <= innerWidth at 390; reducedMotion page: every [data-reveal] opacity 1 and translate none within 500ms)"
        status: pass
    human_judgment: true
    rationale: "Overall art-direction coherence and the feel of the entrances are visual judgements (plan human-check, not run by a person)"

duration: about 2 h wall time across a rate-limit pause and a user pause (active work roughly 1 h)
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 04: Home sections, card back and the allowance-free gate Summary

**The home page now continues the folder stack with the week's real material: a giant 출처 over one filled details bar per member, an itinerary slip with dotted leaders and an inverted 손에 남는 것 row, a ten-spine book shelf whose spines open each question on the sheet, and a scalloped card-back footer that credits every picture, with section entrances in their own manners, a scroll-linked drifting plate and a reduced-motion fallback; `inspect.mjs index.html` passes with no --allow.**

## Performance

- **Tasks:** 2 (both `auto`), 2 task commits measured from the ledger (see frontmatter)
- **Files:** 5 modified, none created (about 21k tokens of text by chars/4, pictures excluded)
- Design record: skill `design-taste-frontend` invoked and the sheet reprinted with `draw.mjs --show` at the start of each work session and again at the start of Task 2 (the run was interrupted twice, so it happened four times). Direction "The page is the object", seed 990815287. **No redraw** (no section needed `--alternatives`).

## Accomplishments

- **Task 1 (c31a788):** `#sources`, `#how`, `#contents` and, because the markup was already in the tree when the run resumed, the footer `#back` as well; home smoke extended with the section, spine, picture-floor and overflow assertions. The footer's credits paragraph and the full motion layer are therefore in this commit; Task 2 (80b814f) holds the smoke for credits / footer links / reduced motion, the spine hover check, `scripts/smoke.mjs` reducedMotion pass-through and the plate offset tweak after critique.
- **Task 2 (80b814f):** gate with no allowance, critique rounds, smoke for credits coverage and reduced motion.

## Sections as built

| Section | Blueprint | Ground | Composition |
|---|---|---|---|
| #sources | Giant word, filled bar rows | ink | column cols 1-5 (container-type inline-size, 49cqw "출처" edge to edge, 20px, six 56px bars with 6px gaps, first open); cols 7-12 a sentence from the data and two tipped-in plates (census form 3:4 with drift, Nightingale 4:3 offset down) |
| #how | Itinerary on a slip | --band-1 | heading + 30ch paragraph + a 4:3 plate in cols 1-5; paper slip (max 480px, zigzag bottom by clip-path) in cols 7-11: 월~목 / 금요일 / 풀 때 stages, 4px dotted leaders, inverted 44px last row "손에 남는 것: 점수, 해설, 틀린 문제 · 약 15분" |
| #contents | Book-spine index | --band-2 | lead-step heading and one-sentence note on one baseline; ten spines (vertical-rl, label then 12px gap then a stretched highlighter band), ink shelf board; phone: an inline wrap of links with highlighted subjects |
| footer | The back of the card | ink | paper card cols 2-11, twelve scallops (six on a phone), sign-off "금요일에 만나요", four links, 88px stamp (64px phone), credits paragraph, imprint line at 14px |

## Pictures (all from 01-03; none added, none deleted)

| File | Title | Creator | Licence | Source page | Where on the page |
|---|---|---|---|---|---|
| assets/card-catalog-drawers.jpg | Wooden Card Catalog Furniture | MarkBuckawicki | CC0 | https://commons.wikimedia.org/w/index.php?curid=68147692 | preview frame (idle) |
| assets/census-form-1890.jpg | 1890 U.S. Census form | unknown | public domain | https://commons.wikimedia.org/wiki/File:1890_U.S._Census_form.jpg | #sources plate (drifts) and preview |
| assets/nightingale-mortality.jpg | Nightingale-mortality (1858) | Florence Nightingale | public domain | https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg | #sources plate and preview |
| assets/tabulating-machines-census.jpg | Tabulating machines, Census LCCN2016823353 | National Photo Company Collection | public domain | https://commons.wikimedia.org/wiki/File:Tabulating_machines,_Census_LCCN2016823353.jpg | #how plate and preview |
| assets/hollerith-census-machine.jpg | Hollerith census machine at CHM | Tomwsulcer | CC0 | https://commons.wikimedia.org/w/index.php?curid=46063689 | footer stamp |
| assets/hollerith-punched-card.jpg, card-puncher-census.jpg, playfair-piecharts.jpg | see 01-03 summary | | | | preview frame only (shown on interaction) |

The credits paragraph names all eight (the preview can show any of them); links go to the source pages in the same tab. Five different pictures are on the page without interaction. No picture is drawn in code.

## Critique (references/critique.md format)

```
ROUND 1 (desktop-page-01/02, tablet-page-01, mobile-page-01; my own section screenshots at 1440 and 390; hover and open states)
Seen in one second: a huge white "출처" on dark slate beside an old census form, then pale-blue and slate fields.
Idea (one sentence): This week's six members' Notion entries become a stack of folders, then the bars, slip, spines and card back of the same stationery; the sources are the material.
Live thing: pointing at a folder tab previews that member's entries; the bars open in place; every spine opens its question on the sheet.
Layout words by section: hero=stack / sources=giant word + bars / how=slip / contents=shelf / footer=card back
Scores: design 7.5 · usability 8.0 · creativity 8.0 · content 7.5 -> overall 7.8
Caps applied: none (0 FAIL, four or more real pictures, 16+ elements move).
Top three problems:
1. (phone) Plates stacked above the giant word made a caption read as an eyebrow: the inspector failed [eyebrow] "1890년 미국 인구조사 조사표" above "출처". Fix: on tablet and phone the plates follow the bars (deviation from the plan's "above"). Done.
2. (desktop-page-01 shelf) With 18px labels ten spines filled 45% of the width and the right half was ground. Fix: spines at the lead step, 22em tall, up to 132px wide: the shelf now spans 1376px. Done.
3. (desktop-page-02 footer) Credits ran 123 characters per line (inspector [measure] WARN). Fix: 72ch. Done.
ROUND 2 (after the fixes; inspector re-run)
Scores: design 7.5 · usability 8.0 · creativity 8.0 · content 7.5 -> overall 7.8. No new problem a stranger would notice except: the plate pair left a void under the Nightingale plate; tightened its offset (150px to 96px). Stopped after two rounds.
Remaining (not fixed): the tall spines carry only one short vertical run each, so the lower third of every spine is blank paper; the page is 5.6 screens; no footage.
```

Final check for content that failed to appear after the motion layer: the inspector sheets caught slip rows and spines mid-entrance only; with the page scrolled fully every below-the-fold `[data-reveal]` had `.is-in`, and under reduced motion the smoke run asserts every `[data-reveal]` is at opacity 1 and translate none.

## Verification (real outputs)

| Command | Result |
|---|---|
| `node scripts/smoke.mjs home` | `PASS home`, `SMOKE: 1 passed, 0 failed` |
| `node scripts/smoke.mjs` (all) | `PASS skeleton`, `PASS home`, `SMOKE: 2 passed, 0 failed` |
| `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` | `RESULT: 0 FAIL, 0 WARN` |
| `node .claude/skills/design-taste-frontend/scripts/inspect.mjs index.html --allow empty-screens` (Task 1) | exit 0, `RESULT: 0 FAIL, 1 WARN` |
| `node .claude/skills/design-taste-frontend/scripts/inspect.mjs index.html` (Task 2, no --allow) | exit 0, **`RESULT: 0 FAIL, 1 WARN — measurements pass.`** |
| `node --test "tests/**/*.test.mjs"` | `tests 86, pass 86, fail 0` |
| `grep -nE 'id="(sources\|how\|contents)"' index.html` | lines 45, 65, 77 |
| `grep -n "writing-mode" css/home.css` / `grep -n "tabular-nums" css/home.css` | present (lines 879, 1227 / 751) |
| `grep -n 'class="credits"' index.html` | line 107 |
| credits.json one-liner (8 entries, files exist) | exit 0 |

The one remaining WARN is `no-footage`. **Defence:** no honest clip exists for this subject (RESEARCH Open Question 5: the only candidates were unrelated footage or a 64.8 MB film over the 25 MB cap), so the one moving picture is a scroll-linked drift on the census-form photograph.

Not run: the Task 2 `human-check` (a person scrolling the page on a desktop and a phone with and without the OS reduce-motion setting); the reduced-motion path was exercised only through the smoke kit's `reducedMotion` page. The follow-through from a spine into the sheet is left to the 01-06 gate as the plan says.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Caption read as an eyebrow above "출처" on tablet and phone**
- **Found during:** Task 1 inspect run. **Fix:** plates follow the bars on one-column widths instead of sitting above the giant word (plan said "stacked above it on a phone"). **Files:** css/home.css. **Commit:** c31a788

**2. [Rule 1 - Bug] Credits measure of 123 characters per line**
- **Found during:** Task 1 inspect run. **Fix:** `max-width: 72ch`. **Commit:** c31a788

### Plan-text refinements (decisions, not behaviour changes)

- **Spines** use the lead step (26px) and are 22em (about 570px) tall and up to 132px wide, not 18px / 420px / 30-34px: with ten questions the blueprint's size left a thin shelf at 1440 (the plan's own condition); no redraw was needed. The shelf stands on an ink board.
- **Task split:** the footer and the motion layer were already in the working tree when the run was resumed after a rate limit, so they landed in the Task 1 commit; Task 2's commit is the verification and critique work.
- **Accordion:** `details::details-content` with `interpolate-size` (progressive: browsers without it open instantly) instead of the grid-template-rows recipe, which cannot animate a closing native `details`.
- **Scallops:** a fixed-height strip with an SVG clipPath, because a CSS mask of radial gradients would trip the no-gradients rule.
- **`scripts/smoke.mjs`** (01-01 file) gained a `reducedMotion` option on `open()`; two lines, no behaviour change for existing scenarios.

**Total deviations:** 2 auto-fixed bugs plus the decisions above. **Impact:** none on scope.

## Authentication Gates

None.

## Known Stubs

- Member names `스터디원 4/5/6` and all of `quizzes/*.json` remain SAMPLE DATA from 01-01; the home sections render whatever the set holds.
- The sections need JavaScript (they are built from the set); the static HTML carries the headings, the footer, the credits and the plates, and the folder carries the noscript sentence.
- `#past-weeks` stays hidden until Phase 4.

## Threat Flags

None beyond the plan's register. T-01-12: credit links are same-tab (smoke asserts any `target="_blank"` carries `rel="noopener noreferrer"`; static-safety test green). T-01-13: spine hrefs use the index entry id only after the `YYYY-Www` check, `encodeURIComponent`, and a `q1..q10` check; all text through `el()` / `textContent`. T-01-SC: no installs.

## Issues Encountered

- The run was interrupted by an API rate limit and later paused by the user; work resumed from the uncommitted tree. Port 8080 was held by another process, so my own preview server used 8123 (stopped at the end).
- `agent-browser screenshot` ignores relative paths; absolute Windows-style paths worked.
- Untracked and pre-existing files (`.claude/skills/`, `skills-lock.json`, `.planning/WINDOWS.md`, `.planning/milestone.lock`, `.planning/state.json`, the modified `.planning/config.json`) were left unstaged as instructed.

## Next Phase Readiness

01-05 and 01-06 can reuse `.plate`, the eight pictures and `assets/credits.json` (additions only). 01-06 prunes pictures used by neither page (the unused ones today are none: all eight appear in the home credits), runs the full smoke including the spine follow-through into the sheet, and re-runs `inspect.mjs index.html` with no allowance.

## Self-Check: PASSED

index.html, css/home.css, js/home.js, scripts/smoke/home.smoke.mjs and scripts/smoke.mjs exist on disk; commits c31a788 and 80b814f are ancestors of HEAD on `gsd/phase-1-quiz-core`.
