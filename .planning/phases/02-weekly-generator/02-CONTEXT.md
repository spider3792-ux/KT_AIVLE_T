# Phase 2: weekly-generator — Context (LEAN, revised 2026-10-17)

**Gathered:** 2026-10-16 · **Revised:** 2026-10-17 (user chose the lean option to cut time)
**Status:** Ready for planning
**Source:** User decisions in session + Phase 1 outputs. 02-RESEARCH.md stays as reference, but its heavy deterministic-intake design (zip reader, .xlsx reader, CP949 UHC decoder, template parser, check-set) is **OUT OF SCOPE** for this lean version.

<domain>
## Phase Boundary

A Claude Code **project skill** `.claude/skills/weekly-quiz/` that 승환 runs by saying "이번 주 퀴즈 만들어 줘". **Claude itself reads** the week's Notion "개인 복습 기록" material (exported Markdown folder, pasted text, or the Notion connector when reachable) and optional practice files, then writes two files and gates them with the existing Phase 1 validator. Small deterministic Node helpers only where Claude is unreliable (dates/week window). No API, no server, zero npm dependencies.

Out of scope (Phase 3): adding to `quizzes/index.json`, commit/push/deploy (GEN-10).
Requirements: GEN-01..GEN-09 (lean interpretations below).
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Deliverables (keep it small: target ≤ 1 hour of execution, 1–2 plans)
1. `.claude/skills/weekly-quiz/SKILL.md` — frontmatter `name: weekly-quiz`, Korean triggers in description ("이번 주 퀴즈 만들어 줘", "퀴즈 출제", "주간 문제 만들기"); body < 300 lines; step-by-step workflow (below).
2. `.claude/skills/weekly-quiz/rubric.md` — question-writing rules + a short worked example (from `quizzes/2026-W42.json`) + the JSON schema summary.
3. `scripts/week.mjs` (zero-dep, pure core in `scripts/lib/week-core.mjs`) — prints, for a given `--today` (default now, KST): the window (last Friday → latest Friday on/before today, inclusive), the ISO week id of that Friday (e.g. `2026-W42`), and the previous set's used sources (author+date+title from the newest set in `quizzes/index.json`) to exclude. `--json` output for the skill.
4. Tests: `tests/week.test.mjs` (KST boundaries, Friday/non-Friday, `2027-01-01 → 2026-W53`, weekend roll-forward, previous-set exclusion), `tests/skill.test.mjs` (static checks: frontmatter, description ≤ 1024 chars with the 3 triggers, body length, rubric.md exists, workflow mentions validator `--sources`, stop-and-ask gate, no commit/push, never overwrite quizzes/ silently).
5. `.gitignore`: add `work/`. `package.json`: add script `"week": "node scripts/week.mjs"` (do not change `check`).
6. The new skill folder `.claude/skills/weekly-quiz/` IS committed (project source). Other installed skills under `.claude/skills/` and `skills-lock.json` stay untracked.

### Skill workflow (what SKILL.md tells Claude to do)
1. Run `node scripts/week.mjs --json` → show window + week id; let 승환 confirm or override.
2. Get the material, in this order of preference: (a) a folder path of a Notion "Markdown & CSV" export the user unzipped (Claude reads the CSV + .md files with Read/Glob); (b) pasted page text; (c) Notion connector (only if the team DB is reachable; today only the user's "(견본)" copy is). Zip files: ask the user to unzip first (no zip reader).
3. Select entries whose `날짜` is in the window and not in the previous set's used list. Clean template boilerplate per `notion-connector-samples.md` (both template variants: "리스트", "# 여기에 코드", label-only bullets, "(스터디 때 팀원 의견을 여기에 남겨요)", empty "-", the "📋 작성 양식" page itself).
4. Write `work/<id>/records.json` in the Phase 1 records contract `{ records: [ { id, author, date, title, subject, codeBlocks: [verbatim code], files: [] } ] }` (ids s1.. sorted by date, members.json order, title). Authors must be names in members.json (김준수, 이주현, 차승환, 송지희, 노아영, 정보경); empty 작성자 → name in the title → else ask.
5. **Intake report BEFORE any question** (GEN-01): 기록 수, 작성자 목록, 날짜 범위, 코드 블록 수, 제외한 기록과 이유. **Gate (GEN-09):** < 6 records or < 3 authors → stop and ask (진행 / 범위 넓히기 / 중단); < 3 usable code blocks → ask how to handle code questions.
6. Practice files (GEN-08, lean): `.py`, `.ipynb` (ignore outputs), `.csv` are read directly by Claude; if a CSV looks garbled (CP949), ask the user to re-save as "CSV UTF-8" in Excel; `.xlsx` → ask to save as CSV. Files become entries with `files: [name]`; questions from them use `file`.
7. Write `work/<id>/set.json` following rubric.md: 10 questions = 7 `concept` (중요 키워드 개념 + 실무에서의 쓰임) + 3 `code` (verbatim code from records; which analysis stage/purpose; harder); types `choice` (4 options) / `short` (accepted answers with variants) only; explanation ≤ 5 lines; `concept {name, ref}` named official-doc section (no URLs); distractors from members' "어려웠던 내용 / 막힌 이유"; ≤ 2 questions per record, spread across authors; `estimatedMinutes` 12–18.
8. Run `node scripts/validate-quiz.mjs work/<id>/set.json --sources work/<id>/records.json`; fix and re-run until 통과 (max 5 rounds; then stop and report). (GEN-07)
9. Blind self-check: re-solve each choice question without the key; exactly one defensible option, else rewrite.
10. Show a summary (10 questions with answers) and ask before copying to `quizzes/<id>.json`; if the file exists (e.g. the invented sample `2026-W42`), ask: replace / different id / stop. Never touch `quizzes/index.json`, never commit or push (Phase 3).

### Testing / verification
- Automated: `node --test "tests/**/*.test.mjs"` (quoted glob) incl. the new week + skill tests; `npm run check` stays green.
- Manual end-of-phase check (human): in Claude Code, say "이번 주 퀴즈 만들어 줘" with the 견본 copy (connector) or a small exported folder → intake report first → set passes validator → overwrite prompt for 2026-W42.

### Language
Korean for skill dialogue, report, questions, explanations.
</decisions>

<canonical_refs>
- `.planning/phases/02-weekly-generator/notion-connector-samples.md` (verbatim template + example; template-variant table)
- Phase 1: `scripts/validate-quiz.mjs`, `scripts/lib/validate-core.mjs` (`parseRecords`, `checkAgainstRecords`, Korean message stems in 01-02-SUMMARY.md), `quizzes/2026-W42.json` (reference set), `members.json`, `tests/fixtures/records-2026-W42.json`
- 02-RESEARCH.md — reference only (ISO week vectors, skill-authoring notes: description ≤1024 chars, body <500 lines, references one level deep; first-run collision with sample 2026-W42).
</canonical_refs>

<deferred>
- Deterministic intake parser, zip reader, .xlsx reader, CP949 decoder, check-set script → later only if the lean skill proves unreliable
- index.json + commit/push/deploy → Phase 3 (GEN-10)
</deferred>

---
*Phase: 02-weekly-generator (lean)*
