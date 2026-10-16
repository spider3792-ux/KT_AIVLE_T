# Phase 2: weekly-generator (주간 출제 스킬) - Research

**Researched:** 2026-10-16
**Domain:** Claude Code project skill + zero-dependency Node ingestion scripts (Notion Markdown export, CSV/xlsx/ipynb parsing, week-window logic) feeding the Phase 1 validator
**Confidence:** MEDIUM overall. HIGH for the Node/runtime facts, the Phase 1 contracts and the Claude Code skill conventions (all read or run this session). MEDIUM-LOW for the exact bytes of a real Notion export and the real template (no Notion tool was available to this researcher; see Open Questions O1/O2).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `02-CONTEXT.md` `<decisions>`.)

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

### Claude's Discretion

CONTEXT.md has no explicit "Claude's Discretion" heading. The decisions above explicitly hand these questions to research, so they are treated as discretion areas and are answered below: (a) the `.xlsx` implement-vs-"save as CSV" decision; (b) the default "this Friday" rule when the skill is run on a non-Friday; (c) exact `records.json` extensions (extra fields beyond the Phase 1 contract); (d) how the optional `distractorFrom` field is shaped; (e) the shape of the connector JSON dump and the pasted-text format; (f) how blind self-check is run.

### Deferred Ideas (OUT OF SCOPE)
- Adding to `quizzes/index.json`, commit/push, GitHub Pages → Phase 3 (GEN-10)
- Direct team-DB reading when the team workspace is connected → v2 (V2-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | 승환 runs the project skill with "이번 주 퀴즈 만들어 줘"; input = Notion Markdown export folder / pasted content / practice files (.py .ipynb .csv .xlsx) | Skill frontmatter + description draft (Skill Authoring); `intake.mjs` input matrix (folder, .zip incl. nested, pasted front-matter text, connector JSON dump); in-memory zip reader; Notion export reality check |
| GEN-02 | Only entries inside the week window and not used by the previous set | `week.mjs` design (KST, ISO week of the Friday, W53 test vector), used-entry matching by author+date+normalized title against newest set's `sources`, `--today/--week/--from/--to/--prev` overrides |
| GEN-03 | Template boilerplate ("리스트", "# 여기에 코드", empty items) never reaches question material | `template.mjs` data table, fence-first Markdown scanner, section extraction by label aliases, boilerplate scan on records.json AND on the finished set (`check-set`) |
| GEN-04 | 7 concept (keyword concept + practical use) + 3 code-analysis (stage/purpose, harder) | Rubric outline, validator 7+3 and verbatim-code rules (already enforced), `check-set` lints; semantic quality = manual review checklist |
| GEN-05 | Choice distractors reflect members' 어려웠던 내용 / 막힌 이유 | Records keep `sections.hard/stuck/firstIdea`; digest `materials.md`; `distractorFrom` field (`[{choice, sourceId}]`, no quotes) verified by `check-set` |
| GEN-06 | Estimated solve time 10~20 min | Deterministic estimator in `check-set` (seconds per type + code lines), validator already warns outside 10-20, run with `--strict` |
| GEN-07 | Skill validates and fixes until pass | Bounded loop on `validate-quiz.mjs <set> --sources <records> --strict` + `check-set`; code-mismatch diagnostic; exit-code contract |
| GEN-08 | Practice files used together with Notion; file name in source; Korean CP949 CSV readable | `practice.mjs`: .py, .ipynb (drop outputs), .csv (UTF-8 → CP949 with a verified UHC decoder), .xlsx (minimal reader, prototype verified on a real Excel file) |
| GEN-09 | Too few records (<6 or <3 authors) → tell 승환 and ask | `gate` object in records.json + report stems; SKILL.md stop-and-ask step; fixtures at the 5/6 and 2/3 boundaries |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `.claude/CLAUDE.md` [VERIFIED: read this session] plus the orchestrator brief.

- Zero cost, no server, no API, no external LLM call. Question generation happens inside Claude Code (Pro subscription).
- Hosting/build: no build step; scripts are plain ES modules (`package.json` has `"type": "module"`, `"engines": { "node": ">=22" }`, no dependencies) [VERIFIED: package.json].
- Language: dialogue, report, questions, explanations in Korean.
- GSD workflow: file edits happen through a GSD command (`/gsd-execute-phase` for this phase's plans); do not edit the repo outside a GSD workflow.
- Design mandate (design-taste-frontend) applies to UI only. Phase 2 touches no HTML/CSS/JS in the browser, so it does not trigger. Keep new fixtures free of `.html/.css/.js` files: `npm run lint:design` walks the whole repo for those extensions [VERIFIED: .claude/skills/design-taste-frontend/scripts/lint.mjs:14-25].
- Tests: `node --test "tests/**/*.test.mjs"` with the glob in quotes. Visual checks with agent-browser must write to a file with `< /dev/null` (not needed in this phase).
- Git: this phase must not commit/push `quizzes/index.json` changes (Phase 3). The skill writes the set and prints the next step only.
- Environment: Windows 11, Git Bash/PowerShell, Node v25.7.0, no Python.
- Project skills already installed that can compete with the new skill at trigger time: `notion-api` ("whenever the user asks to interact with Notion") [VERIFIED: .claude/CLAUDE.md skills table]. See Pitfall 17.

## Summary

Phase 2 is two deliverables with a hard seam between them. **Deterministic ingestion** (Node, zero dependency, fully unit-testable): read a Notion export (folder or `.zip`, including nested zips, read in memory so Windows long paths never matter), reconcile database-CSV rows with page Markdown, compute the KST week window, drop the previous set's entries, strip template boilerplate with a fence-aware line scanner, parse practice files, and emit `work/<id>/records.json` (a strict superset of the Phase 1 `--sources` shape) plus a human digest `work/<id>/materials.md` and a short Korean report. **Creative generation** (Claude, guided by SKILL.md and one rubric file): write the 10 questions, then loop on `validate-quiz.mjs ... --sources ... --strict` and a new `check-set.mjs` until both pass, run a *blind* solve in a subagent, and stop before touching `index.json`.

Key findings that change the plan relative to CONTEXT.md's assumptions: (1) **Node 25.7's `TextDecoder('euc-kr')` silently corrupts 8,822 of 11,172 Hangul syllables** (everything outside KS X 1001's 2,350); the "strict UTF-8 then euc-kr" recipe in CONTEXT is not enough for real Excel/CP949 CSVs. A 25-line algorithmic UHC extension decoder reproduces Windows' CP949 for all 11,172 syllables and is verified. (2) A **minimal `.xlsx` reader is cheap and was verified on a real Excel-produced file** (about 70 lines on top of a 45-line zip reader the Notion `.zip` path needs anyway) - implement it, with a "save as CSV" message as the failure fallback. (3) On 2026-10-16 the first real week id is `2026-W42`, **identical to the sample set's id**; intake and the skill must not silently overwrite `quizzes/2026-W42.json`. (4) The Notion export's exact bytes could not be verified (no Notion tool in this researcher's session, public docs do not specify property-line/date formats); the parsers must be tolerant, and one real export of the "(견본)" database should be captured as a fixture early (human checkpoint). (5) The Phase 1 validator checks `sources[].author/date` against records but not `title/subject`, and does not check spread, boilerplate, `distractorFrom`, or time estimate; a small `check-set.mjs` closes those gaps without forking the validator.

**Primary recommendation:** Build `scripts/lib/*` (zip, cp949, csv, xlsx, dates/week, template, notion reader, practice) test-first with synthetic and one real-Excel fixture, expose them through `scripts/intake.mjs` (writes `records.json` v2 + `materials.md`), add `scripts/check-set.mjs` (quality lint + blind kit + estimator), then write `.claude/skills/weekly-quiz/SKILL.md` + `reference/rubric.md` + `reference/input-guide.md`, and gate the whole phase with an end-to-end test that runs intake on the synthetic export and validates the existing sample set against its output.

## Architectural Responsibility Map

This phase has no browser/server tiers. Tiers here are the local layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Triggering, dialogue, asking 승환 (window override, sparse gate, overwrite confirm) | Claude Code skill (SKILL.md) | — | Needs judgment and conversation; the script only reports facts |
| Read export/zip/CSV/xlsx/ipynb, week window, used-entry exclusion, boilerplate stripping, section extraction | Node scripts (`scripts/lib/*`, `intake.mjs`) | — | Deterministic and testable; must not depend on LLM mood (GEN-02/03/08) |
| Question writing, distractor design, explanation text | Claude (rubric-guided) | — | The creative step; no API, so it is the session model |
| Structural rules (7+3, 4 choices, ≤5 lines, sources exist, verbatim code) | Validator (`validate-quiz.mjs`, Phase 1, unchanged) | — | Already the contract; do not fork |
| Extra gates (spread, boilerplate in output, sources title/subject, distractorFrom, estimate, secrets) | `scripts/check-set.mjs` (new, pure core + CLI) | Validator | Keeps Phase 1 frozen; same pure-core + thin-CLI pattern |
| Key correctness and ambiguity (blind solve) | Claude subagent (fresh context) | `check-set --blind-*` scripts for strip/grade | A model that has seen the key cannot be blind; grading reuses `js/grade.js` |
| Working state | Filesystem `work/<id>/` (gitignored) | `quizzes/<id>.json` (deliverable) | Raw exports contain teammates' content; keep out of git |
| Publish (index.json, commit, push) | Phase 3 | — | Explicitly out of scope |

## Standard Stack

### Core (Node built-ins only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs`, `node:path`, `node:url`, `node:os` | Node v25.7.0 (engines >=22) | Read inputs, write `work/`, locate repo root | Same as Phase 1 scripts [VERIFIED: scripts/validate-quiz.mjs:5-7] |
| `node:zlib` (`inflateRawSync`, `crc32`) | built-in | Zip entry inflate; `crc32` only in tests' zip writer | `typeof zlib.crc32` printed `function` on v25.7.0 [VERIFIED: ran probe] |
| `TextDecoder` (utf-8 fatal, utf-16le) | built-in | Strict UTF-8 detection, BOM stripping, UTF-16 CSV | UTF-8 BOM is stripped by default; `fatal:true` throws `TypeError` on CP949 bytes [VERIFIED: ran probe] |
| `node:test`, `node:assert/strict`, `node:child_process` | built-in | Unit + CLI tests | Phase 1 pattern [VERIFIED: tests/cli.test.mjs:1-9] |
| `js/grade.js` (`normalizeAnswer`, `gradeQuestion`) and `scripts/lib/validate-core.mjs` (`parseRecords`, `memberNames`, `isRealDate`) | Phase 1 | Reuse, never re-implement | Single source of truth for grading and records shape |

### Supporting
None. No npm packages are installed or recommended.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-repo zip reader | `adm-zip`, `yauzl`, `unzipper` | Violates the zero-dependency decision; a reader is 45 lines and prototype-verified |
| In-repo CP949 decoder | `iconv-lite` | Same; and the plain `TextDecoder('euc-kr')` is wrong for 79% of Hangul syllables (see Pitfall 3) |
| `.xlsx` minimal reader | Ask 승환 to "save as CSV" | Adds a manual step against the 10-minute weekly budget; keep only as the failure fallback |
| `exceljs`/`xlsx` (SheetJS) | — | Dependencies; rejected |

**Installation:** none (`npm install` is not needed).

**Version verification:** no registry packages are used, so `npm view` is not applicable. Runtime facts were verified by running Node v25.7.0 in this session (crc32, inflateRawSync, TextDecoder behavior, ICU 78.2).

## Package Legitimacy Audit

No external packages are installed or recommended in this phase (zero-dependency decision, `package.json` has no `dependencies`/`devDependencies` [VERIFIED: package.json]). The legitimacy gate (`package-legitimacy check`) is therefore not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 승환: "이번 주 퀴즈 만들어 줘"  (+ Export zip/folder | pasted text | connector | practice files)
        |
        v
 +----------------------- SKILL.md (Claude, Korean dialogue) ----------------------+
 | 1 ask/locate input  -> 2 run intake -> 3 SHOW REPORT -> GATE? -> 4 plan -> 5 write |
 +-----------|---------------------------------------------------------------------+
             | (a) pasted text -> work/inbox/paste.txt (front-matter entries)
             | (b) connector   -> work/inbox/dump.json  {pages:[{title,author,date,subject,markdown}]}
             v
 node scripts/intake.mjs <input> [--files ...] [--today --week --from --to --prev --alias]
   |  readZip (in memory, nested zips, NFC names, CP949 names w/o UTF-8 flag)
   |  Notion reader: .md pages (H1 + "Key: value" lines + body)  <->  database CSV rows (join by normalized title)
   |  dates.mjs  parseDate (ISO / "2026년 10월 14일" / "October 14, 2026" / slash forms) -> KST calendar date
   |  week.mjs   window = [latest Friday <= today - 7, latest Friday <= today]; weekId = ISO week of `to`
   |  previous set (quizzes/index.json[0].file -> sources) -> exclude author+date+title matches
   |  template.mjs fence-aware scan -> sections + codeBlocks, drop placeholders / prompt-only lines
   |  practice.mjs .py .ipynb .csv(cp949.mjs) .xlsx(xlsx.mjs) -> file records f1..fN
   |  gate: usable records >= 6 AND authors >= 3 ; code blocks >= 3 ; secrets/PII scan
   v
 work/<id>/records.json (v2, superset of Phase 1 shape)  +  work/<id>/materials.md (LLM-readable digest)  +  stdout report
             |
             v   [report shown to 승환 BEFORE any question is written; needs-decision -> stop and ask]
 Claude writes work/<id>/<id>.json   (rubric: reference/rubric.md)
             |
             v   loop <= 5 rounds
 node scripts/validate-quiz.mjs work/<id>/<id>.json --sources work/<id>/records.json --strict   (Phase 1, unchanged)
 node scripts/check-set.mjs     work/<id>/<id>.json --sources work/<id>/records.json            (new)
             |
             v
 blind kit: check-set --blind-out (strip key) -> fresh subagent answers -> check-set --blind-grade (uses js/grade.js)
             |
             v
 copy to quizzes/<id>.json (confirm if it exists) -> validate again on that path -> print 통과 line + next step
 (NO index.json edit, NO git)
```

### Recommended Project Structure

```
.claude/skills/weekly-quiz/
├── SKILL.md                     # workflow, < 150 lines (hard cap 500)
└── reference/
    ├── rubric.md                # question-writing rules, examples, concept.ref list, time model
    └── input-guide.md           # Korean: Notion export clicks, fallbacks, paste format, connector dump schema
scripts/
├── intake.mjs                   # CLI (thin)
├── check-set.mjs                # CLI (thin): quality lint, estimator, blind kit
└── lib/
    ├── validate-core.mjs        # Phase 1 (extend parseRecords only if needed; see Pattern 2)
    ├── zip.mjs                  # readZip (store+deflate, nested, names)
    ├── cp949.mjs                # decodeText(buf) : strict UTF-8 -> UTF-16 -> CP949 (UHC)
    ├── csv.mjs                  # RFC4180 parser + delimiter sniff + profile()
    ├── xlsx.mjs                 # readXlsx(buf) -> { sheetName: rows[][] }
    ├── dates.mjs                # parseDate(), kstToday(), isoWeekId(), fridayOnOrBefore()
    ├── week.mjs                 # computeWindow(), matchUsed()
    ├── template.mjs             # DATA: placeholders, prompt labels, section aliases ; cleanBody()
    ├── notion.mjs               # readExport(files) -> pages[] ; pasted/dump readers
    ├── practice.mjs             # .py .ipynb .csv .xlsx -> file records
    ├── records.mjs              # assign ids, gate, report text, materials.md, secrets scan
    └── quality-core.mjs         # pure checks used by check-set.mjs
tests/
├── helpers/zip-writer.mjs       # builds zips in tests (crc32 + deflateRawSync), no binary fixtures for Notion
├── fixtures/notion-export-W42/  # synthetic export (folder form); zips built on the fly
├── fixtures/practice/           # sales-cp949.csv (real Excel output), sales.xlsx (real Excel output), nb-sample.ipynb, hello.py
└── intake-*.test.mjs, zip.test.mjs, cp949.test.mjs, csv.test.mjs, xlsx.test.mjs, week.test.mjs,
    template.test.mjs, check-set.test.mjs, skill.test.mjs, e2e.test.mjs
work/                            # gitignored: inbox/, <id>/records.json, materials.md, <id>.json, blind-*.json
```

`.gitignore` currently contains only `.taste-skill/inspect/` and `.taste-skill/shots/` [VERIFIED: .gitignore]; **add `work/` before any intake run** (the folder will hold teammates' raw content).

### Pattern 1: Week window in KST (deterministic, injectable "today")

**What:** `today` = `new Date(Date.now() + 9*3600e3).toISOString().slice(0,10)` (KST has no DST). Window `to` = the latest Friday on or before today; `from` = `to - 7 days`; `weekId` = ISO week of `to`. All comparisons are string comparisons of `YYYY-MM-DD`.
**When to use:** always; `--today YYYY-MM-DD` makes tests deterministic.
**Rationale for the non-Friday rule (discretion area b):** "Friday of the ISO week containing today" would make a Monday run produce the *next* week's window; "latest Friday on or before today" always yields a finished window, matches the locked Fri-to-Fri range, and rolls weekend entries forward by definition. When `today` is not a Friday the report prints a note and the skill asks 승환 to confirm (override with `--to`). [ASSUMED: needs user confirmation, see A9]

```js
// Source: ran in scratchpad on Node v25.7.0 (outputs below)
export function isoWeekId(ymd) {               // ISO week-year of the given date
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dn = (t.getUTCDay() + 6) % 7;           // Mon=0
  t.setUTCDate(t.getUTCDate() - dn + 3);        // Thursday of this ISO week
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round(((t - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
```

Verified vectors (ran): `2026-10-16 -> 2026-W42` (Friday), `2026-10-09 -> 2026-W41`, `2027-01-01 -> 2026-W53` (Friday in a 53-week year), `2026-12-31 -> 2026-W53`, `2027-01-08 -> 2027-W01`, `2020-01-03 -> 2020-W01`, `2026-01-02 -> 2026-W01`. Use these as the unit-test table. The validator's id format is `/^\d{4}-W\d{2}$/` [VERIFIED: scripts/lib/validate-core.mjs:6 `const WEEK_ID = /^\d{4}-W\d{2}$/;`].

The sample set's range is `{ "from": "2026-10-09", "to": "2026-10-16" }` [VERIFIED: quizzes/2026-W42.json:4] - the same Friday-to-Friday convention. 2026-10-16 is a Friday (`getUTCDay() === 5`, ran).

### Pattern 2: records.json v2 = Phase 1 shape + extras (extend, do not fork)

`parseRecords` reads only `id, author, date` (required text), `title, subject` (optional strings), `codeBlocks, files` (string arrays) and ignores every other key [VERIFIED: scripts/lib/validate-core.mjs:336-364]. Verbatim, the comment that defines the contract:

```
// { records: [ { id, author, date, title, subject, codeBlocks: [string], files: [string] } ] }
```
[VERIFIED: scripts/lib/validate-core.mjs:331]. Therefore extra top-level and per-record keys are safe **without editing the validator**. Recommended shape (all additions optional for the validator):

```jsonc
{
  "version": 2,
  "week": { "id": "2026-W42", "from": "2026-10-09", "to": "2026-10-16", "today": "2026-10-16", "previousSet": "2026-W41" },
  "gate": { "status": "ok" | "needs-decision", "reasons": ["records<6","authors<3","codeBlocks<3"], "usableRecords": 6, "authors": 6, "usableCodeBlocks": 7 },
  "records": [{
    "id": "s1", "author": "김준수", "date": "2026-10-13", "title": "...", "subject": "Pandas",
    "codeBlocks": ["verbatim, \\n only, line-end whitespace stripped"],
    "files": [],
    "kind": "notion",                       // or "file"
    "sections": { "concept": [], "explain": [], "hard": [], "firstIdea": [], "stuck": [], "process": [], "aiAnswer": [], "insight": [], "other": [] },
    "codeMeta": [{ "section": "code" | "finalCode" | "other", "lang": "python" }],
    "origin": "개인 복습 기록 ... .md", "warnings": []
  }],
  "excluded": [{ "title": "...", "date": "...", "reason": "범위 이후(다음 주로 이월)" | "범위 이전" | "직전 세트에서 사용" | "양식/예시 페이지" | "날짜 없음" | "내용 없음(템플릿만)" }]
}
```

Rules:
- ids `s1..sN` ordered by `(date, memberIndex in members.json, title)`. This reproduces the sample set's ids exactly (s2 이주현 before s3 차승환 on 10-14; s4 송지희 before s5 노아영 on 10-15 because members.json order is 김준수, 이주현, 차승환, 송지희, 노아영, 정보경) [VERIFIED: members.json:3-8; quizzes/2026-W42.json:7-12].
- Practice files become separate records `f1..fN` with `kind:"file"`, `author:"(실습 파일)"`, `date` = file mtime in KST (fallback window `to`), `files:[name]`, `codeBlocks` = file code. They are cited in questions through the `file` field, not `sourceIds` (the validator accepts `sourceIds` **or** `file` [VERIFIED: validate-core.mjs:239-240], and the site labels a file-only question "실습 파일 · name" [VERIFIED: js/home.js:294-295]). They must never appear in `sources[]` (author is not in members.json).
- `codeBlocks` normalization is part of the contract with the validator, because `checkAgainstRecords` compares `codeForm(b).includes(codeForm(q.code))` where `codeForm` only converts CRLF to LF and drops one trailing newline [VERIFIED: validate-core.mjs:366-367, 398]. An LLM will not reproduce trailing spaces/NBSP/CRLF, so intake normalizes once: CRLF/CR to `\n`, NBSP (U+00A0) and zero-width characters to plain space/removed, strip trailing whitespace on every line, trim leading/trailing blank lines, keep tabs and inner indentation. The normalized text is what the validator compares against, so the loop converges.
- Tests assert the sample passes against intake output (E2E) so the superset claim is machine-checked.

### Pattern 3: Notion export reader (tolerant, layout-independent)

**What:** Treat every `.md` anywhere in the export (any depth, flat or with "Create folders for subpages") as a candidate page. Page = `# Title` first heading, then a *property block* of consecutive `Key: value` lines directly under it up to the first blank line, then body. Database CSVs (files whose name ends with ` <32hex>.csv` or ` <32hex>_all.csv`) supply the same properties; join to pages by normalized title (page H1 vs CSV title column). Properties from the page win; CSV fills gaps. Pages with no parseable date are reported and excluded (this also drops parent/index pages).

**Facts and how each is tagged**

| Fact | Tag |
|------|-----|
| Markdown & CSV export gives pages as Markdown and databases as CSV with Markdown files for their subpages; callouts export as HTML | [CITED: notion.com/help/export-your-content] |
| Guests need **Full access** to export; a workspace/teamspace owner can disable export under "Disable export" in Security; for a database you export only the current view or the default view; Form views cannot be exported (use Table) | [CITED: notion.com/help/export-your-content] |
| "Include subpages" writes nested pages as separate files; on Windows paths over 260 characters can block extraction (uncheck "Create folders for subpages" or use 7-Zip); large exports arrive by emailed link | [CITED: notion.com/help/export-your-content] |
| Exported files and folders carry a 32-hex id suffix: `Filename abc123…234567.md`; database CSVs may be duplicated with an `_all` suffix (regex `/\s[0-9a-fA-F]{32}(_all)?$/` strips it); nested zips inside the export are extracted by tools; relative links are URL-encoded | [CITED: github.com/bitbonsai/notion2obsidian README + src/lib/csv.js] |
| A shared root folder named `Export-<uuid>` is stripped by importers (`/^Export-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu`); zips at the archive root are processed recursively; Notion truncates long file names so titles come from inside the file | [CITED: github.com/obsidianmd/obsidian-importer src/formats/notion.ts, parse-info.ts] |
| `Key: value` property lines sit near the top of exported `.md` pages (tools scan the first 30 lines) | [CITED: notion2obsidian frontmatter.js `lines.slice(0, 30)`; weak: third-party tool, example keys not Korean] |
| Callouts export as `<aside>…</aside>` HTML with an icon image | [CITED: notion2obsidian callouts.js] |
| Date properties are written in the exporter's UI-language display format ("October 14, 2026" or "2026년 10월 14일"), person properties as display names, ranges as `A → B`, optional `@` prefix | [ASSUMED] - see A1/A2/A7 |
| Toggles export as `<details><summary>`; code blocks as fences with the language name | [ASSUMED] (Notion's *API* markdown uses these forms [CITED: developers.notion.com working-with-markdown-content]; the *file export* is not documented) |
| Whether `_all.csv` holds all rows/properties while the plain `.csv` holds the current view | [ASSUMED] - the naming is cited, the semantics are not documented |

**Consequence for the code:** do not depend on folder layout, on an exact property-line grammar, or on a single date format. Accept the union and report what was not understood.

**Parsing rules to implement (each is a unit-test row):**
1. Parse code fences first (state machine: opening fence of 3+ backticks or tildes with up to N leading spaces; close with same char and at least as many; unclosed fence runs to EOF). Lines inside fences are never headings, labels or bullets. A comment line `# 여기에 코드` inside a fence looks like an H1 outside one.
2. A fence indented by N spaces (inside a list item or toggle) has up to N leading spaces removed from each content line.
3. Property block: only lines matching `^[^\s#:][^:]{0,40}:\s` (split at the *first* `: `) that appear before the first blank line after the H1. Skip keys that are template labels (`핵심 개념:`) so a body that starts with a label line is not swallowed.
4. Strip: images `![...](...)` (count them in `warnings`: "이미지 N개는 읽을 수 없어요"), HTML tags (`<aside>`, `<details>`, `<summary>`, `<img>`, `<br>`) keeping inner text, `<empty-block/>`, zero-width characters; NFC-normalize all text; U+00A0 to space outside fences.
5. Title: H1 text; fall back to filename minus ` <32hex>` suffix; a leading emoji (e.g. "📋") is stripped for matching and exclusion rules.
6. Author resolution chain: property values (`작성자`, `Author`, `Created by`, `만든 사람`, `Writer`) → first value that contains a `members.json` name (substring match handles "김준수 (JunSu)" and "준수님" fails safely) → title contains a member name → `--alias "x=김준수"` → `"작성자 미상"` + warning. A record whose author is not a member is `usable:false` and listed in the report (it cannot be a validator source).
7. Date keys: `날짜`, `Date`, `작성일`, `일자`; subject keys: `과목`, `Subject`, `주제`.
8. Exclude by title: `/\(예시\)|\(견본\)|작성\s*양식|템플릿/` after emoji strip - the "(견본)" database holds "📋 작성 양식 (복사해서 쓰기)" and "10/13 Pandas groupby (예시)" [CITED: orchestrator brief], and the example page could otherwise land inside the window. Always list excluded titles in the report; keep the pattern list as data in `template.mjs`.
9. Second-level subpages (a `.md` below another row's folder with no properties) are skipped and counted.

### Pattern 4: Template cleaning + section extraction by label aliases

The real template heading levels/markup are unknown (only descriptions exist: PROJECT.md "본문 템플릿: 01 오늘 배운 내용(핵심 개념 / 내 말로 설명 / 직접 작성한 코드) · 02 어려웠던 내용(어려운 부분 / 처음 생각한 방법 / 막힌 이유) · 03 해결 방법(해결 과정 / AI 답변 / 최종 코드) · 04 한 줄 인사이트" [VERIFIED: .planning/PROJECT.md:55]). So detect **labels by text, not by markup**: for each non-fence line strip `#`s, `>`, list markers (`-`, `*`, `1.`), `**`/`__`, leading emoji, leading `NN.`, trailing `:`/`：`, then normalize (NFKC, remove spaces) and look the result up in an alias table. A hit sets the current section; any text after the colon on the same line is the first content line.

Alias table (data, 1-line edits when the template drifts):

| Canonical | Aliases (normalized, no spaces) |
|-----------|---------------------------------|
| learned (group) | 오늘배운내용 |
| concept | 핵심개념, 핵심키워드 |
| explain | 내말로설명, 내말로설명하기 |
| code | 직접작성한코드, 작성한코드 |
| difficulty (group) | 어려웠던내용 |
| hard | 어려운부분, 어떤부분이어려웠나 |
| firstIdea | 처음생각한방법, 처음내가생각한방법 |
| stuck | 막힌이유 |
| solution (group) | 해결방법 |
| process | 해결과정 |
| aiAnswer | AI답변, AI에게물어봤다면AI는어떻게답을제시했는지 |
| finalCode | 최종코드, 최종코드또는정답 |
| insight | 한줄인사이트, 무엇을알게되었는지 |

The prompt strings in the alias table come from CONTEXT's list ("어떤 부분이 어려웠나?:", "처음 내가 생각한 방법:", "막힌 이유:", "해결 과정:", "AI에게 물어봤다면 AI는 어떻게 답을 제시했는지:", "최종 코드 또는 정답:", "무엇을 알게 되었는지:") [VERIFIED: 02-CONTEXT.md decisions, Cleaning]. Group labels set a group; unknown headings keep content in `other` of the current section (robust to drift); if no label at all is recognized, the whole body goes to `other` and the report says "템플릿 형식을 못 알아봤어요".

Drop rules (data + generic): a line whose normalized text is in `{리스트, list, 내용을입력하세요}`; a fence whose trimmed content matches `/^#?\s*여기에\s*코드/` or is empty; an empty bullet (`-`, `*`, `- [ ]`); `<empty-block/>`; any label line with nothing after it; and a generic prompt-only rule: a line ≤ 40 characters ending with `?:` or `:` and no remainder. A section with no surviving content is not emitted. Provide `--show-dropped` so the strip is auditable.

"Usable record" = valid date inside window, member author, not used, not template/example, and at least 40 characters of surviving text or one usable code block. "Usable code block" = ≥ 2 non-blank lines or ≥ 25 characters after normalization.

### Pattern 5: Previous-set matching ("already used")

Read `quizzes/index.json` (newest first, validated that way by the Phase 1 checker [VERIFIED: validate-core.mjs:317-323]), open `index[0].file`, collect `sources[]` as `author|date|normTitle` where `normTitle` = NFC, trim, collapse whitespace, strip leading emoji. The skill copies `sources[].title` from `records[].title` verbatim (enforced by `check-set`, since the validator only compares author/date [VERIFIED: validate-core.mjs:381]), so the keys match exactly. Near-miss (same author+date, different title) is *not* auto-excluded; it is listed as "직전 세트에 쓴 기록일 수 있어요" and left to 승환. `--prev none|<id>` overrides. A missing or empty index means no exclusion. The existing index points at the **sample** set [VERIFIED: quizzes/index.json] whose titles are invented, so it excludes nothing real.

### Pattern 6: Intake CLI contract

`node scripts/intake.mjs <input> [--files a.py b.csv …] [--today D] [--week ID] [--from D] [--to D] [--prev none|ID] [--alias "x=이름"]… [--out work] [--quizzes quizzes] [--members members.json] [--show-dropped]`

- `<input>`: directory, `.zip` (nested zips handled), a single `.md`/`.txt` (pasted text), or `.json` (connector dump). Practice files go only through `--files` (a lone `.csv` positional is ambiguous: Notion database CSV vs practice data).
- Exit codes follow the validator's convention [VERIFIED: scripts/validate-quiz.mjs:4]: `0` records written (even when `gate.status` is `needs-decision`), `1` readable input but zero usable records, `2` usage / unreadable / invalid input.
- `--week`/`--out` values are validated against `/^\d{4}-W\d{2}$/` before any path join (no traversal).
- It never writes under `quizzes/` (only `work/<id>/`, idempotent), so it cannot clobber the sample set; it only warns when `quizzes/<id>.json` already exists.
- Report (≤ 40 lines, Korean), always printed first line = window: `출제 범위: 2026-10-09(금) ~ 2026-10-16(금) · 주차 2026-W42`; then input kind and page count; 사용할 기록 N개 · 작성자 N명 (이름 n개씩); 날짜 범위; 사용 가능한 코드 블록 N개; 제외 사유별 개수 (범위 이전 / 다음 주로 이월 / 직전 세트에서 사용 / 양식·예시 / 날짜 없음 / 템플릿만 있음); 경고 (작성자 미상, 비회원 작성자, 이미지 N개, 비밀·개인정보로 보이는 문자열, 실습 파일 읽기 실패); 기준 판정 line `기준: 기록 6개 이상 · 작성자 3명 이상 → 충족|미달`; if `quizzes/<id>.json` already exists: `주의: quizzes/2026-W42.json 이 이미 있어요 (샘플 데이터일 수 있어요)`.
- Also writes `work/<id>/materials.md`: per record a header `### s3 · 차승환 · 2026-10-14 · 제목 · 과목`, then labeled sections, code in fenced blocks, so the model reads code as code (reading JSON-escaped `\n` strings is how copy errors creep in).

### Pattern 7: Practice files

| Type | Handling | Verified? |
|------|----------|-----------|
| `.py` | `decodeText`, strip BOM, normalize like code; one `codeBlocks` entry; never executed | design |
| `.ipynb` | `JSON.parse`; `cells[]`; for `cell_type:"code"` join `source` (array of lines or a string); **drop `outputs`**; markdown cells to `sections.other`; one joined `codeBlocks` entry (cells joined by blank line) so a multi-cell snippet still matches `includes()`; count cells for the report | Real nbformat 4 notebook inspected: keys `cell_type, execution_count, metadata, outputs, source`, `source` is an array of lines [VERIFIED: ran against a local course notebook] |
| `.csv` | `decodeText` (below); delimiter sniff (`,` `;` tab); RFC 4180 parser (quotes, doubled quotes, embedded newlines, CRLF); `profile()` = columns, row count, dtype guess (int/float/date/bool/str + missing count), first 5 rows with cells cut at 40 chars; cap at 5000 rows; PII regex warn | Real Excel "CSV (쉼표로 분리)" file on this machine: no BOM, CRLF, CP949, quoted cell `"a,b ""인용"""` [VERIFIED: hex dump + decode] |
| `.xlsx` | `readXlsx` → first sheet (or all) → same `profile()`; dates detected through `cellXfs` number formats and converted from serials to `YYYY-MM-DD` | Prototype read a real Excel file correctly (Korean sheet name, sparse cells, shared strings, date serial → `2026-10-01`, formula result, second sheet) [VERIFIED: ran] |
| `.xls`, `.xlsm`, encrypted | Not supported → Korean message "엑셀에서 'CSV로 저장'해서 다시 주세요" | — |

**.xlsx decision (discretion a): implement the minimal reader.** Cost ≈ 70 lines over the shared zip reader; limits to document in the file header: no encryption, no Zip64, no `.xls`, rich-text runs concatenated, phonetic `<rPh>` removed, only cached formula values, merged cells not expanded, row cap. Failure path = the CSV message.

### Pattern 8: Skill workflow (SKILL.md)

Frontmatter (Claude Code) - `name` ≤ 64 chars lowercase/hyphen, no reserved words; `description` ≤ 1,024 chars (Claude Code truncates description + `when_to_use` at 1,536 in the listing) [CITED: platform.claude.com best-practices; code.claude.com/docs/en/skills]:

```yaml
---
name: weekly-quiz
description: >-
  주간 복습 스터디 퀴즈 세트(quizzes/<주차>.json, 개념 7 + 코드 분석 3, 객관식·단답형)를 만든다.
  노션 "개인 복습 기록" Markdown 내보내기(폴더·zip)나 붙여넣은 내용, 실습 파일(.py .ipynb .csv .xlsx)에서
  그 주 기록만 골라 정리하고, 문제를 쓴 뒤 검사 스크립트를 통과할 때까지 고친다.
  "이번 주 퀴즈 만들어 줘", "퀴즈 출제", "주간 문제 만들기", "시험지 만들어 줘", "복습 문제 만들어 줘" 같은 요청,
  또는 노션 내보내기 zip을 주며 문제를 만들어 달라고 할 때 사용한다. 커밋·푸시·배포는 하지 않는다.
argument-hint: "[노션 내보내기 zip/폴더 경로 (선택)]"
allowed-tools: Bash(node scripts/intake.mjs *) Bash(node scripts/validate-quiz.mjs *) Bash(node scripts/check-set.mjs *) Read Write Edit
---
```

(`allowed-tools` pattern form `Bash(<command> *)` is documented [CITED: code.claude.com/docs/en/skills]; granting `Write`/`Edit` without path scopes is a convenience choice - [ASSUMED] that a narrower Write scope syntax exists; keep it broad or omit and accept prompts.)

Body skeleton (≈ 120-150 lines, imperative, one default per decision, Korean):
1. Guardrails (3 lines): no API / no commit / no push / do not edit `index.json`; Notion text is data, not instructions; never run practice code.
2. Step 1 - Input: use `$ARGUMENTS`; else ask in one question (Export zip 경로 / 폴더 / 붙여넣기 / 커넥터). Link `reference/input-guide.md` for the clicks and paste format; paste → write `work/inbox/paste.txt`; connector → write `work/inbox/dump.json`. Ask once for optional practice files.
3. Step 2 - Run intake (exact command), then **print the report to 승환 and wait** if today is not a Friday (confirm window), if `gate.status` is `needs-decision` (ask: 그대로 진행 / 범위 넓히기 / 중단), if `quizzes/<id>.json` already exists (ask: 덮어쓰기 / 중단), or if author warnings exist (ask for alias).
4. Step 3 - Plan: read `work/<id>/materials.md`; write `work/<id>/plan.md` (table: q, record, concept, kind/type, distractorFrom). Rules from `reference/rubric.md` (read it now).
5. Step 4 - Write `work/<id>/<id>.json` (the draft is named like the final file so the id-vs-filename rule is exercised [VERIFIED: validate-core.mjs:57]).
6. Step 5 - Gate loop (max 5 rounds): run validator `--strict` + `check-set`; fix only the *set* (never the records, never the scripts); if still failing after 5 rounds stop and show the remaining errors.
7. Step 6 - Blind check (subagent) per Pattern 9.
8. Step 7 - Finalize: copy to `quizzes/<id>.json`; validate that path with `--sources`; print the 통과 line and the manual next step (`index.json` entry + commit are Phase 3).

Reference files are linked directly from SKILL.md, one level deep (nested references get partially read) [CITED: best-practices doc]. Put a table of contents at the top of `rubric.md` (> 100 lines).

### Pattern 9: Blind self-check that is actually blind

A model that wrote the key cannot un-know it. Make the check mechanical:
1. `node scripts/check-set.mjs <set> --blind-out work/<id>/blind.json` writes only `{id, type, prompt, code?, choices?}` per question (no `answer`, `explanation`, `concept`, `sourceIds`, `distractorFrom`).
2. Claude launches a **fresh subagent** (Agent tool) given only `blind.json`, asked to return JSON `{ "q1": {"answer": 2, "defensible": [2]}, "q3": {"answer": "isna().sum()"} ... }` where `defensible` lists every option that could be argued correct. [ASSUMED: subagent availability in the user's Claude Code; fallback = a separate pass that re-reads only `blind.json`.]
3. `node scripts/check-set.mjs <set> --blind-grade work/<id>/blind-answers.json` grades with the real `gradeQuestion` from `js/grade.js` [VERIFIED: js/grade.js:35-40], so a short answer the subagent naturally gives but the accepted list lacks shows up as a miss (add the variant or fix the stem). Reports: key mismatches, questions with `defensible.length > 1`.
4. Any mismatch → fix the question, re-run steps 1-3 for those ids (counts toward the 5-round budget).

### Pattern 10: `check-set.mjs` (new; pure core + thin CLI, Phase 1 style)

Checks (errors unless marked warn). Message stems in Korean with `questions[i] (qN)` path prefix like Phase 1 [VERIFIED: validate-core.mjs:164].

| Check | Why (not covered by validator) |
|-------|--------------------------------|
| each `sources[i].title` and `.subject` equal the record's | validator compares only author/date [VERIFIED: validate-core.mjs:381]; the site prints `source.title` publicly [VERIFIED: js/result.js:71 `block.append(line('노션 출처: ', `${sourceLabel(source)} · ${source.title}`))`] |
| at most 2 questions cite the same record (`sourceIds`); warn when fewer than min(authors, 5) distinct authors are cited (round-robin spread) | CONTEXT spread rule |
| boilerplate scan: `prompt`, `choices`, `answer`, `code`, `explanation` contain none of the placeholder/prompt strings from `template.mjs` (`리스트` as a whole word, `여기에 코드`, label stems) | GEN-03 on the *output* |
| `distractorFrom`: array of `{choice:int, sourceId}`; `choice` ≠ `answer`; `sourceId` exists and its record has non-empty `hard`/`stuck`/`firstIdea`; at least 3 choice questions carry one when the records contain any difficulty text (else warn "이번 주는 막힌 이유가 거의 없어요") | GEN-05 traceability |
| estimator: seconds = concept choice 60, concept short 75, code choice 100 + 3×lines, code short 130 + 3×lines; `minutes = round(sum/60)`; error if outside 10-20, warn if `estimatedMinutes` differs by > 3; prints the suggested value | GEN-06 (sample computes to 14 vs declared 15) [ASSUMED constants; calibrate after first real use] |
| code question: ≤ 15 lines (warn > 15); on mismatch with records print nearest block and first differing line number | helps GEN-07 converge; validator message has no diff [VERIFIED: validate-core.mjs:399] |
| `file` set ⇒ explanation or prompt mentions the file name (warn) | CONTEXT "explanation names the file" |
| no markdown/backticks/HTML in `prompt`, `choices`, `explanation` (warn) | the site renders text only [VERIFIED: js/site.js:25 `node.textContent`; js/quiz.js:186,191] |
| choice-length bias: the correct option is the strictly longest in > 60% of choice questions (warn) | classic MCQ tell |
| near-duplicate prompts inside the set (normalized equality) | quality |
| secrets/PII scan of the whole set (see Security) | the quiz is published to a public repo |

### Anti-Patterns to Avoid
- **Forking the validator or its records parser** - extend by adding keys the parser ignores; put new checks in `check-set`.
- **Extracting the zip to disk** - Windows MAX_PATH, zip-slip, leftovers of teammates' content. Read entries in memory.
- **One regex for the whole Markdown** - use the fence-first line scanner.
- **Trusting `TextDecoder('euc-kr')`** for CP949 (Pitfall 3).
- **Writing the final set only to `quizzes/`** before it passes - draft in `work/<id>/`, publish by copy after pass.
- **Letting the skill "fix" a validator error by editing records or scripts.**
- **Using the connector's raw property syntax inside intake** - the skill normalizes into the dump schema; intake never sees connector-specific shapes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Short-answer equivalence in checks | a new normalizer | `normalizeAnswer`/`gradeQuestion` from `js/grade.js` | Site, validator and tests already share it [VERIFIED: validate-core.mjs:4] |
| Set structure rules | duplicate 7+3 / 4-choice / ≤5-line logic | `validate-quiz.mjs` (Phase 1) | Single source of truth |
| Records parsing for `--sources` | a second parser | `parseRecords`/`memberNames` | "extend rather than fork" |
| Gzip/deflate | an inflater | `zlib.inflateRawSync` | built-in |
| Zip creation in tests | committed binary zips for Notion fixtures | `tests/helpers/zip-writer.mjs` (crc32 + deflateRawSync, ~20 lines, round-trip verified) | Readable fixtures, no binaries, tests nested zips and NFD names |
| Test runner | custom harness | `node:test` | Phase 1 pattern |

**Must hand-roll (no dependencies allowed) - keep each tiny and table-tested:** zip reader (45 lines), UHC decoder (25), RFC 4180 CSV (30), xlsx reader (70), Notion line scanner, Korean/English date parser, ISO week. Each has a verified prototype or a vector table in this document.

**Key insight:** the dangerous parts are not the algorithms but the *silent* failure modes (garbled Hangul, a dropped code fence, a window off by one day, a stripped blank line in code). Every one needs a test that fails loudly.

## Common Pitfalls

### Pitfall 1: The sample set shares the first real week's id
**What goes wrong:** 2026-10-16 is a Friday, so the first real run computes `2026-W42` - the id of `quizzes/2026-W42.json`, which is invented sample data [VERIFIED: README "샘플 데이터입니다"]. Copying the new set over it destroys the sample the site/tests rely on (`npm run validate`, smoke tests, static-safety tests reference it).
**How to avoid:** intake reports "이미 있어요"; the skill asks before overwriting; draft stays in `work/`. Open Question O3 asks whether to replace the sample or use `--week` override.
**Warning signs:** `git status` shows `quizzes/2026-W42.json` modified.

### Pitfall 2: Code lines starting with `#` treated as headings
`# 여기에 코드` and ordinary Python comments inside fences look like H1. Parse fences first (Pattern 3.1).

### Pitfall 3: CP949 decoding is wrong for 79% of Hangul syllables in Node
**What goes wrong:** `new TextDecoder('euc-kr')` (also labels `windows-949`, `ks_c_5601-1987`; `cp949` is rejected) decodes only KS X 1001's 2,350 syllables. Against .NET's CP949 ground truth for all 11,172 syllables: 2,350 correct, 8,822 wrong (e.g. U+AC02 bytes `81 41` decode to `"A"`; `8C 63` to `U+008C` + `c`). Common words pass (69/69 test words were fine), so the bug appears only with rarer syllables - names, slang - and produces silent garbage. Node 25.7.0, ICU 78.2 [VERIFIED: ran against Windows CP949 via PowerShell].
**How to avoid:** `cp949.mjs` decodes: ASCII; lead `0xA1-0xFE` + trail `0xA1-0xFE` through `TextDecoder('euc-kr')` (KS X 1001); otherwise the UHC extension computed algorithmically: the 8,822 non-KS X 1001 syllables in Unicode order fill lead `0x81-0xA0` × trail `{41-5A, 61-7A, 81-FE}` (5,696 cells), then lead `0xA1-0xC5` × trail `{41-5A, 61-7A, 81-A0}` (3,108), then lead `0xC6` (18 cells) = 8,822. This reproduced **11,172 / 11,172** syllables. Residual: of the 8,836 KS X 1001 cells (lead and trail both `A1-FE`) compared with .NET, 8,412 matched and 424 differed - ICU leaves unassigned or CP949-only symbol positions undecoded (e.g. `A2E6` = €, `A2E7` = ®; elsewhere .NET itself returns `?`). Those are not Hangul and are irrelevant for study CSVs. Add a golden test: the hex↔syllable pairs for ~40 extension syllables (generate once with the PowerShell one-liner in this document's Sources) plus the real Excel-saved CSV fixture. Detection order: UTF-16 BOM (FF FE / FE FF) → UTF-8 BOM → strict UTF-8 (`fatal:true`) → CP949.
**Warning signs:** `�`, stray C1 control characters (U+0080-009F) or Latin letters inside Hangul text.

### Pitfall 4: Windows long-path extraction and zip name encodings
Notion warns of >260-char path failures when extracting on Windows [CITED: notion.com help]. Reading the zip in memory avoids it. Zip entry names: use UTF-8 when general-purpose flag bit 11 is set, otherwise strict UTF-8 then CP949; NFC-normalize every name (macOS produces NFD Hangul). Verified prototype round-trip with Korean names [VERIFIED: ran]. Cap uncompressed size (e.g. 200 MB) and entry count; skip inflating images/binaries entirely.

### Pitfall 5: Nested archives and root folders
Exports can be a zip containing zip parts and/or a root `Export-<uuid>/` folder [CITED: obsidian-importer]. Recurse into `.zip` entries at the archive root only; strip the `Export-<uuid>` prefix for display; never recurse into zips attached inside pages.

### Pitfall 6: Date formats and time zones
Accept ISO (`2026-10-14`, with `T`/space time, `Z` converts to KST, `+09:00` keeps the local part), `YYYY년 M월 D일` (spaces optional, optional time `오후 3:30`), `YYYY/M/D`, `YYYY.M.D.`, English `Month D, YYYY` / `Mon D, YYYY`, ranges `A → B` (use start), `@` prefix. Slash dates with both parts ≤ 12 are ambiguous (`10/11/2026`: Notion offers Month/Day/Year and Day/Month/Year display): parse as the export's dominant interpretation when the same file contains an unambiguous date (day > 12), else flag `dateAmbiguous` and ask. Unparseable → record excluded with reason "날짜 없음". Dates are calendar dates; do not shift by timezone unless a `Z` timestamp is present.

### Pitfall 7: Property block swallowing body text
A body whose first line is `핵심 개념: …` matches `Key: value`. Property block ends at the first blank line and skips template-label keys (Pattern 3.3).

### Pitfall 8: Truncated or duplicated file names
Long titles are truncated in file names; multiple rows can share a title. Join by H1 text, fall back to filename prefix, disambiguate duplicates by CSV row order, and report duplicates.

### Pitfall 9: Calendar/filtered view exports only part of the data
Export offers "current view" or default view only [CITED: notion help]. A calendar view with a month filter or a form view silently narrows rows. `input-guide.md` instructs: export from the full database page (Table/default view), "Include content: Everything", "Include subpages" on; the intake report shows the date span so a truncated export is visible.

### Pitfall 10: Verbatim-code mismatch loops
Trailing spaces, tabs vs spaces, NBSP, CRLF, a deleted blank line, a "fixed" typo. Intake normalizes (Pattern 2); `check-set` prints nearest block + first differing line; SKILL.md rule: copy the block from `materials.md` fenced text, change nothing, JSON-escape newlines as `\n` and tabs as `\t`.

### Pitfall 11: Markdown in question text
The site renders `prompt`, choices, explanation lines and `code` with `textContent` [VERIFIED: js/site.js:25, js/quiz.js:186,191, js/result.js:62], so backticks and `**` appear literally. The sample uses plain `df.groupby('지역')`. Rubric: plain text only.

### Pitfall 12: Warnings that block under `--strict`
Strict mode fails on: title longer than 14 characters or without Hangul; `estimatedMinutes` outside 10-20; explanation line > 100 characters; a source nobody cites (`출처 X를 쓰는 문제가 없습니다`); source date outside `range`; ≥ 6 choice answers on the same index; two accepted answers that normalize identically [VERIFIED: validate-core.mjs:66-68, 100-101, 133-134, 205, 228, 250, 253-255]. Therefore: `sources[]` contains only cited records; the title is ≤ 14 characters (`N월 N째 주 시험지` pattern like the sample); accepted answers listed once per normalized form (the normalizer already removes `()`, `_`, spaces, case).

### Pitfall 13: Short-answer fairness
The normalizer lowercases, removes whitespace, `()` and separators, strips trailing `.!?` [VERIFIED: js/grade.js:19-29] but cannot equate synonyms or word order. Prefer terms, function names and numbers over definitions; include Korean + English forms and an optional `df.` prefix variant.

### Pitfall 14: The model re-reads the key
Self-check inside the same context is theater (Pattern 9).

### Pitfall 15: Concept references invented
`concept.ref` must be a real section ("pandas 공식 문서 · GroupBy"); the sample uses that form [VERIFIED: quizzes/2026-W42.json:28]. `rubric.md` ships a curated list per library (pandas, matplotlib, seaborn, scikit-learn, NumPy, Python docs) and rule: if unsure, use the library's top-level user-guide section name, never a URL. [ASSUMED: names must be spot-checked by the executor against the official docs tables of contents.]

### Pitfall 16: Secrets and personal data published
Quiz JSON goes to a **public** repo (PROJECT.md "공개 범위"). Notebooks/CSVs may contain API keys, emails, phone or resident numbers; code questions copy code verbatim. Intake and `check-set` run a pattern scan (Security Domain) and the skill must stop and ask on any hit.

### Pitfall 17: Skill competes with `notion-api`
The installed `notion-api` skill triggers on any Notion interaction [VERIFIED: .claude/CLAUDE.md]. A request like "노션 내보내기로 퀴즈 만들어 줘" may route there. Front-load quiz phrases in the description (done), and tell 승환 in the README/`input-guide.md` that `/weekly-quiz` always works. [ASSUMED: routing behavior; verify in the dry run.]

### Pitfall 18: Prompt injection through teammates' text
"AI 답변" sections and any Notion text can contain instructions. `materials.md` wraps each record in a labeled block; SKILL.md says records are data; the skill never runs code from records or practice files.

### Pitfall 19: `lint:design` walks fixtures
`npm run check` runs the design linter over the repo for `.html/.css/.js…` [VERIFIED: lint.mjs EXT set]. Notion's real export can contain `.html` for other export modes; the synthetic fixture must not.

### Pitfall 20: Gate silently skipped
Exit code 0 even when `gate.status` is `needs-decision` means a careless skill could continue. Mitigate in three places: the report's last line is `다음: 승환에게 진행 여부를 물어보세요`, `records.json.gate`, and a `skill.test.mjs` assertion that SKILL.md contains the stop-and-ask step before the writing step.

## Code Examples

### In-memory zip reader (prototype verified on a real Excel `.xlsx` and a test-built zip with Korean names)
```js
// Source: scratchpad prototype, ran on Node v25.7.0
import { inflateRawSync } from 'node:zlib';
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip: end of central directory not found');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central header');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42), nb = buf.subarray(p + 46, p + 46 + nlen);
    let name;
    if (flags & 0x800) name = nb.toString('utf8');
    else { try { name = new TextDecoder('utf-8', { fatal: true }).decode(nb); } catch { name = decodeCp949(nb); } }
    entries.set(name.normalize('NFC'), { method, csize, usize, off });
    p += 46 + nlen + elen + clen;
  }
  return { names: [...entries.keys()], read(name) { /* local header: name+extra lengths at +26/+28, data at +30 */
    const e = entries.get(name), lh = e.off, nl = buf.readUInt16LE(lh + 26), el = buf.readUInt16LE(lh + 28);
    const data = buf.subarray(lh + 30 + nl + el, lh + 30 + nl + el + e.csize);
    return e.method === 0 ? Buffer.from(data) : inflateRawSync(data);
  } };
}
```
Add before shipping: Zip64 sentinel (`0xFFFFFFFF`) → clear Korean error, size/entry caps, `usize` check against a cap before inflating (`inflateRawSync(data, { maxOutputLength })`).

### CP949 / UHC decoder (verified 11,172 / 11,172 syllables against .NET)
```js
// Source: scratchpad prototype; ground truth = [Text.Encoding]::GetEncoding(949) for U+AC00..U+D7A3
const ks = new TextDecoder('euc-kr');                    // correct only for KS X 1001 (A1-FE x A1-FE)
const T1 = [[0x41,0x5a],[0x61,0x7a],[0x81,0xfe]], T2 = [[0x41,0x5a],[0x61,0x7a],[0x81,0xa0]];
const inKs = new Set();
for (let l = 0xb0; l <= 0xc8; l++) for (let t = 0xa1; t <= 0xfe; t++) {
  const s = ks.decode(Uint8Array.of(l, t)), c = s.codePointAt(0);
  if (s.length === 1 && c >= 0xac00 && c <= 0xd7a3) inKs.add(c);          // 2350 syllables
}
const ext = []; for (let c = 0xac00; c <= 0xd7a3; c++) if (!inKs.has(c)) ext.push(c);   // 8822, Unicode order
const MAP = new Map(); let k = 0;
const fill = (l0, l1, T) => { for (let l = l0; l <= l1; l++) for (const [a, b] of T) for (let t = a; t <= b; t++) if (k < ext.length) MAP.set(l * 256 + t, ext[k++]); };
fill(0x81, 0xa0, T1); fill(0xa1, 0xc6, T2);                                     // 5696 + 3126
export function decodeCp949(buf) {
  let out = '', i = 0, run = [];
  const flush = () => { if (run.length) { out += ks.decode(Uint8Array.from(run)); run = []; } };
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) { run.push(b); i++; continue; }
    const t = buf[i + 1], ch = MAP.get(b * 256 + t);
    if (b >= 0x81 && b <= 0xc6 && ch !== undefined) { flush(); out += String.fromCharCode(ch); i += 2; continue; }
    if (b >= 0xa1 && b <= 0xfe && t >= 0xa1 && t <= 0xfe) { run.push(b, t); i += 2; continue; }
    flush(); out += '�'; i += (t >= 0x41 ? 2 : 1);
  }
  flush(); return out;
}
```
Verified output: `decodeCp949(Buffer.from('8C639BDCB6BEC7D12041424320','hex'))` returned `똠쎵뗀한 ABC`.

### Text decoding order
```js
export function decodeText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);   // Excel "유니코드 텍스트" (BOM stripped by default)
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }                    // strips a UTF-8 BOM by default (verified)
  catch { return decodeCp949(buf); }
}
```
Real Excel CP949 CSV decoded to `"날짜,지역,매출,비고\r\n2026-10-01,서울,1200.5,첫째 주\r\n…"` [VERIFIED: ran].

### Minimal xlsx reader essentials (full prototype ~70 lines, verified on a real Excel file)
```js
// sheets: xl/workbook.xml <sheet name r:id> + xl/_rels/workbook.xml.rels Target ; strings: xl/sharedStrings.xml <si> (drop <rPh>)
// cell: <c r="B2" t="s|inlineStr|str|b|e" s="styleIdx"><v>..</v></c>; column from the ref letters (sparse rows)
// dates: cellXfs[i].numFmtId in 14-22 or 45-47, or a custom numFmt whose code (minus quoted/bracketed parts) contains y/m/d/h/s
// serial -> ISO date: new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
```
Verified output for the real file: sheet `매출` rows `[["날짜","지역","매출","비고"],["2026-10-01","서울","1200.5","첫째 주"],["2026-10-02","부산","900"],["2026-10-03","서울","1500","a,b \"인용\""],["","","3600.5"]]` and sheet `Sheet2` `[["x"]]`.

### Test-side zip writer (round-trip verified)
```js
import { crc32, deflateRawSync } from 'node:zlib';   // crc32: Node >= 22.2
// local header: sig 0x04034b50, version 20, flags 0x0800 (UTF-8 names), method 8, crc, csize, usize, nameLen
// central header: sig 0x02014b50 ... offset at +42 ; EOCD: sig 0x06054b50, entry counts at +8/+10, cd size +12, cd offset +16
```
Used to build: nested `Export-…-Part-1.zip`, NFD Hangul names, a no-UTF-8-flag CP949 name entry, an oversized-claim entry (cap test).

### Pasted-text format (what the skill writes; also human-pasteable)
```
---
작성자: 김준수
날짜: 2026-10-13
과목: Pandas
제목: groupby로 월별 매출 집계하기
---
핵심 개념: ...
```
Entries are repeated blocks; a block without a front-matter header is treated as `# Title` + property lines (same parser as an exported page).

### Connector dump (written by the skill from Notion tool results; intake never parses connector syntax)
```json
{ "source": "connector", "pages": [ { "title": "…", "author": "김준수", "date": "2026-10-13", "subject": "Pandas", "markdown": "…body Markdown…" } ] }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Skills as `commands/*.md` | `.claude/skills/<name>/SKILL.md` with frontmatter, live reload, `${CLAUDE_SKILL_DIR}`, `when_to_use`, `allowed-tools` | current docs | Project skill needs no restart; listing truncates description at 1,536 chars [CITED: code.claude.com/docs/en/skills] |
| Notion export: one zip | Large exports can arrive as zips containing zips; shared `Export-<uuid>` root | observed by importer tools | Recursive in-memory reader [CITED: obsidian-importer] |
| Notion "Copy page contents" | Page menu "Copy page contents" copies the page as Markdown to the clipboard | undated blog | Paste fallback; whether properties/title are included is unknown [CITED: matthiasfrank.de; weak] |
| Notion API | Markdown endpoint (changelog 2026-02-26) | 2026 | Not usable (no API); noted only |
| Node < 22.2 | `zlib.crc32` built in | Node 22.2 | Enables a tiny test zip writer without deps [VERIFIED: ran] |

**Deprecated/outdated:** Python-based fixture tooling (no Python installed); extracting archives to disk; `TextDecoder('euc-kr')` as a CP949 decoder (never correct for UHC).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exported database-row `.md` = `# Title`, blank line?, `Key: value` property lines, blank, body; empty properties omitted | Pattern 3 | Parser misses properties → rely on CSV join; mitigated by tolerant parsing + a real-export fixture (O1) |
| A2 | Person property exports as the display name (not email) | Pattern 3 | Author fallback chain + `--alias` handles; more manual asks |
| A3 | Toggles export as `<details><summary>`; code fences carry language names | Pattern 3 | Tag stripping already generic; toggle content could be mis-sectioned |
| A4 | `_all.csv` = all rows/properties while plain `.csv` = current view | Pattern 3 | Both are read; pages are the primary source so no data loss |
| A5 | Template headings/levels are as described in PROJECT.md; exact markup unknown | Pattern 4 | Label-by-text detection tolerates markup drift; unknown labels fall to `other` |
| A6 | Connector `fetch` returns Markdown body + properties in some shape | Pattern 6 / dump | None for intake (dump schema is skill-normalized); the skill instructions may need adjusting after a real fetch |
| A7 | Export date strings follow the exporter's UI language | Pitfall 6 | Parser accepts all listed forms |
| A8 | Notion clipboard copy of page blocks yields Markdown with ``` fences | input-guide | Paste path may lose code fences → ask for "Copy page contents" or export |
| A9 | Default `to` = latest Friday on or before today is acceptable | Pattern 1 | 승환 sees and can override; wrong default costs one question |
| A10 | Claude Code subagents are available to the skill for the blind check | Pattern 9 | Fallback single-context pass is weaker |
| A11 | `allowed-tools` accepts bare `Read Write Edit` alongside scoped `Bash(...)` | Pattern 8 | Extra permission prompts; harmless |
| A12 | Time-estimate constants (60/75/100/130 s, 3 s/line) | Pattern 10 | Estimates off; validator only warns outside 10-20; calibrate after week 1 |
| A13 | Secrets/PII regex list is adequate | Security | Leak risk is mitigated by the human 'ask on hit' rule, not by the regexes alone |
| A14 | `concept.ref` names in the rubric list match real doc sections | Pitfall 15 | Wrong section name published; executor must spot-check |
| A15 | Skill routing vs `notion-api` | Pitfall 17 | User has to type `/weekly-quiz` |

## Open Questions (RESOLVED)

1. **O1 - Real export bytes are unverified.** RESOLVED (orchestrator): keep as a NON-BLOCKING Wave 0 `checkpoint:human-action` — build against the synthetic fixture + `notion-connector-samples.md`; when 승환 drops a real 견본 export zip into `work/inbox/`, derive sanitized shape notes from it.
   - What we know: official docs confirm formats, guest/full-access export, subpages, Windows path limit; third-party tools confirm 32-hex suffixes, `_all.csv` naming, nested zips, `Export-<uuid>` root, `<aside>` callouts, property lines near the top.
   - What's unclear: property-line grammar, Korean date strings, person rendering, template markup (A1-A5, A7).
   - Recommendation: add a Wave 0 `checkpoint:human-action`: 승환 exports his "(견본)" database (he owns it; Export → Markdown & CSV, Include subpages, Everything) and drops the zip under `work/inbox/`; the executor derives `tests/fixtures/notion-export-W42/` shape notes from it (sanitized). Until then build against the synthetic fixture and the tolerant parsers.
2. **O2 - Connector capture not done by this researcher.** RESOLVED: the orchestrator fetched the template page and the filled example and saved them verbatim as `notion-connector-samples.md` (incl. property rendering and a 견본-vs-team template difference table). No Notion tool was exposed to this session (only built-in file/web tools), so the "(견본)" pages, the "📋 작성 양식 (복사해서 쓰기)" template and "10/13 Pandas groupby (예시)" were not read. The orchestrator's main conversation should fetch those two pages plus one filled example and save the raw text (verbatim, including property syntax returned by the tool) next to this file as `notion-connector-samples.md`, so the template strings in `template.mjs` and the fixture can be made exact.
3. **O3 - What happens to the sample `2026-W42`?** RESOLVED (runtime decision, not a plan decision): the skill never overwrites an existing `quizzes/<id>.json` silently — it stops and asks 승환 (replace the invented sample / use another id / stop); intake never writes under `quizzes/`. First real run collides (Pitfall 1). Options: real set replaces the sample (Phase 3 also rewrites `index.json`); or the first real set uses `--week 2026-W43`... Recommend: skill asks; default "중단하고 승환에게 확인".
4. **O4 - Non-Friday default window (A9)** RESOLVED (orchestrator): default = window ending on the latest Friday on or before today (KST), shown in the intake report with a confirm step; `--week`/`--to` override. needs a one-line confirmation from the user.
5. **O5 - Team DB property names.** RESOLVED: tolerant alias list for the title column (복습 제목, 오늘의 학습 기록, 이름, Name, title) + H1 fallback; covered by fixtures for both template variants. CONTEXT says the real DB has 작성자/과목/날짜/오늘의 학습 기록 while the 견본 has 복습 제목/작성자/과목/날짜/이해도/같이 얘기해요; which is the title property in the team DB is unknown. Parser handles both via H1 and a title-column alias list.
6. **O6 - `members.json` aliases.** RESOLVED: deferred — all six real names are now in members.json (김준수, 이주현, 차승환, 송지희, 노아영, 정보경); `--alias` per run is enough for now. If a teammate's Notion display name differs from the Korean name, `--alias` per run works but is repetitive; consider an `aliases` field later (harmless to the validator [VERIFIED: memberNames reads only `name`, validate-core.mjs:34-37]).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all scripts/tests | ✓ | v25.7.0 (ICU 78.2) | — |
| `zlib.inflateRawSync` / `zlib.crc32` | zip reader / test zip writer | ✓ | built-in | — |
| `TextDecoder` utf-8 fatal, utf-16le, euc-kr | CSV/zip names | ✓ (euc-kr partial, see Pitfall 3) | built-in | in-repo UHC extension |
| git | repo | ✓ | — | — |
| Notion MCP / connector | fixture capture (O2) | ✗ in this researcher's session; ✓ in the main conversation per the brief | — | human export (O1) |
| Microsoft Excel (COM) | generating real `.xlsx` / CP949 `.csv` fixtures | ✓ (used this session, Office 16.0) | 16.0 | build `.xlsx` with the test zip writer |
| Python | — | ✗ (shims only) | — | not needed |
| `claude` CLI on PATH (Git Bash) | headless skill smoke run | ✗ (`command not found`) | — | manual dry run in the interactive session |
| LibreOffice | — | ✗ | — | not needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Notion connector in researcher session (O2), `claude` CLI headless run (manual checklist instead).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` built into Node v25.7.0 (engines >=22) [VERIFIED: package.json] |
| Config file | none - `package.json` script `"test": "node --test \"tests/**/*.test.mjs\""` [VERIFIED: package.json] |
| Quick run command | `node --test tests/<file>.test.mjs` (single file) |
| Full suite command | `node --test "tests/**/*.test.mjs"` (quoted glob) ; `npm run check` also runs `validate` and `lint:design` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | Skill file is well-formed and wired: frontmatter `name: weekly-quiz`, description ≤ 1,024 chars containing the three locked trigger phrases, body < 500 lines, every linked reference file exists, mentions the four input paths, forbids commit/push, calls intake → validator `--strict` → check-set in that order | unit (static lint) | `node --test tests/skill.test.mjs` | ❌ Wave 0 |
| GEN-01 | Intake accepts folder, `.zip`, nested zip, pasted front-matter text, connector JSON dump; practice files via `--files` | integration (CLI spawn) | `node --test tests/intake-inputs.test.mjs` | ❌ Wave 0 |
| GEN-01 | Real trigger by Korean phrase in Claude Code | manual-only (LLM routing) | dry-run checklist item D1 | n/a |
| GEN-02 | KST today, latest-Friday rule, window bounds, `2026-W53` boundary, weekend roll-forward, previous-set exclusion, near-miss warning, `--today/--week/--from/--to/--prev` | unit + CLI | `node --test tests/week.test.mjs tests/intake-window.test.mjs` | ❌ Wave 0 |
| GEN-03 | Table-driven strip rules; fence-first parse; no placeholder string anywhere in `records.json`/`materials.md`; `check-set` rejects a set containing boilerplate | unit + integration | `node --test tests/template.test.mjs tests/intake-clean.test.mjs tests/check-set.test.mjs` | ❌ Wave 0 |
| GEN-04 | 7+3, 4 choices, verbatim code = validator on a golden set and on mutations (one space, wrong count) | integration | `node --test tests/e2e.test.mjs` | ❌ Wave 0 (reuses existing `quizzes/2026-W42.json`) |
| GEN-04 | Questions really test concept + practical use / code questions are harder | manual-only (semantic) | review checklist R1-R6 in `rubric.md` + blind-solve output | n/a |
| GEN-05 | `distractorFrom` validity (existing choice ≠ answer, source exists, record has `hard/stuck`), minimum count rule | unit | `node --test tests/check-set.test.mjs` | ❌ Wave 0 |
| GEN-05 | Distractors are plausible misconceptions | manual-only | reviewer reads `plan.md` vs. materials | n/a |
| GEN-06 | Estimator table (sample computes 14 vs declared 15), band error outside 10-20, validator warn | unit | `node --test tests/check-set.test.mjs` | ❌ Wave 0 |
| GEN-07 | Validator exit-code contract on intake-derived records; code mismatch diagnostic; SKILL.md contains the bounded loop text | integration + static | `node --test tests/e2e.test.mjs tests/skill.test.mjs` | ❌ Wave 0 |
| GEN-07 | Skill actually retries and fixes | manual-only | dry-run item D4 (transcript shows fail → fix → pass) | n/a |
| GEN-08 | CP949 golden pairs (≥ 40 extension syllables) + real Excel CSV; BOM; UTF-16; `.xlsx` real file; `.ipynb` outputs dropped; `.py`; file name carried into `records[].files` and accepted by validator `file` | unit + integration | `node --test tests/cp949.test.mjs tests/csv.test.mjs tests/xlsx.test.mjs tests/practice.test.mjs` | ❌ Wave 0 |
| GEN-09 | Gate at 5/6 records and 2/3 authors, `lowCode` when < 3 blocks, report stems, `needs-decision` in records.json; SKILL.md has stop-and-ask before writing | integration + static | `node --test tests/intake-gate.test.mjs tests/skill.test.mjs` | ❌ Wave 0 |
| GEN-09 | Skill actually stops and asks | manual-only | dry-run item D3 on the sparse fixture | n/a |

### Sampling Rate
- **Per task commit:** `node --test tests/<changed-area>.test.mjs`
- **Per wave merge:** `node --test "tests/**/*.test.mjs"`
- **Phase gate:** `npm run check` green (tests + `validate` + `lint:design`) and the manual dry-run checklist signed off, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/helpers/zip-writer.mjs` - builds zips (nested, NFD names, no-UTF8-flag CP949 names, oversize claim)
- [ ] `tests/fixtures/notion-export-W42/` - synthetic export producing the 6 sample records plus: boilerplate-only page, empty 작성자 (author in title), out-of-window (before), weekend entry (after), a "(예시)" page, a "📋 작성 양식" page, a no-date parent page, an indented-fence-in-list page, a toggle/`<aside>` page, an image-only page; both `…<hex>.csv` and `…<hex>_all.csv`; flat and folder layouts; Korean-date and English-date variants
- [ ] `tests/fixtures/practice/` - `sales-cp949.csv` and `sales.xlsx` (real Excel output created this session; ~10 KB; regenerate with the PowerShell/COM recipe in Sources), `nb-sample.ipynb` (with outputs incl. a long base64), `hello.py`
- [ ] `tests/fixtures/sparse/` - 5 records / 2 authors export
- [ ] `tests/*.test.mjs` listed above and the cp949 golden table
- [ ] `.gitignore`: add `work/`
- [ ] `package.json` scripts: `"intake": "node scripts/intake.mjs"`, `"check-set": "node scripts/check-set.mjs"` (do not change `check`)
- [ ] Framework install: none

### E2E dry-run checklist (manual; what cannot be automated)
D1 In a fresh Claude Code session in the repo, say "이번 주 퀴즈 만들어 줘" → `weekly-quiz` loads (not `notion-api`). D2 Give the golden export zip; the intake report appears **before** any question text and shows window, counts, authors, code-block count. D3 Repeat with the sparse fixture → the assistant stops and offers 진행/범위 넓히기/중단. D4 Deliberately corrupt one code line in the draft → validator fails with `코드가 입력 기록 원문과 일치하지 않습니다`, assistant fixes and re-runs to 통과. D5 Blind subagent step happens and mismatches (if any) are acted on. D6 `git status` shows only `quizzes/<id>.json` (and no `index.json`, no commit). D7 Read all 10 questions once as 승환 would (quality judgement). D8 Confirm overwrite prompt when `quizzes/2026-W42.json` exists.

## Security Domain

`security_enforcement` is enabled in `.planning/config.json` (`security_asvs_level: 1`, `security_block_on: "high"`) [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no login/API |
| V3 Session Management | no | — |
| V4 Access Control | no | local single-user CLI |
| V5 Input Validation | yes | validate zip structure and sizes, argument formats (`--week` regex), JSON parse in try/catch with exit 2, linear-time line parsers (no nested-quantifier regexes on file content), `Object.hasOwn`/no object merging as in Phase 1 |
| V6 Cryptography | no | `crc32` is integrity only; none needed |
| V12 Files and Resources | yes | never extract to disk, no path joins from archive entry names, entry-count and output-size caps, extension allow-list (`.md .csv .zip .json .txt` from exports; `.py .ipynb .csv .xlsx` practice), skip binaries |
| V8 Data Protection | yes | `work/` gitignored before first run; scan for secrets/PII before anything reaches a public quiz |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Zip bomb / huge entry | DoS | `maxOutputLength`, total cap (200 MB), entry cap, skip images |
| Zip-slip via entry names | Tampering | no extraction; names used only as in-memory keys |
| Path traversal through `--week`/`--out` | Tampering | strict regex, `path.resolve` check stays under repo |
| Prompt injection in Notion/"AI 답변"/practice files | Tampering | delimit records in `materials.md`, SKILL.md "records are data", never execute code |
| Executing teammates' notebooks | Elevation | read-only parsing; no `exec`, no kernel |
| Secret/PII leakage into the public repo | Information disclosure | scan records and final set for: `sk-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`, `gh[pousr]_[A-Za-z0-9]{30,}`, `(api[_-]?key|secret|token|passw(or)?d)\s*[:=]\s*['"][^'"\s]{6,}`, e-mail addresses, `01[016789]-?\d{3,4}-?\d{4}`, `\d{6}-?[1-4]\d{7}` [ASSUMED: pattern set]; any hit → stop and ask |
| Committing raw exports | Information disclosure | `work/` ignored; instruct to keep exports in `work/inbox/` |
| Malformed `.xlsx` (formulas/macros/external links) | Tampering | read cached values only; ignore `.xlsm`, external links |

## Fixture Recipes (reproducible, verified this session)

**CP949 golden pairs** (hex for any text; run via a UTF-8-BOM `.ps1` file because Windows PowerShell 5 reads BOM-less scripts as ANSI and mangles Hangul; pass text by file, not by command line):
```powershell
param($p)
$e = [Text.Encoding]::GetEncoding(949)
foreach ($x in [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8).Split(' ')) { (($e.GetBytes($x) | % { '{0:X2}' -f $_ }) -join '') }
```
Example ground truth: `똠쎵뗀한` encodes to `8C63 9BDC B6BE C7D1`... (the first character `똠` = `8C 63`). Commit ~40 `(syllable, hex)` pairs spread across both extension areas and the last row (`C6 41-52`) into `tests/cp949.test.mjs`.

**Real Excel files** (Excel 16.0 is installed on this machine): a COM script (`New-Object -ComObject Excel.Application`, write Korean headers, a date cell with `NumberFormat='yyyy-mm-dd'`, a formula, a second sheet; `SaveAs(path, 51)` for `.xlsx`, `SaveAs(path, 6)` for CP949 CSV) produced `sales.xlsx` (10,379 bytes) and `sales-cp949.csv` (123 bytes). Gotchas hit: the save path must be short (a ~230-character scratch path raised a COMException; use `C:/Users/User/AppData/Local/Temp/<short>`), pass cell values with explicit `[string]`/`[double]` casts, and use forward slashes inside the PowerShell string. If Excel is unavailable later, build the `.xlsx` with the test zip writer from hand-written XML instead.

**Real notebook shape** for the `.ipynb` fixture: `nbformat 4`, `cells[]` with keys `cell_type, execution_count, metadata, outputs, source`; `source` is an array of lines each ending in `\n` [VERIFIED: ran against a local course notebook]; the fixture should add an `outputs` entry with a long `image/png` base64 to prove outputs are dropped.

## Suggested Plan Slicing (for the planner)

1. **Wave 0 - scaffolding and human checkpoint:** `.gitignore` `work/`, `package.json` scripts, `tests/helpers/zip-writer.mjs`, request the real 견본 export (O1) and connector samples (O2). Not blocking: later waves use the synthetic fixture.
2. **Plan A (TDD, pure libs):** `zip.mjs`, `cp949.mjs`, `csv.mjs`, `xlsx.mjs`, `dates.mjs`, `week.mjs` with their tests and the real Excel fixtures.
3. **Plan B (TDD, Notion reader + cleaning):** `template.mjs`, `notion.mjs`, synthetic export fixture (folder + zip variants), `records.mjs` (ids, gate, report, materials.md, secrets scan). Depends on A.
4. **Plan C:** `practice.mjs` + `scripts/intake.mjs` CLI + CLI tests (inputs, window, clean, gate) + E2E with the existing sample set. Depends on A, B.
5. **Plan D:** `quality-core.mjs` + `scripts/check-set.mjs` (lint, estimator, blind kit) + tests. Depends only on Phase 1 plus the records shape; can run in parallel with B/C.
6. **Plan E:** `.claude/skills/weekly-quiz/SKILL.md`, `reference/rubric.md`, `reference/input-guide.md`, `tests/skill.test.mjs`, README weekly-routine stub pointer (Phase 3 owns the full routine), dry-run checklist file for `/gsd-verify-work`. Depends on C, D.

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `.planning/phases/02-weekly-generator/02-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 2 block), `.planning/config.json`, `.claude/CLAUDE.md`, `scripts/lib/validate-core.mjs`, `scripts/validate-quiz.mjs`, `js/grade.js`, `js/site.js`, `js/quiz.js`, `js/result.js`, `js/home.js`, `quizzes/2026-W42.json`, `quizzes/index.json`, `members.json`, `tests/fixtures/records-2026-W42.json`, `tests/cli.test.mjs`, `package.json`, `.gitignore`, `README.md`, `.planning/phases/01-quiz-core/01-02-SUMMARY.md`, `.claude/skills/design-taste-frontend/scripts/lint.mjs`.
- Executed this session on Node v25.7.0 / Windows 11: zlib/crc32/TextDecoder probes, ISO-week vectors, CP949 ground-truth comparison via PowerShell `[Text.Encoding]::GetEncoding(949)` (all 11,172 syllables and 8,836 KS X 1001 cells), real Excel COM export of `sales.xlsx` and CP949 `sales.csv`, zip reader/writer round trip, xlsx reader run, real `.ipynb` structure inspection.
- https://code.claude.com/docs/en/skills - frontmatter fields, `.claude/skills/<name>/SKILL.md`, 500-line guidance, 1,536-char listing truncation, `${CLAUDE_SKILL_DIR}`, `$ARGUMENTS`, live reload (page read to character 100,000 of 109,478).
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices - name/description limits and rules, third-person descriptions, progressive disclosure one level deep, validate-fix-repeat loops, scripts "solve, don't punt".
- https://www.notion.com/help/export-your-content - formats, guests need Full access, owner can disable export, current-view/default-view only, include subpages, Windows 260-char path error.

### Secondary (MEDIUM confidence)
- https://github.com/bitbonsai/notion2obsidian (README, `src/lib/csv.js`, `frontmatter.js`, `callouts.js`) - 32-hex suffix, `(_all)?` CSV regex, nested zip note, `<aside>` callouts, property lines within first 30 lines.
- https://github.com/obsidianmd/obsidian-importer (`src/formats/notion.ts`, `parse-info.ts`) - `Export-<uuid>` root regex, root-level nested zips, filename truncation, trailing-id regex.
- https://developers.notion.com/guides/data-apis/working-with-markdown-content and /guides/mcp/mcp-supported-tools - Notion-flavored Markdown element forms (API, not file export); `notion-fetch` returns content as markdown, date/person property shapes not documented.
- https://matthiasfrank.de/en/notion-updates/copy-page-contents-as-markdown/ - "Copy page contents" menu item (undated blog).

### Tertiary (LOW confidence)
- Web searches that found no confirmation of: the literal property-line grammar of official `.md` export, Korean date strings in exports, person property rendering, `Part-N.zip` naming. These are the `[ASSUMED]` items A1-A7.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - built-ins verified by execution; no packages.
- Architecture: HIGH for Phase 1 contract reuse, week logic, zip/CP949/xlsx/ipynb/CSV handling (prototypes ran); MEDIUM for the Notion reader because real export bytes were not observed.
- Pitfalls: HIGH for runtime/CP949/validator-warning items (verified), MEDIUM for Notion-specific ones.
- Skill authoring: HIGH for frontmatter/structure (official docs); MEDIUM for trigger routing against `notion-api` and subagent availability.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 for Claude Code skill conventions (fast-moving); Notion export behavior should be re-checked against the first real export (O1).
