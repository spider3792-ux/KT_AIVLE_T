---
phase: "2"
slug: "weekly-generator"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 2 — Validation Strategy

> Derived from 02-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node v25.7.0; engines ≥22) |
| **Config file** | none — `package.json` `"test": "node --test \"tests/**/*.test.mjs\""` |
| **Quick run command** | `node --test tests/<file>.test.mjs` |
| **Full suite command** | `npm run check` (tests + validate + lint:design) |
| **Estimated runtime** | ~10 s |

---

## Sampling Rate

- **After every task commit:** `node --test tests/<changed-area>.test.mjs`
- **After every plan wave:** `node --test "tests/**/*.test.mjs"`
- **Before `/gsd-verify-work`:** `npm run check` green + manual dry-run checklist D1–D8 signed off
- **Max feedback latency:** 30 seconds

---

## Per-Requirement Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| GEN-01 | Skill well-formed & wired (frontmatter, triggers, order intake → validator → check-set, no commit/push) | static lint | `node --test tests/skill.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-01 | Intake accepts folder, .zip, nested zip, pasted text, connector JSON dump, `--files` | CLI | `node --test tests/intake-inputs.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-02 | KST window, latest-Friday rule, ISO week id, weekend roll-forward, previous-set exclusion | unit + CLI | `node --test tests/week.test.mjs tests/intake-window.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-03 | Boilerplate stripped (both template variants); none in records.json; check-set rejects boilerplate | unit + integration | `node --test tests/template.test.mjs tests/intake-clean.test.mjs tests/check-set.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-04 | 7+3, 4 choices, verbatim code — validator on golden set + mutations | integration | `node --test tests/e2e.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-05 | `distractorFrom` validity | unit | `node --test tests/check-set.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-06 | Time estimator within 10–20 min | unit | `node --test tests/check-set.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-07 | Validator contract on intake-derived records; bounded fix loop text in SKILL.md | integration + static | `node --test tests/e2e.test.mjs tests/skill.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-08 | CP949 (all 11,172 syllables path), BOM, UTF-16, .xlsx, .ipynb, .py; file name carried to `file` | unit + integration | `node --test tests/cp949.test.mjs tests/csv.test.mjs tests/xlsx.test.mjs tests/practice.test.mjs` | ❌ W0 | ⬜ pending |
| GEN-09 | Sparse gate (6 records / 3 authors), lowCode, needs-decision; SKILL.md stop-and-ask before writing | integration + static | `node --test tests/intake-gate.test.mjs tests/skill.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/helpers/zip-writer.mjs`
- [ ] `tests/fixtures/notion-export-W42/` (both template variants per `notion-connector-samples.md`)
- [ ] `tests/fixtures/practice/` (CP949 CSV, .xlsx, .ipynb, .py)
- [ ] `tests/fixtures/sparse/`
- [ ] `.gitignore`: `work/`
- [ ] `package.json` scripts `intake`, `check-set` (do not change `check`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Korean trigger loads `weekly-quiz` (not `notion-api`) | GEN-01 | LLM routing | D1 in a fresh Claude Code session |
| Intake report shown before any question | GEN-01 | conversation order | D2 |
| Stops and asks on sparse week | GEN-09 | conversation | D3 |
| Fix loop until validator passes | GEN-07 | LLM behaviour | D4 |
| Blind self-check acted on | GEN-04 | LLM behaviour | D5 |
| Only `quizzes/<id>.json` changes, no commit | GEN-10 boundary | git state | D6 |
| Question quality (concept + 실무, harder code questions, plausible distractors) | GEN-04/05 | semantic judgement | D7 |
| Overwrite prompt for existing `quizzes/2026-W42.json` | O3 | conversation | D8 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
