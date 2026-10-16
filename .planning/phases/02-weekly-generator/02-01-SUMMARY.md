---
phase: 02-weekly-generator
plan: 01
subsystem: weekly-generator
tags: [node, dates, iso-week, kst, cli, zero-dependency]
requires:
  - phase: 01-quiz-core
    provides: isRealDate in validate-core.mjs, quizzes/index.json and set shape, validate-quiz.mjs CLI conventions
provides:
  - scripts/lib/week-core.mjs pure week math and report builder
  - scripts/week.mjs CLI (npm run week) with --today, --quizzes, --json
  - work/ git-ignored
affects: [02-02 weekly-quiz skill, 03 publish]
tech-stack:
  added: []
  patterns: [UTC-midnight date arithmetic, injected readSet for pure report builder, Exit class CLI with exit 2 on bad input]
key-files:
  created: [scripts/lib/week-core.mjs, scripts/week.mjs, tests/week.test.mjs]
  modified: [package.json, .gitignore]
key-decisions:
  - "Previous set = newest index entry whose id is strictly below the target week id (not the first index entry), so re-making the newest week (sample 2026-W42 shares the first real week's id) does not exclude its own sources"
requirements-completed: [GEN-02]
status: complete
commits: 2
plan_head_before: 6f136f302941e06ebe643af3cbd9746a800ae483
plan_head_after: 30e396c6f6d1142d85f63c5c4e21476a2c94ab29
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
duration: about 15 min
completed: 2026-10-17
---

# Phase 2 Plan 01: Week helper Summary

**Zero-dependency `npm run week` that returns the Friday-to-Friday question window, the ISO week id of that Friday (KST-aware) and the previous set's used sources (author + date + title) as JSON for the weekly-quiz skill.**

## Accomplishments
- Pure core (`kstToday`, `addDays`, `fridayOnOrBefore`, `isoWeekId`, `computeWindow`, `pickPreviousSet`, `usedSources`, `buildReport`) with no fs/process/local-time Date; date validity reuses the checker's `isRealDate`.
- CLI mirrors validate-quiz.mjs (Exit class, BOM-stripping readJson, Korean messages, `process.exitCode`); exit 0 ok, exit 2 for bad date, missing option value, unknown option, missing/invalid index.json, unreadable previous set.
- Plain output for 승환 (3 lines, previous set list, `참고:` notes) and `--json` for the skill.
- `work/` added to `.gitignore`; `package.json` gains `week` script only (`check` unchanged, no dependencies).
- 18 new tests (112 total, all pass); `npm run check` green (lint 0 FAIL).

## Report JSON key list (interface for plan 02-02)
`today`, `isFriday`, `window {from, to}`, `weekId`, `previous` (`{id, title, used: [{author, date, title}]}` or `null`), `notes` (Korean strings).

## Clarification recorded: newest-equals-target
CONTEXT said "previous set = newest set in quizzes/index.json". Implemented as the newest entry with id strictly below the target week id. `--today 2026-10-16` therefore gives `previous: null` (the invented sample 2026-W42 is the target week itself), and `--today 2026-10-23` gives previous 2026-W42 with six used entries. Commented above `pickPreviousSet`.

## Task Commits
1. Task 1 (tracer): `1545485` - date to window + week id via core, CLI and npm script
2. Task 2 (tdd): `30e396c` - previous-set exclusion, Korean notes, bad-input handling, work/ ignored, vector tables

## Deviations from Plan
None - plan executed as written. (TDD RED was confirmed for Task 2 as one test-first run failing on the missing export, then GREEN; committed as a single feat commit per the plan's two-task structure.)

## Known Stubs
None.

## Threat Flags
None. T-02-01..03 mitigations implemented (input validation with exit 2, work/ ignored, basename-only set read, no writes).

## Self-Check: PASSED
Files exist (week-core.mjs, week.mjs, week.test.mjs); commits 1545485 and 30e396c are ancestors of HEAD.
