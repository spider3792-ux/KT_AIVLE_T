---
phase: "2"
slug: "weekly-generator"
status: ready
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-16"
---

# Phase 2 — Validation Strategy (lean)

> Describes the verification that exists for the lean scope (CONTEXT, revised 2026-10-17). The heavy design in 02-RESEARCH.md (intake parser, zip/xlsx readers, CP949 decoder, check-set) is deferred and has no tests here.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` on Node 25 (engines >= 22), zero dependencies |
| **Quick run command** | `node --test tests/week.test.mjs tests/skill.test.mjs` |
| **Full suite command** | `node --test "tests/**/*.test.mjs"` (quoted glob) |
| **Phase gate** | `npm run check` (tests + validate + lint:design) |
| **Estimated runtime** | about 10 s |

---

## Per-Requirement Verification Map

| Req | Automated command | Human-only part (dry run) |
|-----|-------------------|---------------------------|
| GEN-01 | `node --test tests/skill.test.mjs` (frontmatter, three triggers, inputs folder/paste/connector, intake report before step 7) | D1, D2 |
| GEN-02 | `node --test tests/week.test.mjs tests/skill.test.mjs` (window, KST, ISO week, previous-set exclusion; skill step 3 wording) | D2 |
| GEN-03 | `node --test tests/skill.test.mjs` (step 3 boilerplate list, step 8 search of set.json) | D6 |
| GEN-04 | `node --test tests/skill.test.mjs` (rubric examples equal q1/q10) + `node scripts/validate-quiz.mjs quizzes/2026-W42.json --sources tests/fixtures/records-2026-W42.json` | D6 |
| GEN-05 | `node --test tests/skill.test.mjs` (rubric rule "막힌 이유") | D6 |
| GEN-06 | `node --test tests/skill.test.mjs` (time formula 1 / 1.5 / 2 / 2.5 gives 13..18 for any 7 + 3 mix and 15 for the sample) | - |
| GEN-07 | `node --test tests/skill.test.mjs` (step 8 command and 5 rounds, gate command form with a draft named set.json, one-space code change rejected with 원문) | D4 |
| GEN-08 | `node --test tests/skill.test.mjs` (step 6: .py .ipynb .csv, .xlsx and garbled CSV -> CSV UTF-8, file) | D7 (optional) |
| GEN-09 | `node --test tests/skill.test.mjs` (step 5: 입고 보고, 6개 / 3명 gate, 진행 / 범위 넓히기 / 중단) | D3 |

---

## Wave 0 / Sampling

- No scaffolding needed beyond the files plans 02-01 and 02-02 create (`scripts/week.mjs`, `scripts/lib/week-core.mjs`, `tests/week.test.mjs`, `tests/skill.test.mjs`, `tests/fixtures/worked-example/`, the skill folder).
- After each task: the quick command. After each plan: the full suite. Before verify-work: `npm run check`.

---

## Manual-Only Verifications

End-of-phase (`workflow.human_verify_mode` = end-of-phase). The executor does not simulate this; 승환 performs it in a fresh Claude Code session opened in this repository (the Notion "(견본)" copy is reachable through the connector; alternatively use a small exported folder). Expected result in brackets.

- [ ] **D1.** Say "이번 주 퀴즈 만들어 줘". [The weekly-quiz skill is used, not the generic Notion skill; it runs `node scripts/week.mjs --json` and shows 출제 범위 2026-10-09 ~ 2026-10-16 and 주차 id 2026-W42.]
- [ ] **D2.** Give the 견본 copy (connector) or the exported folder. [A "입고 보고" appears BEFORE any question about the content: 기록 수, 작성자, 날짜 범위, 코드 블록 수, 제외한 기록과 이유 (the 작성 양식 template page is listed as excluded); the 견본 author is a user mention, so the name is asked once after the report.]
- [ ] **D3.** The 견본 holds one real record, fewer than the 6-record / 3-author bar. [The skill stops and offers 진행 / 범위 넓히기 / 중단 and waits.] Choose 진행.
- [ ] **D4.** [Questions are written, the validator runs with --sources, any failure is fixed and re-run (at most 5 rounds), the final output shows a line starting 통과:, and a blind re-solve of the choice questions is reported.]
- [ ] **D5.** The summary lists 10 questions with answers and asks whether to copy. Since quizzes/2026-W42.json exists: [the skill offers 교체 / 다른 id / 중단.] Choose 중단. Afterwards `git status --short quizzes/` is empty, quizzes/index.json is unchanged, and no commit or push happened.
- [ ] **D6.** Spot-check quality: 7 concept questions (keyword + how it is used in practice) and 3 code questions whose code is character-for-character the recorded code; at least one wrong option reflects the page's 막힌 이유 (MultiIndex / 두 번 연달아 groupby); no template boilerplate such as 리스트 or "(스터디 때 팀원 의견을 여기에 남겨요)" in any question.
- [ ] **D7.** Optional: add a small .py or .ipynb file and a CSV saved as CP949 when starting. [The .py/.ipynb questions cite the file name; the garbled CSV makes the skill ask for a CSV UTF-8 re-save.]

---

## Validation Sign-Off

- [x] All tasks have an automated verify
- [x] Sampling continuity: every task ran the quick command
- [x] Wave 0: nothing missing
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] Dry run D1-D7 signed off by 승환 (pending human verification)

**Approval:** automated gate green; human dry run pending
