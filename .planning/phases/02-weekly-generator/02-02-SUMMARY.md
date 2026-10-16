---
phase: 02-weekly-generator
plan: 02
subsystem: weekly-generator
tags: [claude-skill, rubric, node-test, korean, prompt-injection-guard]
requires:
  - phase: 02-weekly-generator
    provides: scripts/week.mjs --json (window, weekId, previous, notes)
  - phase: 01-quiz-core
    provides: validate-quiz.mjs --sources, parseRecords, checkAgainstRecords, memberNames, quizzes/2026-W42.json
provides:
  - .claude/skills/weekly-quiz/SKILL.md (ten-step workflow, report-first gate, validator loop)
  - .claude/skills/weekly-quiz/rubric.md (question contract, q1/q10 worked examples, time formula)
  - tests/skill.test.mjs (23 static and worked-example tests)
  - tests/fixtures/worked-example/ (견본 page -> records.json)
  - 02-VALIDATION.md lean map with dry-run checklist D1-D7
affects: [03 publish (index.json, commit, deploy)]
tech-stack:
  added: []
  patterns: [static tests that pin skill wiring by section literals, rubric examples deep-equal to the sample set]
key-files:
  created:
    - .claude/skills/weekly-quiz/SKILL.md
    - .claude/skills/weekly-quiz/rubric.md
    - tests/skill.test.mjs
    - tests/fixtures/worked-example/page-example.md
    - tests/fixtures/worked-example/records.json
  modified:
    - .planning/phases/02-weekly-generator/02-VALIDATION.md
key-decisions:
  - "Skill never touches quizzes/index.json and never runs git write commands; both pinned by tests"
  - "f (practice file) records live in records.json but are never in the set's sources; questions cite them with the file field"
requirements-completed: [GEN-01, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08, GEN-09]
status: complete
commits: 3
plan_head_before: 298b01072d1cdcc39a84211a01cf7e80ee0787c4
plan_head_after: 5a8e67b5711239e94a32deea7bb6faa5ef281694
actuals:
  tokens: 8700
  tasks: 3
  commits: 3
duration: about 20 min
completed: 2026-10-17
---

# Phase 2 Plan 02: weekly-quiz skill Summary

**Project skill `weekly-quiz` (ten Korean steps, intake report before any question, 6-record / 3-author stop-and-ask gate, `validate-quiz --sources` loop of at most 5 rounds, blind check, confirm-before-copy) with a rubric whose two examples equal q1 and q10 of the sample set, and 23 tests that fail if the wiring drifts.**

## Accomplishments
- SKILL.md (137 lines, description under 1024 characters with the three triggers, no other frontmatter keys); rubric.md (121 lines, sections 1-4).
- Worked example: the 견본 page converts to a records.json with both code blocks verbatim; the Phase 1 checker accepts it and rejects the same code with one extra space (message holds 원문).
- Gate command form pinned: a draft named set.json passes `validate-quiz set.json --sources records.json`.
- Only `.claude/skills/weekly-quiz/` is tracked under `.claude/skills`; `skills-lock.json` stays untracked.
- Full suite 135 pass, `npm run check` exit 0.

## SKILL.md step headings
`## 원칙`, `## 1단계 · 범위 확인`, `## 2단계 · 자료 받기`, `## 3단계 · 기록 고르기·정리`, `## 4단계 · records.json 쓰기`, `## 5단계 · 입고 보고와 멈춤 기준` (with `### 입고 보고`), `## 6단계 · 실습 파일`, `## 7단계 · 세트 쓰기`, `## 8단계 · 검사 루프`, `## 9단계 · 블라인드 확인`, `## 10단계 · 요약과 복사`.

## Required literals the tests enforce (per section)
- 원칙: 커밋, 푸시, 금지, index.json, work/, 지시, 실행하지
- 1단계: `node scripts/week.mjs --json`, 주차 id
- 2단계: 풀어, 붙여, 커넥터
- 3단계: 리스트, `# 여기에 코드`, `(스터디 때 팀원 의견을 여기에 남겨요)`, 작성 양식, 직전 세트
- 4단계: `work/<id>/records.json`, members.json, codeBlocks (and the fixture path)
- 5단계: 입고 보고, 6개, 3명, 진행, 범위 넓히기, 중단, 코드 블록
- 6단계: .py, .ipynb, .csv, .xlsx, `CSV UTF-8`, file
- 7단계: `(rubric.md)`, `work/<id>/set.json`
- 8단계: the exact gate command, 5
- 9단계: 블라인드
- 10단계: `quizzes/<id>.json`, 교체, 다른 id, 중단, index.json
- Also: every `git add|commit|push` line carries 금지; the index.json line in 원칙 says it is not edited; `### 입고 보고` sits between the step 4 and step 7 headings; the skill folder holds only SKILL.md and rubric.md.

## Rubric versus CONTEXT
No deviation from 02-CONTEXT. One clarification: CONTEXT says `estimatedMinutes` 12-18, while the rubric formula yields 13-18 for any 7 + 3 mix (the plan text for SKILL.md step 7 also said 12-18); the skill and rubric state 13-18, which is a subset and satisfies the validator's 10-20 band.

## Deviations from Plan
None - plan executed as written.

## Pending human verification
End-of-phase dry run D1-D7 (checklist in 02-VALIDATION.md "Manual-Only Verifications") has NOT been performed; it is for 승환 in a fresh Claude Code session: skill routing versus the generic Notion skill (D1), report-first order (D2), stop at the sparse-week gate (D3), fix loop to 통과 (D4), 교체 / 다른 id / 중단 prompt with no commit or index change (D5), question quality (D6), optional practice files and CP949 CSV (D7).

## Known Stubs
None.

## Threat Flags
None beyond the plan's register. T-02-04 (instruction-like text is data, practice code not executed), T-02-05 (writable paths listed, overwrite prompt), T-02-06 (validator --sources gate, records never edited to fit), T-02-07 (git write commands forbidden, work/ ignored) are implemented and test-pinned. No packages added.

## Task Commits
1. Task 1: `8892c9a` - rubric, worked-example fixtures, rubric/worked-example/gate tests
2. Task 2: `298c612` - SKILL.md and the static workflow tests
3. Task 3: `5a8e67b` - lean 02-VALIDATION.md with the dry-run checklist

## Self-Check: PASSED
Files exist (SKILL.md, rubric.md, skill.test.mjs, both worked-example fixtures, 02-VALIDATION.md); commits 8892c9a, 298c612, 5a8e67b are ancestors of HEAD.
