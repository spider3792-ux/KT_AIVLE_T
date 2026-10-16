# Phase 2: weekly-generator — Context

**Gathered:** 2026-10-16
**Status:** Ready for planning
**Source:** User decisions in session (PROJECT.md Key Decisions) + Phase 1 outputs

<domain>
## Phase Boundary

A Claude Code **project skill** that 승환 runs by saying "이번 주 퀴즈 만들어 줘" (or similar). It takes that week's Notion "개인 복습 기록" entries (and optional practice files), selects the week's entries, cleans them, shows a short intake report, generates one 10-question set (7 concept + 3 code-analysis; choice + short answer only) as `quizzes/<id>.json`, runs the Phase 1 validator until it passes, and shows the result. Generation is done by Claude itself inside Claude Code (Pro subscription) — **no API key, no external LLM call, no server**.

Out of scope here (Phase 3): adding the set to `quizzes/index.json` + commit/push/deploy (GEN-10). The skill MAY write the set file and print the exact next step, but must not commit/push.

Requirements: GEN-01..GEN-09.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Shape of the deliverable
- Project skill at `.claude/skills/weekly-quiz/SKILL.md` (Korean trigger phrases in the description: "이번 주 퀴즈 만들어 줘", "퀴즈 출제", "주간 문제 만들기"). Follow Claude Code skill conventions (frontmatter `name`, `description`; concise body; reference files for long rubrics). The `anthropic-skills:skill-creator` skill may be consulted for authoring conventions.
- Deterministic work lives in **zero-dependency Node scripts** (Node 22+, ES modules, like Phase 1), invoked by the skill:
  - `scripts/intake.mjs` — read input (Notion Markdown export folder or .zip, a pasted-text file, or a JSON dump the skill writes from the Notion connector), normalize entries, apply the week window, strip template boilerplate, parse practice files, and write `work/<week-id>/records.json` + print a Korean intake report (기록 수, 작성자, 날짜 범위, 사용 가능한 코드 블록 수, 빈 작성자/템플릿만 있는 기록 경고, 기준 미달 여부).
  - The existing `scripts/validate-quiz.mjs` (+ `--sources work/<week-id>/records.json`) is the gate. Reuse `scripts/lib/validate-core.mjs` `parseRecords` / `checkAgainstRecords` — Phase 1 isolated the records shape there precisely so this phase can extend it (`{ records: [ { id, author, date, title, subject, codeBlocks: [string], files: [string] } ] }`); extend rather than fork.
- Question writing (the creative part) is done by Claude following SKILL.md + a reference rubric file; the skill then runs the validator and fixes until it passes (GEN-07). Code for code-analysis questions is copied verbatim from `records.json` codeBlocks (validator enforces).
- Working files go to `work/` (gitignored). Only the final `quizzes/<week-id>.json` is a deliverable.

### Input paths (priority order)
1. **Notion Markdown export** (Notion "Export → Markdown & CSV", folder or .zip) of the "개인 복습 기록" database — the default weekly path. The export contains a CSV of the database (properties: 복습 제목/title, 작성자, 과목, 날짜, …) plus one .md per page. Research must confirm exact structure (file naming with hash suffixes, CSV encoding/BOM, date formats like "2026년 10월 14일" or "October 14, 2026", how person properties appear) and whether a **guest with full access** can export; if not, document the fallback.
2. **Pasted text** — 승환 pastes page contents into chat; the skill saves it to a file and intake parses it (best-effort, same normalization).
3. **Notion connector** (Claude's notion MCP tools, if the target DB is reachable in the session): the skill may fetch pages and write a JSON dump for intake. Today only the user's own "(견본)" copy is reachable — use it as a realistic fixture source, never assume the team DB is reachable.

### Week window (locked)
- Entries whose `날짜` (KST date) is from last Friday through this Friday inclusive, **excluding entries already used by the previous published set** (read `sources` of the newest set in `quizzes/index.json`; match by author+date+title). Weekend/after-Friday entries roll into next week. Week id = ISO week of the Friday, e.g. `2026-W42`. The skill shows the computed window and lets 승환 override it.

### Cleaning (GEN-03)
- Template boilerplate removed: placeholder bullets "리스트", code blocks whose only content is `# 여기에 코드`, prompt-only lines ("어떤 부분이 어려웠나?:", "처음 내가 생각한 방법:", "막힌 이유:", "해결 과정:", "AI에게 물어봤다면 AI는 어떻게 답을 제시했는지:", "최종 코드 또는 정답:", "무엇을 알게 되었는지:") with nothing after them, empty headings. Template headings themselves (01. 오늘 배운 내용 … 04. 한 줄 인사이트, 핵심 개념, 내 말로 설명, 직접 작성한 코드) become section labels, not content.
- Each record keeps sections: 핵심 개념, 내 말로 설명, 직접 작성한 코드 (code blocks), 어려웠던 내용 (+막힌 이유), 해결 방법 (+최종 코드), 한 줄 인사이트.
- 작성자 empty → use the name found in the title (titles look like "김준수 …" in the calendar) → else "작성자 미상" + warning. Names must map to `members.json` (김준수, 이주현, 차승환, 송지희, 노아영, 정보경).

### Question rules (GEN-04/05/06) — enforced by rubric + validator
- 7 `concept`: important keyword's concept + its practical use (실무에서의 쓰임). 3 `code`: show verbatim code from a record; ask which analysis stage (수집·전처리·EDA·시각화·모델링·평가 …) or what analysis purpose it serves — harder than concept questions.
- Types: `choice` (4 options, one answer) and `short` (accepted-answers list incl. common variants). No essay, no self-grading (user decision).
- Distractors draw on members' "어려웠던 내용 / 막힌 이유" (GEN-05) — record in the set which question used which misconception (e.g. optional `distractorFrom` field ignored by the site, or in explanation).
- Explanation ≤5 lines; `concept: {name, ref}` uses a named official-doc section (no URLs — LLMs fabricate links); `sourceIds` point to records; practice-file questions use `file`.
- Spread: at most 2 questions per record, round-robin across authors where possible; target 10–20 min (`estimatedMinutes` 12–18).
- Blind self-check before finishing: for each choice question, re-solve without looking at the key and confirm exactly one option is defensible.

### Sparse weeks (GEN-09)
- If fewer than 6 usable records or fewer than 3 authors → stop and ask 승환 whether to proceed (options: proceed anyway / widen window / stop). If fewer than 3 usable code blocks, say how code questions will be handled (ask).

### Practice files (GEN-08)
- Accept `.py`, `.ipynb` (drop outputs), `.csv` (strict UTF-8 → fallback EUC-KR/CP949, strip BOM; profile: columns, dtypes guess, row count, a few sample rows), `.xlsx` (zero-dep parse is hard: research whether a minimal zip+XML reader in Node is reasonable, else ask user to save as CSV — decide in research). Files become records-like sources with `files: [name]`; questions from them carry `file` and the explanation names the file.
- No files → Notion only (default).

### Testing
- `node --test "tests/**/*.test.mjs"` (quoted glob). Fixtures: a synthetic Notion export folder (CSV + .md pages, with boilerplate, empty 작성자, code blocks, an out-of-window entry, a weekend entry), a CP949 CSV, an .ipynb. Use the "(견본)" Notion copy via connector as reference for real-world shapes.
- End-to-end acceptance: run intake on the fixture export → records.json; hand-written (or skill-produced) set → validator with `--sources` passes; boilerplate never appears in records.json.

### Language
- Skill dialogue, intake report, questions, explanations: Korean.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/PROJECT.md` (Context: Notion template, week window), `.planning/REQUIREMENTS.md` (GEN-01..09)
- Phase 1: `scripts/validate-quiz.mjs`, `scripts/lib/validate-core.mjs` (rule table, `parseRecords`, `checkAgainstRecords`), `js/grade.js` (normalizer used for short answers), `quizzes/2026-W42.json` (reference set), `members.json`, `tests/fixtures/records-2026-W42.json`
- `.planning/phases/01-quiz-core/01-02-SUMMARY.md` (Korean message stems for matching)
- Notion "(견본)" DB reachable via connector: database `436a56db-4768-4c86-947a-961e51d9c424`, data source `collection://4753331e-8493-4a79-809b-a734f7fb1ba0` (properties: 복습 제목, 작성자, 과목, 날짜, 이해도, 같이 얘기해요). The team's real DB has 작성자/과목/날짜/오늘의 학습 기록 — schemas differ slightly; intake must tolerate both.
</canonical_refs>

<specifics>
- The intake report is shown before any question is written (GEN success criterion 1).
- The skill never invents sources, authors or dates; labels are built by the site from `sources[]`.
- After a passing set: print the validator 통과 line and the next manual step (Phase 3 will automate index + push).
</specifics>

<deferred>
- Adding to `quizzes/index.json`, commit/push, GitHub Pages → Phase 3 (GEN-10)
- Direct team-DB reading when the team workspace is connected → v2 (V2-01)
</deferred>

---
*Phase: 02-weekly-generator*
*Context gathered: 2026-10-16*
