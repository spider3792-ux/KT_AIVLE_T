---
phase: 01-quiz-core
plan: 03
subsystem: ui
tags: [home-hero, folder-stack, index-with-preview, motion, archival-pictures, design-taste-frontend]

requires:
  - phase: 01-quiz-core/01
    provides: "js/site.js (el, loadWeek, loadMembers, store), js/grade.js sourceLabel, home DOM hooks, smoke kit"
  - phase: 01-quiz-core/02
    provides: "static-safety guard over js/ and the HTML pages, package.json, npm test"
provides:
  - "Home hero 'Tabbed folder stack': dark ground, two back folders carrying the six member tabs, open front folder = 이번 주 시험지 with the name picker, #preview frame and the single teal 풀기 시작"
  - "Index with preview: a member tab (hover, keyboard focus, tap) shows that member's entries this week, how many questions cite each, and a subject plate; Esc / second tap clears"
  - "js/boot.js (html.js guard) and js/motion.js (reveal, stagger) for every page; shared motion tokens, entrance rules and the .plate picture treatment in css/site.css (now frozen for wave 3)"
  - "assets/: eight credited public-domain / CC0 pictures of the world of data and study + assets/credits.json"
  - "scripts/smoke/home.smoke.mjs (scenario 'home')"
affects: [01-04, 01-05, 01-06, phase-04]

actuals:
  tokens: 11472
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 2a7df5a2e34f5333b48a4a86dd59cedee86055ca
plan_head_after: 9eace94f20b69e19017c74e72aaf711a589a9a64

tech-stack:
  added: []
  patterns:
    - "Entrance = CSS animation (fill-mode backwards) on the independent `translate` property, gated by html.js + prefers-reduced-motion: no-preference; an element's own transform/transition (hover, press) keeps working after it"
    - "First-screen elements carry data-reveal=\"load\" with a 4s CSS failsafe, so a failed module never leaves the hero invisible"
    - "Stagger indexes through CSSOM style.setProperty('--i') (allowed by the CSP; no style attributes)"
    - "One picture treatment: .plate = greyscale + contrast, mix-blend-mode multiply on --surface, square corners, fixed ratio"
    - "Preview plates fetched on first interest, not on page load"

key-files:
  created:
    - css/home.css
    - js/boot.js
    - js/motion.js
    - assets/credits.json
    - assets/hollerith-punched-card.jpg
    - assets/card-puncher-census.jpg
    - assets/census-form-1890.jpg
    - assets/tabulating-machines-census.jpg
    - assets/hollerith-census-machine.jpg
    - assets/card-catalog-drawers.jpg
    - assets/playfair-piecharts.jpg
    - assets/nightingale-mortality.jpg
    - scripts/smoke/home.smoke.mjs
  modified:
    - index.html
    - css/site.css
    - js/home.js

key-decisions:
  - "Two back folders with three member tabs each (3+3), not one or two tabs per band: three bands would push 풀기 시작 to y=934 at 1440x900; two bands put the button bottom at 843 (desktop) and 806 (390x844)"
  - "The tab whose entries are previewed turns to paper (--bg), not full --ink: an ink tab is invisible against the dark ground / dark folder behind the rear band"
  - "Tablet (<900px) uses the phone's one-column folder; the frame stays closed until a tab is tapped, then opens directly above the name picker"
  - "Preview frame fixed at 280px (180px 3:4 plate + text) so nothing shifts when the pointer moves"

patterns-established:
  - "Pictures per subject: Pandas -> Hollerith card, 데이터 분석 -> tabulating machine, 데이터 시각화 -> Playfair / Nightingale (alternating by source number), 머신러닝 -> card puncher, Python -> 1890 census form, idle / no entries -> card-catalogue drawers"
  - "Interim inspector allowance for home: --allow few-pictures,empty-screens (01-04 runs with none)"

requirements-completed: [DSGN-01, DSGN-02, QUIZ-01, QUIZ-05, FMT-05]

coverage:
  - id: D1
    description: "First screen: dark ground, 이번 주 시험지 as one line, folder stack with six member tabs, open front folder with the name picker and the one teal 풀기 시작, visible without scrolling at 1440x900 and 390x844"
    requirement: "DSGN-01, QUIZ-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs home (#start bottom <= innerHeight at 1440x900 and 390x844; six radios; a tab per member; 풀기 시작 is the only rgb(13,116,128) control)"
        status: pass
      - kind: automated_ui
        ref: "inspect.mjs index.html --allow few-pictures,empty-screens: RESULT 0 FAIL"
        status: pass
    human_judgment: true
    rationale: "Whether the stack reads as file folders and not cards is a visual judgement (plan human-check)"
  - id: D2
    description: "Member tab preview: title, M/D, subject and question counts of that member's entries, plus an assets/ plate with Korean alt; by pointer, keyboard focus and tap; Esc / second tap clears"
    requirement: "QUIZ-05"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs home (hover, focus, Esc at 1440; real touch tap and second tap at 390; plate img loads, naturalWidth > 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Eight real archival pictures downloaded with licence and credit recorded"
    requirement: "DSGN-01"
    verification:
      - kind: other
        ref: "credits.json one-liner (8 entries, every file exists); assets.mjs --credits"
        status: pass
    human_judgment: false
  - id: D4
    description: "Page moves on load and keeps every word visible without scripts / under reduced motion; all copy Korean; no sideways overflow at 390px; every name option at least 44px tall"
    requirement: "DSGN-02, FMT-05"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs home (scrollWidth <= innerWidth at 390; labels >= 44px; lang ko)"
        status: pass
      - kind: automated_ui
        ref: "inspect.mjs: 14 elements moved (WARN under 16, see Interim allowance); reduced-motion fallback is structural (hidden state only inside prefers-reduced-motion: no-preference)"
        status: pass
    human_judgment: true
    rationale: "Feel of the motion (timing, crossfade) needs a human eye; reduced-motion behaviour was not run in a browser with the preference on"

duration: 19 min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 03: Folder-stack home with member-tab preview Summary

**Home hero built as the dealt "Tabbed folder stack": the six members are the trapezoid tabs of two back folders on a dark ground, the open front folder is this week's 시험지 with the name picker and the one teal 풀기 시작, pointing at (or tapping) a tab shows that member's entries and how many questions cite them beside a credited archival plate, all on shared motion helpers (boot.js, motion.js) and a one-treatment picture set.**

## Performance

- **Duration:** 19 min (about 07:15Z to 07:34Z, start not timestamped; estimated from the previous commit)
- **Tasks:** 2 (both `auto`)
- **Files:** 3 modified, 13 created (about 11.5k tokens of text by chars/4, pictures excluded)
- **Commits:** 2 task commits (measured from the ledger, see frontmatter)

## Accomplishments

- **Task 1 (3b17cb9):** `index.html`, `css/home.css`, `js/home.js`, `js/boot.js`, `js/motion.js`; the HOME block left `css/site.css`, which now holds only shared tokens, base, type, `.button`, motion tokens + entrance rules, `.plate`, `.sr-only`, `.nums`. `.gitignore` already contained `.taste-skill/inspect/` and `.taste-skill/shots/` from 01-01, so no change was needed.
- **Task 2 (9eace94):** the preview frame logic in `js/home.js`, eight pictures plus `assets/credits.json`, `scripts/smoke/home.smoke.mjs`.
- Design record: skill `design-taste-frontend` invoked and the sheet reprinted with `draw.mjs --show` at the start of both tasks. Direction "The page is the object", seed 990815287, hero "Tabbed folder stack", palette "Frost and slate", motion "Index with preview". Redraw (carried from CONTEXT): Noto Serif KR in Literata's role. No new redraw.

## Folder and tab arrangement chosen

- **Folders:** two back bands (`--band-step` 64px desktop, 52px phone) plus the open front folder. Rear band `#b6c6cc` (ink text 7.8:1), second band `#456069` (paper text 6.4:1), front folder `--bg`. They alternate light / dark / paper so each differs in lightness from its neighbour and from the `--ink` ground.
- **Tabs:** three member names per band (3+3), so the tab rows read left / centre / right on both bands (desktop x = 2/33/63% and 15/45/72%; phone 2/36/70% and 3/35/67%). One tab per band would need six bands (front folder top at y 824), two per band three bands (front folder top 632, button bottom 934); neither fits 900px. With two bands the front folder top is 587 and `#start` bottom is **843 at 1440x900**, **806 at 390x844** (measured by the smoke run).
- Tab names 18px (15px on a phone), tab height 40px (32px), trapezoid by `clip-path` (24px / 14px slants). Active tab ring is drawn inside the clip in the tab's own ink so the slanted corners cannot hide it.
- Front folder: its own tab "시험지" at the left, `h1` at 144px (10vw, one line at 1440; 96px at 768; 15vw on two lines at 390), `#week-title` sentence in `--bg` on the dark ground.

## Pictures (assets/credits.json; `assets.mjs --credits`)

All downloaded with `assets.mjs --get`, one family (archival data-processing and statistical graphics), one treatment (`.plate`: greyscale, multiply on `--surface`, square corners). The source's thumbnail presets rounded `--width 1400` up/down to 1280, so every file is 1280 px wide (the Hollerith card is its native 1200, the whole folder is 2.6 MB). Never presented as the members; alt text describes the picture.

| File | Title | Creator | Licence | Source page |
|---|---|---|---|---|
| assets/hollerith-punched-card.jpg | Hollerith Punched Card (1895) | unknown | public domain | https://commons.wikimedia.org/wiki/File:Hollerith_Punched_Card.jpg |
| assets/card-puncher-census.jpg | This is a card puncher, an integral part of the tabulation system used by the United States Census Bureau (c. 1940, NARA) | unknown | public domain | https://commons.wikimedia.org/wiki/File:Card_puncher_-_NARA_-_513295.jpg |
| assets/census-form-1890.jpg | 1890 U.S. Census form | unknown | public domain | https://commons.wikimedia.org/wiki/File:1890_U.S._Census_form.jpg |
| assets/tabulating-machines-census.jpg | Tabulating machines, Census LCCN2016823353 | National Photo Company Collection | public domain | https://commons.wikimedia.org/wiki/File:Tabulating_machines,_Census_LCCN2016823353.jpg |
| assets/hollerith-census-machine.jpg | Hollerith census machine at CHM | Tomwsulcer | CC0 | https://commons.wikimedia.org/w/index.php?curid=46063689 |
| assets/card-catalog-drawers.jpg | Wooden Card Catalog Furniture | MarkBuckawicki | CC0 | https://commons.wikimedia.org/w/index.php?curid=68147692 |
| assets/playfair-piecharts.jpg | Playfair piecharts (1801) | William Playfair | public domain | https://commons.wikimedia.org/wiki/File:Playfair_piecharts.jpg |
| assets/nightingale-mortality.jpg | Nightingale-mortality (1858) | Florence Nightingale | public domain | https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg |

Looked at and rejected: the MIT physical-examination photograph (nude figures and a catalogue card with typed text, not suitable) and Playfair's wheat chart GIF (low-resolution, aliased). Both were downloaded, viewed, deleted and their credit entries removed. No picture is drawn in code; the network worked. Credits are not yet on a page: the footer line is 01-04's job (`assets.mjs --credits` prints it).

For 01-04 / 01-05: `.plate` (4:3) and `.plate--tall` (3:4) live in `css/site.css`. Portrait pictures: census form, tabulating machines. Landscape: card, card puncher, both charts, drawers (4:3), census machine (square-ish).

## Critique round (references/critique.md format)

```
ROUND 1 (index.html: desktop-fold, tablet-fold, mobile-fold, desktop-page-01; smoke hover and tap screenshots)
Seen in one second: a huge white "이번 주 시험지" on dark slate over a stack of pale-blue and slate folders with names on their tabs.
Idea (one sentence): This week's six members' Notion entries become the tabs of a stack of file folders; the open front folder is the exam sheet.
Live thing: the member tabs preview that person's entries and question counts beside an archival plate; the name picker feeds 풀기 시작.
Layout words by section: hero=centred statement / stack=tabbed folders / front folder=picker + preview frame
Scores: design 7.0 · usability 8.0 · creativity 7.5 · content 6.5 -> overall 7.2
Caps applied: fewer than four real pictures on the page at load (1 image in the DOM before interaction; design <= 6.5 is the inspector's few-pictures allowance); still page (14 moved, under 16). Both are the interim allowance, closed by 01-04.
Top three problems:
1. (desktop-fold) The idle preview frame showed a plate and an empty right half: the idle sentence was never written into the frame, and the smoke run had not asserted it. Fix: write the idle line at setup; smoke now asserts the idle text. Done.
2. (desktop-fold, rear band) Names on the pale rear tabs read lighter than the bold names on the dark band (dark ink on light renders thinner). Fix: tab weight 600 on both bands. Done.
3. (tablet-fold) 260px of empty ground between the sentence and the stack at 768x1024 (the 51svh rule suits 900px desktops). Fix: below 900px the hero ends after its sentence plus 72px. Done.
Remaining (not fixed here): the front folder runs 100+px of empty paper below the button at 1440x900 and the page is 1.1 screens; the sections, the moving picture and the full-width fullness belong to 01-04. In the frame the entries are short (one per member in the sample), so the frame has spare room that a real week with 2-4 entries per member will use.
```

Rounds used: 1 of 3 (the inspector re-run and fresh screenshots after the fixes show the idle sentence, equal tab weights and the tighter tablet hero).

## Interim inspector allowance handed to 01-04

`inspect.mjs index.html --allow few-pictures,empty-screens` is the gate of this plan: `RESULT: 0 FAIL, 2 WARN`.

- `few-pictures` and `empty-screens`: closed by 01-04 (home sections with pictures and fullness). 01-04 runs with no allowance.
- WARN `still-page`: 14 elements moved (needs 16). Defended for this plan: the entrances of the first screen are all here; section entrances and the one moving picture arrive with 01-04's sections.
- WARN `no-footage`: no honest clip chosen yet; 01-04 either adds one or defends it (RESEARCH Open Question 5).

## Verification (real outputs)

| Command | Result |
|---|---|
| `node scripts/smoke.mjs home` | `PASS home`, `SMOKE: 1 passed, 0 failed` |
| `node scripts/smoke.mjs` (all) | `PASS skeleton`, `PASS home`, `SMOKE: 2 passed, 0 failed` |
| `node scripts/smoke.mjs skeleton` (after Task 1) | `PASS skeleton`, `SMOKE: 1 passed, 0 failed` |
| `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` | `RESULT: 0 FAIL, 0 WARN` |
| `inspect.mjs index.html --allow few-pictures,empty-screens` | exit 0, `RESULT: 0 FAIL, 2 WARN` (no-footage, still-page) |
| `node --test "tests/**/*.test.mjs"` | `tests 86, pass 86, fail 0` (static-safety covers index.html, js/home.js, js/motion.js, js/boot.js) |
| boot.js / home.css head one-liner | exit 0 |
| `grep -n "data-member" index.html js/home.js` | line in js/home.js (tabs are built from members.json, so they carry data-member only in script; index.html has none) |
| `grep -nE "export (function\|const) (reveal\|stagger)" js/motion.js` | lines 5 and 39 |
| `grep -n "prefers-reduced-motion" css/site.css` | lines 256 and 289 |
| `grep -n "taste-skill/inspect" .gitignore` | line 1 |
| `credits.json` one-liner (8 entries, files exist) | exit 0 |
| `grep -n 'id="preview"' index.html` | line 31 |

Not run: the Task 2 `human-check` (a person pointing at and tapping each tab on a real desktop and phone); recorded as coverage D1 with `human_judgment: true`. Reduced-motion was not exercised in a browser (the smoke kit has `reducedMotion` for `newPage` but the scenario does not use it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Idle preview frame was empty**
- **Found during:** Task 2 critique of the inspector screenshot
- **Issue:** `setupPreview` replaced the frame's children but never wrote the idle sentence, so the frame showed only a picture. The first smoke run passed anyway because it did not assert the idle text.
- **Fix:** write the idle line at setup; the smoke scenario now asserts it.
- **Files modified:** js/home.js, scripts/smoke/home.smoke.mjs. **Commit:** 9eace94

**2. [Rule 1 - Bug] Layout failures found in my own screenshots (tablet and phone)**
- **Found during:** Task 1
- **Issue:** at 768px the three-column picker wrapped names and the last back tab ran past the stack; at 390px tabs of the second band overlapped and one ran off the right edge (viewport expanded to 400px); an empty grid track stretched and pushed the picker down on tablet.
- **Fix:** tablet breakpoint at 899px with the one-column folder, tab positions re-spaced, `align-content: start` on the folder grid.
- **Files modified:** css/home.css. **Commit:** 3b17cb9

**3. [Rule 2 - Missing critical] Motion failure safety**
- **Issue:** with the hidden state in CSS, a failing module would leave the first screen invisible.
- **Fix:** `data-reveal="load"` first-screen elements get a 4s CSS failsafe; `reveal()` also has the load + 2500ms safety net.
- **Files modified:** css/site.css, js/motion.js. **Commit:** 3b17cb9

### Plan-text refinements (decisions, not behaviour changes)

- **Tabs per band 3+3** (plan allowed one or two per band): see "Folder and tab arrangement".
- **Active tab fill is paper, not ink** (plan: "full --ink fill"): ink on the dark ground or the dark band is invisible for the tabs of the two back bands; paper also ties the tab to the paper front folder that holds the preview.
- **Entrance via `animation` on `translate`**, not a transition, so hover/press transforms on tabs are not swallowed by a long reveal transition (the recipe in motion.md uses transition + transform, which would have clobbered `.tab:hover`).
- **`stagger(container, selector, start = 0)`** gained an optional third argument (the SKELETON signature stays valid); `reveal()` uses rootMargin -4% and threshold 0.05 instead of the skill's -12% / 0.1 so first-screen elements near the fold are not left for the safety net.
- **Pictures at 1280 px** instead of `--width 1400` (the source's thumbnail presets); eight pictures (plan said 6-8) after rejecting two.
- **`.plate`, `.plate--tall`, `.sr-only`, `.nums` added to css/site.css** now, because site.css is frozen for wave 3 and 01-04/01-05 need the shared picture treatment.
- **`.gitignore`** needed no change (01-01 already created it with both lines), so it was not in either commit.
- Phone tabs are 32px tall as the blueprint says; the 44px rule is asserted for the name options (labels), not for the tabs, which are a preview control with a name-picker fallback below.

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing-critical) plus the decisions above. **Impact:** none on scope.

## Authentication Gates

None.

## Known Stubs

- Member names `스터디원 4/5/6` and all of `quizzes/*.json` remain SAMPLE DATA from 01-01.
- The tabs and the preview need JavaScript (members come from members.json). Without script the front folder shows only the noscript sentence and the static hero; the 출처 list in 01-04 is the plain fallback the plan names.
- `#past-weeks` stays hidden until Phase 4.

## Threat Flags

None beyond the plan's register. T-01-11: the preview is built with `el()` / `textContent` only (static-safety test green; no HTML-string sinks); `style.setProperty` is used for `--i` and `object-position` (CSSOM, allowed by the CSP). T-01-10: only public-domain and CC0 pictures; credits recorded in `assets/credits.json` (page credit is 01-04's footer). T-01-09 accepted as planned. T-01-SC: no installs.

## Issues Encountered

- The first home smoke run passed although the idle frame was empty; I looked at the screenshots, found it, and added the assertion (see deviation 1).
- `assets.mjs --get --width 1400` produced 1920 px files (and 1280 once a smaller width was requested); the heavy ones were re-downloaded at 1280 and the old files and credit entries removed.
- Untracked and pre-existing files (`.claude/skills/`, `skills-lock.json`, `.planning/WINDOWS.md`, `.planning/milestone.lock`, `.planning/state.json`, the modified `.planning/config.json`) were left unstaged as instructed.

## Next Phase Readiness

01-04 can add the home sections below the folder stack in `css/home.css` (site.css is frozen), reuse `.plate` and the eight pictures, put the footer credits line from `assets.mjs --credits` on the page, remove the interim inspector allowance, extend `scripts/smoke/home.smoke.mjs` with the four-pictures floor, and add the 출처 list that doubles as the no-script fallback. 01-05 and 01-06 add `<script src="js/boot.js"></script>` to `quiz.html` and import `reveal` / `stagger` from `js/motion.js`.

## Self-Check: PASSED

All created files exist on disk; commits 3b17cb9 and 9eace94 are ancestors of HEAD on `gsd/phase-1-quiz-core`.
