---
phase: "1"
slug: "quiz-core"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 01-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built into Node v25.7.0; Node 22+ required) |
| **Config file** | none — `package.json` `"type": "module"`, discovery by quoted glob |
| **Quick run command** | `node --test "tests/**/*.test.mjs"` |
| **Full suite command** | `npm run check` then `node scripts/smoke.mjs` |
| **Estimated runtime** | ~5 s quick, ~60 s full (smoke drives Chrome) |

Note: `node --test tests/` (bare directory) fails on Node 25 — always use the quoted glob.

---

## Sampling Rate

- **After every task commit:** `node --test "tests/**/*.test.mjs"` (+ `node .claude/skills/design-taste-frontend/scripts/lint.mjs .` after any HTML/CSS/JS task)
- **After every plan wave:** `npm run check` and `node scripts/smoke.mjs`
- **Before `/gsd-verify-work`:** full suite green; `inspect.mjs index.html` 0 FAIL; `inspect.mjs quiz.html` 0 FAIL with only documented `--allow` rules; screenshots at 1440/768/390 reviewed
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| FMT-01 | Sample set has header, range, sources, 10 questions | unit/CLI | `node scripts/validate-quiz.mjs quizzes/2026-W42.json` | ❌ W0 | ⬜ pending |
| FMT-02 | choice = 4 unique choices + index in range; short = non-empty accepted list | unit | `node --test tests/validate.test.mjs` | ❌ W0 | ⬜ pending |
| FMT-03 | Required per-question fields; sourceIds-or-file; concept ref | unit | `node --test tests/validate.test.mjs` | ❌ W0 | ⬜ pending |
| FMT-04 | Every checker rule fires with Korean message and exit 1 | CLI | `node --test tests/cli.test.mjs` | ❌ W0 | ⬜ pending |
| FMT-05 | Index validated; newest first; home shows first as 이번 주 | unit + smoke | `node scripts/validate-quiz.mjs quizzes/index.json` + smoke | ❌ W0 | ⬜ pending |
| QUIZ-01 | Pick name once, no login, remembered | smoke | `node scripts/smoke.mjs` | ❌ W0 | ⬜ pending |
| QUIZ-02 | 10 li in ol; 3 pre code verbatim; white-space pre | smoke | `node scripts/smoke.mjs` | ❌ W0 | ⬜ pending |
| QUIZ-03 | Answer persists across reload | unit + smoke | `node --test tests/storage.test.mjs` + smoke | ❌ W0 | ⬜ pending |
| QUIZ-04 | Blank-count dialog; submit freezes attempt | smoke | `node scripts/smoke.mjs` | ❌ W0 | ⬜ pending |
| QUIZ-05 | 390px: no overflow, ≥44px targets, flow completes | smoke + inspect | `node scripts/smoke.mjs` | ❌ W0 | ⬜ pending |
| RSLT-01 | Normalization table; blank = wrong | unit + smoke | `node --test tests/grade.test.mjs` | ❌ W0 | ⬜ pending |
| RSLT-02 | Result block precedes each question with 정답/오답 + answer | smoke | `node scripts/smoke.mjs` | ❌ W0 | ⬜ pending |
| RSLT-03 | Explanation ≤5 lines | unit + smoke | validator rule + smoke | ❌ W0 | ⬜ pending |
| RSLT-04 | Concept and "작성자 · M/D" source shown | unit + smoke | `node --test tests/grade.test.mjs` + smoke | ❌ W0 | ⬜ pending |
| RSLT-05 | Score total/개념/코드 matches gradeSet() | unit + smoke | `node --test tests/grade.test.mjs` + smoke | ❌ W0 | ⬜ pending |
| DSGN-01 | House rules; one direction | lint + inspect + manual | `lint.mjs .` ; `inspect.mjs index.html` / `quiz.html` | tools present | ⬜ pending |
| DSGN-02 | All UI Korean, lang=ko | smoke | `node scripts/smoke.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` (type=module, scripts, no deps)
- [ ] `js/grade.js` + `tests/grade.test.mjs`
- [ ] `js/storage.js` + `tests/storage.test.mjs`
- [ ] `scripts/lib/validate-core.mjs` + `scripts/validate-quiz.mjs` + `tests/validate.test.mjs` + `tests/cli.test.mjs`
- [ ] `tests/fixtures/` broken sets
- [ ] `scripts/serve.mjs`, `scripts/smoke.mjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screenshot critique per design-taste-frontend `references/critique.md` | DSGN-01 | Visual judgement | Open `.taste-skill/inspect/*` at 1440/768/390 for home, quiz (blank), quiz (graded); write critique, fix top 3, re-inspect (max 3 rounds) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
