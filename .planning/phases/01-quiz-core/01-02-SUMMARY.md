---
phase: 01-quiz-core
plan: 02
subsystem: tooling
tags: [validator, node-test, zero-dependency, korean-errors, grading-tests]

requires:
  - phase: 01-quiz-core/01
    provides: "js/grade.js (shared grading module), quizzes/2026-W42.json sample week, quizzes/index.json, members.json"
provides:
  - "scripts/lib/validate-core.mjs: pure validateSet, validateIndex, memberNames, parseRecords, checkAgainstRecords"
  - "scripts/validate-quiz.mjs: CLI (exit 0 ok / 1 errors / 2 usage or unreadable), routes index.json to the week-list check"
  - "package.json: type=module, scripts (serve, test, validate, smoke, lint:design, check), no dependencies"
  - "tests/: grade, validate, cli and static-safety suites (84 tests) plus broken-structure, broken-sources and records fixtures"
  - "README.md: sample-data notice, three member names to confirm, run / validate / test"
affects: [01-03, 01-04, 01-05, 01-06, phase-02]

actuals:
  tokens: 18455
  tasks: 2
  commits: 2

commits: 2
plan_head_before: bbd36c9b4057ea7bbca673509dacd5d32eb28f6c
plan_head_after: e2a55635894f50a6ba5d380f5855a4f2cd95230f

tech-stack:
  added: []
  patterns:
    - "Pure validator core (no fs, no process) + thin CLI; collect every problem, never stop at the first"
    - "Located Korean messages: path prefix questions[i] (qN) / sources[i] (sN) / index[i] (id), then a fixed message stem"
    - "Records format isolated in parseRecords / checkAgainstRecords so Phase 2 can change it in one place"
    - "Static-safety guard tests that prove they bite (self-check on synthetic bad inputs, mutation run)"

key-files:
  created:
    - package.json
    - scripts/lib/validate-core.mjs
    - scripts/validate-quiz.mjs
    - tests/grade.test.mjs
    - tests/validate.test.mjs
    - tests/cli.test.mjs
    - tests/static-safety.test.mjs
    - tests/fixtures/broken-structure.json
    - tests/fixtures/broken-sources.json
    - tests/fixtures/records-2026-W42.json
    - README.md
  modified: []

key-decisions:
  - "parseRecords throws an Error starting with the Korean stem (입력 기록 파일 형식이 올바르지 않습니다) and the CLI maps it to exit 2 (unreadable input), not exit 1"
  - "With --sources, a code question that cites no sourceIds is matched against every record's code blocks instead of being skipped"
  - "The 참고 line about skipping the records cross-check prints only when --sources is absent"
  - "No change to js/grade.js or quizzes/2026-W42.json was needed: the sample passes every rule with 0 errors and 0 warnings"

patterns-established:
  - "Message stems are the contract with Phase 2 (listed below); tests assert them with includes(), paths with includes('(qN)')"
  - "CLI tests write temp files under fs.mkdtempSync(os.tmpdir()) and clean up in after()"

requirements-completed: [FMT-01, FMT-02, FMT-03, FMT-04, FMT-05, RSLT-01, RSLT-03]

coverage:
  - id: D1
    description: "Author runs the checker on the correct sample week: Korean 통과 line, exit 0, no warnings"
    requirement: "FMT-04"
    verification:
      - kind: unit
        ref: "tests/validate.test.mjs: the sample week with members.json has 0 errors"
        status: pass
      - kind: other
        ref: "tests/cli.test.mjs: the sample week passes with a 통과 line"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every broken rule (count, mix, 3 choices, answer range, unknown source, bad date/author, 6-line explanation, code rules, concept, provenance) is rejected with a located Korean message"
    requirement: "FMT-01, FMT-02, FMT-03, FMT-04"
    verification:
      - kind: unit
        ref: "tests/validate.test.mjs: one test per rule"
        status: pass
      - kind: other
        ref: "tests/cli.test.mjs: broken-structure.json and broken-sources.json exit 1 with every stem"
        status: pass
    human_judgment: false
  - id: D3
    description: "--sources rejects a source missing from the input records and code that differs by one space"
    requirement: "FMT-04"
    verification:
      - kind: unit
        ref: "tests/validate.test.mjs: checkAgainstRecords cases"
        status: pass
      - kind: other
        ref: "tests/cli.test.mjs: records copy re-indented by a single space exits 1 with 원문"
        status: pass
    human_judgment: false
  - id: D4
    description: "quizzes/index.json week list: newest first, file = quizzes/ID.json, exact-case file exists, set id matches"
    requirement: "FMT-05"
    verification:
      - kind: unit
        ref: "tests/validate.test.mjs: index cases (unsorted, wrong path, wrong-case via fake listQuizFiles, id mismatch)"
        status: pass
      - kind: other
        ref: "node scripts/validate-quiz.mjs quizzes/index.json prints 통과: 주차 1개"
        status: pass
    human_judgment: false
  - id: D5
    description: "Short-answer grading pinned: GroupBy, full-width, spaced and () variants grade the same; -1 and 1 differ; five-line rule shared with the checker"
    requirement: "RSLT-01, RSLT-03"
    verification:
      - kind: unit
        ref: "tests/grade.test.mjs (normalizer table, gradeQuestion, gradeSet 10/7/3, sanitizeAnswers)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Browser code stays free of HTML-string sinks and regex lookbehind; pages keep CSP, lang=ko, external scripts only"
    verification:
      - kind: unit
        ref: "tests/static-safety.test.mjs (plus a mutation run that planted innerHTML in js/ and saw the guard fail)"
        status: pass
    human_judgment: false
  - id: D7
    description: "README tells the reader the sample week is sample data and which three member names to confirm"
    verification:
      - kind: other
        ref: "grep -n 샘플 README.md; grep -n 스터디원 4 README.md"
        status: pass
    human_judgment: true
    rationale: "Whether the Korean README reads clearly to the study members needs a human read"

duration: 10 min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 02: Set checker and pinned grading Summary

**Zero-dependency week-set checker (pure core plus a three-exit-code CLI) that passes the sample and rejects broken sets with one located Korean line per problem, a `--sources` cross-check against input records down to a single space of code, and 84 tests pinning grading, rules, CLI behaviour and browser-code safety.**

## Performance

- **Duration:** about 10 min (2026-10-16T07:03Z to 07:13Z)
- **Tasks:** 2 (both `auto`; Task 1 `tdd`)
- **Files created:** 11 (about 18.5k tokens by chars/4)
- **Commits:** 2 task commits (measured from the ledger, see frontmatter)

## Accomplishments

- **Task 1 (5068054):** `package.json` (type=module, scripts, no dependencies), `validateSet` + `memberNames`, the CLI, `tests/grade.test.mjs` (13 tests) and `tests/validate.test.mjs`. TDD order held: the validate suite was written first and failed with `ERR_MODULE_NOT_FOUND`, then went green; grade tests passed against 01-01's module unchanged.
- **Task 2 (e2a5563):** `validateIndex`, `parseRecords`, `checkAgainstRecords`, CLI routing of `index.json` and `--sources`, two broken fixtures plus the records fixture, `tests/cli.test.mjs`, `tests/static-safety.test.mjs`, `README.md`.
- No UI was written in this plan, so the design-taste-frontend mandate did not trigger (no HTML, CSS or UI JS touched); `lint.mjs .` still reports `0 FAIL, 0 WARN`.

## Message stems (the contract Phase 2 and the tests match on)

Header: `필수 항목 X가 없습니다` · `id는 YYYY-Www 형식이어야 합니다` · `id가 파일 이름과 다릅니다 (id X, 파일 Y)` · `제목(title)이 비어 있습니다` · WARN `제목에 한글이 없습니다` · WARN `제목이 깁니다 (14자 이하 권장, 현재 N자)` · `날짜 형식이 올바르지 않습니다 (YYYY-MM-DD, 현재 X)` · `range.from(..)이 range.to(..)보다 늦습니다` · `예상 풀이 시간(estimatedMinutes)은 1 이상의 정수여야 합니다` · WARN `예상 풀이 시간은 10~20분을 권장합니다 (현재 N분)`

Questions: `10문제여야 합니다 (현재 N문제)` · `개념 7문제 + 코드 분석 3문제여야 합니다 (현재 개념 a, 코드 분석 b)` · `문제 id는 q1~q10이어야 하고 겹치면 안 됩니다` · `kind는 concept 또는 code만 쓸 수 있습니다` · `type은 choice 또는 short만 쓸 수 있습니다 (서술형 없음)` · `문제(prompt)가 비어 있습니다` · WARN `문제에 한글이 없습니다` · `객관식 보기는 4개여야 합니다 (현재 N개)` · `객관식 보기(choices[k])가 비어 있습니다` · `객관식 보기가 중복됩니다` · `정답 번호는 0~3 사이 정수여야 합니다 (현재 X)` · `단답형 인정 정답이 1개 이상 있어야 합니다` · WARN `인정 정답 A와 B가 같은 답으로 처리됩니다` · `단답형에는 choices(보기)를 넣지 않습니다` · `코드 분석 문제에는 code(코드 원문)가 있어야 합니다` · `개념 문제에는 code를 넣지 않습니다` · `code의 줄바꿈은 \n만 씁니다` · `해설(explanation)이 비어 있습니다` · `해설은 5줄 이내여야 합니다 (현재 N줄)` · WARN `해설 한 줄이 깁니다 (100자 이하 권장)` · `관련 개념(concept.name, concept.ref)이 필요합니다` · `노션 출처(sourceIds) 또는 실습 파일(file)이 필요합니다` · `출처 X가 sources 목록에 없습니다`

Sources: `출처 id가 겹칩니다` · `작성자 X이(가) members.json에 없습니다` · `주제(subject)가 비어 있습니다` · WARN `출처 날짜가 출제 범위 밖입니다` · WARN `출처 X를 쓰는 문제가 없습니다` · WARN `정답 번호가 한쪽에 몰려 있습니다`

Week list: `주차 목록이 비어 있습니다` · `주차 목록은 최신순이어야 합니다` · `file은 quizzes/ID.json이어야 합니다` · `파일이 없습니다 (대소문자까지 같아야 합니다): FILE` · `주차 파일의 id가 목록과 다릅니다` · `id가 겹칩니다`

Records (`--sources`): `입력 기록 파일 형식이 올바르지 않습니다` · `출처 X가 입력 기록 목록에 없습니다` · `출처 X의 작성자·날짜가 입력 기록과 다릅니다` · `실습 파일 F가 입력 기록에 없습니다` · `코드가 입력 기록 원문과 일치하지 않습니다 (qN)`

CLI: `통과: FILE · 10문제 (개념 7 · 코드 분석 3) · 출처 N개` · `통과: 주차 N개` · `파일이 없습니다: PATH` · `JSON을 읽지 못했어요: PATH (...)` · `참고: --sources 없이 검사해서 입력 기록 대조는 건너뛰었어요` · lines `오류 PATH: MESSAGE` / `경고 PATH: MESSAGE` on stderr.

## Verification (real outputs)

| Command | Result |
|---|---|
| `node --test "tests/**/*.test.mjs"` | `tests 84, pass 84, fail 0` (after Task 1: 43 pass; after Task 2: 84 pass) |
| `node scripts/validate-quiz.mjs quizzes/2026-W42.json` | exit 0, `통과: quizzes/2026-W42.json · 10문제 (개념 7 · 코드 분석 3) · 출처 6개`, no warnings |
| `node scripts/validate-quiz.mjs quizzes/index.json` | exit 0, `통과: 주차 1개` |
| `... quizzes/2026-W42.json --sources tests/fixtures/records-2026-W42.json` | exit 0, `통과:` line, no skip note |
| `... tests/fixtures/broken-structure.json` | exit 1; `10문제`, `개념 7`, `보기는 4개`, `정답 번호` all present (4 errors) |
| `... tests/fixtures/broken-sources.json` | exit 1; `출처 s9`, `5줄`, `날짜`, `작성자` all present (4 errors) |
| `... nope.json` | exit 2, `파일이 없습니다: nope.json` |
| `npm run validate` | both commands pass |
| `node scripts/smoke.mjs skeleton` | `PASS skeleton`, `SMOKE: 1 passed, 0 failed` (exit 0) |
| `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` | `RESULT: 0 FAIL, 0 WARN` |
| package.json one-liner (type module, no deps, test glob) / export one-liners / `grep from '../../js/grade.js'` / README greps / `test ! -f .nojekyll` | all exit 0 and print the expected lines |
| Static-safety mutation run (a temporary `js/zz-mutation.js` assigning `innerHTML`) | the guard failed as intended; file removed, suite back to 0 fail |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectations written wrong before the first run**
- **Found during:** Task 1 (RED to GREEN)
- **Issue:** two of my own test expectations disagreed with the plan's stems: the title-length count (22 characters, not 21) and the particle in `인정 정답 A와 B가` (I had typed `이`).
- **Fix:** corrected the tests to the plan's stem; the validator code already followed it.
- **Files modified:** tests/validate.test.mjs. **Commit:** 5068054

**2. [Rule 3 - Blocking] Shell quoting mangled the CLI edit**
- **Found during:** Task 2
- **Issue:** a `node -e` heredoc-style patch of `scripts/validate-quiz.mjs` lost its template literals (same quoting trap noted in 01-01). No commit contained the broken file.
- **Fix:** rewrote the whole file with the Write tool.
- **Files modified:** scripts/validate-quiz.mjs. **Commit:** e2a5563

**Plan-text refinements (not deviations in behaviour):** Task 1's CLI printed the `--sources` skip note unconditionally before Task 2 landed; Task 2 limits it to runs without `--sources`, as the plan specifies.

**Total deviations:** 2 (1 bug in my tests, 1 blocking tooling). **Impact:** none on scope.

### js/grade.js and the sample

No defect was exposed: all 13 grade tests passed against 01-01's `js/grade.js` unchanged, and the validator reported 0 errors and 0 warnings on `quizzes/2026-W42.json`. Neither file was edited, so the `coupling_justified` clause for 01-03 is moot.

## Authentication Gates

None.

## Known Stubs

None. `tests/fixtures/*` and the sample quiz are intentional SAMPLE DATA (README says so). The `--sources` records format is a proposal isolated in `parseRecords` / `checkAgainstRecords` for Phase 2 to adjust.

## Threat Flags

None beyond the plan's register. T-01-06 (BOM stripped, JSON.parse in try/catch, exit 2 with Korean text; cli.test covers invalid JSON, BOM, missing file), T-01-07 (ids restricted to q1..q10, `sanitizeAnswers` drops `__proto__`, no object merging), T-01-08 (`validateIndex` uses exact-case names from `readdirSync`), T-01-SC (package.json has no dependencies or devDependencies; nothing installed) are implemented and tested.

## Issues Encountered

- The first full test run after Task 2 was green with no failures, so I checked the guards were not vacuous: the static-safety suite carries a self-test on synthetic bad input, and a planted `innerHTML` assignment in a temporary `js/` file made it fail.
- Untracked and pre-existing files (`.claude/skills/`, `skills-lock.json`, `.planning/WINDOWS.md`, `.planning/milestone.lock`, `.planning/state.json`, the modified `.planning/config.json`) were left unstaged as instructed.

## Next Phase Readiness

01-03 can rely on `package.json` (type=module), `npm test`, and the static-safety guard staying green as it replaces the HOME block of `css/site.css` with `css/home.css` and adds pictures/motion. Phase 2 can call `node scripts/validate-quiz.mjs <set> --sources <records>` and match the stems above; if the records format changes, only `parseRecords` / `checkAgainstRecords` need to change.

## Self-Check: PASSED

All 11 created files exist on disk; commits 5068054 and e2a5563 are ancestors of HEAD on `gsd/phase-1-quiz-core`.
