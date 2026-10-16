# Project Research Summary

**Project:** 스터디 복습 퀴즈 (Weekly Review Quiz)
**Researched:** 2026-10-16
**Confidence:** MEDIUM-HIGH (platform and package facts HIGH; LLM quality, Notion data details, and two platform checks need spikes)

## Executive Summary

Small async quiz app for 6 members. Notion study logs feed Claude, which generates one shared 10-question set each Friday (7 concept + 3 code). Claude also grades free text. Wrong answers go to a notebook.

Stack: Next.js 16.4 on Vercel Hobby, Supabase (Postgres, Google Auth, private Storage) on the free plan, Notion SDK v5 (read-only), Anthropic SDK with Opus 5.5 for generation and Sonnet 5.5 for grading, Zod everywhere. Pipeline is staged and idempotent with a source snapshot before any LLM call.

Key decisions: one daily Vercel cron that runs a KST-aware reconcile step; answer secrecy enforced by RLS and submit-gated keys; LLM citations and author labels built from DB IDs, code copied verbatim; grades persisted once, score computed in code.

Main risks: answer or allowlist leaks (RLS and auth hook), wrong keys or fabricated citations (blind-solve, ID-based citations), silent Notion or cron failures (status model, dead-man alert, manual retry), unverified Notion details (Phase 2 spike).

## Key Findings

### Recommended Stack

- Next.js 16.4.2 + React 19.3 (App Router). Use `proxy.ts`, not `middleware.ts` (Next 16 rename; old file is never called → sessions silently stop refreshing).
- Vercel Hobby cron: once per day, fires anywhere in the UTC hour (+0..59 min). Functions max 300 s, 4.5 MB body. Rejected: Supabase pg_cron + Edge Functions (150 s wall / 2 s CPU), Vercel Pro (unneeded), GitHub Actions (fallback only).
- Supabase free plan (500 MB DB, 1 GB storage, 50 MB/file). Pauses after 7 days low activity; the daily cron is the keep-alive.
- @notionhq/client 5.27.0: `dataSources.query`, `pages.retrieveMarkdown`, built-in 429 retry. Pin `Notion-Version`.
- @anthropic-ai/sdk 0.135.0: `messages.parse()` + `zodOutputFormat()`. `claude-opus-5-5` at effort high for generation (~$0.5/week); `claude-sonnet-5-5` at effort medium for grading (<$1/week). 5.5 models reject temperature/top_p/top_k/budget_tokens, forced tool_choice, and prefill. Check `stop_reason` for `refusal` and `max_tokens`.
- read-excel-file 9.3.12 (xlsx only), papaparse 5.7.0. Do NOT use npm `xlsx` 0.18.5 (frozen, known advisories).
- zod 4.6.7, tailwindcss 4.3.3, TypeScript ~5.9.3, Vitest 5.0.5, Playwright 1.64.1, supabase CLI >= 2.81.3 (db advisors), pgTAP for RLS tests.
- Node 24 LTS for dev and Vercel (local Node 25.7 is non-LTS; pin `engines`).

### Expected Features

**Must have (v1):**
- Allowlisted Google login with Notion name mapping
- Weekly status model (pending/generating/failed/ready) with visible failure and admin retry
- Week-window fetch by `날짜` with boilerplate stripping and sparse-week gate
- 10-question generation (7 concept: ~5 MCQ + 2 short; 3 code: 1 MCQ + 1 short + 1 essay), 10–20 min estimate
- Quiz UI with autosave, code display, confirm-and-lock submit
- MCQ auto-grade and AI grading to 정답/부분 정답/오답 with feedback, pending/error states
- Post-submit reveal with ≤5-line explanation, concept source, code-built "작성자 · 날짜"
- Per-question group accuracy with n, visible after own submit
- Notebook with tabs "내가 틀린 문제" and "스터디 전체 정답률 낮은 문제" (n ≥ 3); re-attempts stored separately from stats
- Question status active/voided with admin void and single regenerate before attempts
- Past-week archive

**Should have:** distractors from 어려웠던 내용/막힌 이유; blind-solve for MCQs (recommend v1); 문제 신고 (v1, cheap) and 채점 이의 override (v1.x); 오답 memo and 졸업 rule; weekly recap; degraded-week mode; stem dedupe and author balancing (v1.x).

**Defer:** file uploads as source (last phase; ingest accepts empty list from day one); gap-filling; Discord/Slack reminders; spaced repetition.

**Anti-features:** live/timed play, leaderboards, on-demand extra sets, hard time limits, anti-cheat, Notion write-back, multiple sets per week, v1 notifications, collaborative question authoring, LLM-generated URLs. The LLM must never write author names or dates.

### Architecture Approach

Layers: user-scoped Supabase client for all normal reads (RLS applies); service-role client only in one server-only module used by pipeline, grading, and `submitAttempt`.

Pipeline = `generation_runs` row with lease; stages INGEST → GENERATE → VALIDATE → PUBLISH, each its own HTTP invocation under 300 s, reading and writing Postgres only.

**Major components:**
1. Auth gate — before-user-created hook (verify on Free), `is_member()` in every policy, `getClaims()`, `proxy.ts`
2. Scheduler — one daily cron `GET /api/cron/reconcile` with `CRON_SECRET`: keep-alive, Notion preflight, stuck-grade sweep, generate if KST Friday-or-later and no published set
3. Orchestrator — leases, unique partial index for one active run per week
4. Notion connector — data source query, block recursion, 3 rps limiter, 429/Retry-After, normalize to `source_entries` snapshot
5. Generator + validator — structured calls, Zod plus domain rules, one guided retry
6. Publisher — one RPC transaction, unique partial index one published set per week
7. Submit + grader — atomic `UPDATE attempts SET submitted_at ... WHERE submitted_at IS NULL`; MCQ on submit; short answers normalized match then batched LLM per-key-point booleans; score in code; grades persisted once
8. Read models — `question_stats` trigger; `security_invoker` views

**Data model:** members, weeks, generation_runs, private.source_entries (snapshot, not exposed), uploads, quiz_sets, questions (no keys), question_keys (readable only with submitted attempt), question_sources (labels built by code), attempts, answers, grades, question_stats.

**Answer hiding:** separate keys table with submit-gated SELECT policy; no user UPDATE on attempts; no keys in JSON, Realtime, or static pages; pgTAP matrix.

**Low group accuracy:** flagged when `graded_count >= 3 AND avg_score <= 0.5`, shown as "4명 중 1명 정답". Non-takers not counted as zeros.

### Critical Pitfalls

1. **Answer key readable pre-submit** — separate key table, submit-gated RLS, security_invoker views, RLS in the same migration, automated anon/unsubmitted test (P1, re-verify P5).
2. **Allowlist only in UI/middleware** (CVE-2025-29927) — before-user-created hook (verify Free; fallback fail-closed `is_member()` plus sign-out), `is_member()` in policies, `getClaims()` not `getSession()`, never `user_metadata`. Test with a non-allowlisted account first.
3. **Fabricated citations and wrong keys** — ID-tagged inputs; model returns `source_ids` and verbatim `evidence_quote`; code validates; labels from DB; shuffle options in code; blind-solve MCQs; 문제 신고 path.
4. **Notion incompleteness and API traps** — pagination, recursion with depth cap, plain_text joins, 작성자 fallback (people → created_by → "작성자 미상"), placeholder list in config ("리스트", "# 여기에 코드"), schema preflight by property ID, daily preflight with alert, owner-only integration setup; integration must be connected on the real DB page (404 `object_not_found` otherwise).
5. **Silent failures and double runs** — daily reconcile with catch-up, leases, unique indexes, `generation_runs` row on every run, visible status, dead-man alert, manual retry.

Also: KST week math in Asia/Seoul only; Korean CSV is often CP949/EUC-KR (strict UTF-8 then euc-kr, strip BOM); prompt injection via notes and student answers (delimit, no tools); grading never writes 0 on failure.

## Implications for Roadmap

### Phase 1: Foundation
**Rationale:** RLS and answer secrecy are expensive to retrofit.
**Delivers:** Next.js scaffold, Supabase schema, RLS on every table, `is_member`/`has_submitted`, security_invoker views, Google OAuth, `proxy.ts`, server-only modules, Korean shell (design-taste-frontend for landing; quiz/review follow the same direction), voided status, pgTAP suite.
**Gate:** non-member gets zero rows; unsubmitted user cannot read keys.

### Phase 2: Notion ingest and snapshot (spike first, no LLM)
**Rationale:** Riskiest unknown; produces the fixtures for prompt work.
**Delivers:** integration checklist (owner creates, connects DB page, read-user-info without email), data source ID discovery, pinned Notion-Version, `lib/week.ts` KST with clock-injected tests, block recursion, normalization, placeholder stripping, 작성자 fallback, substantive gate, `source_entries` snapshot, sync-and-report command.
**Spike must answer:** does retrieveMarkdown keep code blocks and language; do names resolve; real nesting depth and blank-author rate.

### Phase 3: Generation, validation, publish (offline, fixture-driven)
**Delivers:** prompts, flat structured schemas, Zod plus domain checks (7+3, 4 distinct choices, key in range, source IDs exist, verbatim code, explanation ≤5 lines, est. 600–1200 s, near-duplicate stems), one guided retry, stop_reason handling, blind-solve, distractor seeding, planner (≤2 per entry, round-robin authors), publish RPC, sparse-week tiers, eval harness over 3–4 real weeks.

### Phase 4: Orchestration and ops
**Delivers:** `generation_runs` state machine, stage chaining, one daily `vercel.json` cron, reconcile logic, manual retry action, home status banner, admin run log and per-entry usable report, dead-man alert, Anthropic spend cap, weekly backup export.

### Phase 5: Quiz taking, deterministic grading, reveal
**Rationale:** Needs only a published set — can run in parallel with 2–4 against a seeded set.
**Delivers:** quiz page, debounced autosave, confirm-submit with blank count, atomic `submitAttempt`, MCQ and normalized short-answer grading, result page with keys and sourced explanations, per-question group accuracy with n, archive, 문제 신고 capture.

### Phase 6: AI free-text grading (async, additive)
**Delivers:** rubric from generation time, batched Sonnet call per attempt, booleans with code-computed score (0/0.5/1), `after()` background grading, pending/error with retry, cache by question + normalized answer hash, delimiters and length caps, ~20-answer fixture suite including injection, 채점 이의.

### Phase 7: Review notebook and stats
**Delivers:** `question_stats` trigger, my_wrong and low_accuracy views (security_invoker), two tabs (n ≥ 3), re-attempts separate from stats, 졸업, memo, recap.

### Phase 8 (optional, last): Uploads
**Delivers:** private bucket with member RLS, signed direct upload (not via Next route), parsers (papaparse with strict UTF-8 then euc-kr; read-excel-file xlsx only; ipynb with outputs dropped), profile summaries to LLM, UUID keys with NFC names, magic-byte checks, parse-warning path.

### Phase Ordering Rationale
Foundation first (RLS is expensive to retrofit); Notion before generation (riskiest, produces fixtures); generation before orchestration; quiz/grading parallel with 2–4; free-text grading after deterministic; stats after grading; uploads last.

### Research Flags
Needs deeper research: Phase 2 (Notion spike), Phase 3 (eval harness, schema limits, Zod 4 helper; fallback `jsonSchemaOutputFormat`), Phase 4 (Hobby cron behavior), Phase 1 (auth hook on Free).
Standard patterns: Phase 1 RLS matrix, Phase 5, Phase 7, Phase 8 (test CP949 and xlsx limits).

## Conflict Resolutions

1. **Cron design:** one daily reconcile cron at 09:00 UTC (18:00–18:59 KST); weekday logic in Asia/Seoul; gives free Fri/Sat/Sun catch-up.
2. **Week window:** Friday run cannot see Sat/Sun entries (spec says 월~일). Default: Mon through Friday-evening; UI states cutoff. User decision.
3. **Notion version:** data-source model with `Notion-Version: 2026-03-11` explicit; verify with one live request in Phase 2. Do not copy the installed notion-api skill's `/databases/{id}/query`.
4. **Code extraction:** block recursion for code blocks; retrieveMarkdown for prose only if lossless; both behind `getPageText()`.
5. **Blind-solve:** v1 for MCQs (recommended). User to confirm.
6. **Uploads:** last phase; empty list supported; cutoff is user decision.
7. **Sparse thresholds:** config; start ~6 entries + 3 authors; tune later.
8. **Partial credit:** 0/0.5/1; accuracy treatment is user decision (default 0.5).
9. **Determinism:** 5.5 rejects temperature → persist grades, cache, compute score in code.
10. **Notion capabilities:** add read-user-info without email; fallbacks in code.
11. **Spreadsheet parser:** read-excel-file (not exceljs, not xlsx).
12. **Essays:** one essay per set, rubric graded.
13. **Auth hook on Free:** Phase 1 checks; fallback is fail-closed `is_member()` plus post-login sign-out.

## Open User Decisions (default in parentheses)

1. Daily cron hour and Friday cutoff; UI wording (09:00 UTC = 18:00 KST).
2. Window: Mon to Friday evening (default), Sunday generation, or Saturday.
3. Automatic Sat/Sun catch-up after failed Friday run, labelled late (yes) or manual only.
4. Blind-solve for MCQs in v1 (yes).
5. Partial credit in accuracy: 0.5 (default) or wrong.
6. Individual score visibility: group accuracy + who submitted only (default) or each member's score.
7. Set close / late submissions: until next Friday (default), Sunday 23:59 KST, or indefinite.
8. Admin: one person (default, Notion owner) or all six.
9. 관련 개념 출처 format: named concept + doc section (default) or allowlisted doc-domain links.
10. Sparse-week thresholds: ~6 entries, 3 authors, reduce code questions if <3 usable blocks (default).
11. Uploads: v1 or later (default later, last phase); cutoff at Friday run moment (default).
12. 문제 신고 in v1 (default) and 채점 이의 override in v1.x (default), or both in v1.
13. Degraded-week mode: generate-or-fail in v1 (default) or degraded mode in v1.x.
14. Model cost: Opus 5.5 generation + Sonnet 5.5 grading (default), or Sonnet for both.
15. Notion owner completes integration setup, enables read-user-info without email, connects the 개인 복습 기록 DB page. Blocks first real generation.
16. Confirm the 6 Google emails and each member's Notion 작성자 name.
17. Confirm who owns the Vercel and Supabase accounts (Hobby is non-commercial; this qualifies).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry and official docs checked 2026-10-16 |
| Features | MEDIUM | Competitor and quality claims from preprints and training knowledge; time estimates LOW-MEDIUM |
| Architecture | HIGH platform / MEDIUM design | Stage timings are targets, not measured |
| Pitfalls | MEDIUM-HIGH | Platform limits verified; parsing edge cases partly from memory |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- Notion code-block fidelity (Phase 2 spike)
- Real Notion data quality: nesting, blank 작성자, placeholders, date-only values (sync-and-report before Phase 3)
- Auth hook on Free (Phase 1)
- Generation quality and MCQ validity (Phase 3 eval on real weeks)
- Time estimate accuracy (tune after 3–4 weeks)
- Korean short-answer grading accuracy (Phase 6 fixtures)
- Hobby cron window (show "generated at")
- Single-owner dependency on Notion integration (document succession)

## Sources

### Primary (HIGH confidence)
- npm registry (versions as of 2026-10-16)
- Vercel cron, functions, and Hobby plan docs
- Supabase free-plan pausing, Storage limits, Next.js SSR guide, before-user-created hook
- Notion versioning, upgrade guide 2025-09-03, request limits, retrieve page markdown
- Anthropic structured outputs and model constraints

### Secondary (MEDIUM confidence)
- Competitor knowledge (Quizlet, Anki, Kahoot, LLM quiz generators)
- arXiv distractor-generation and LLM-grading preprints
- SheetJS docs; installed skills (notion-api query examples outdated)

### Tertiary (LOW confidence)
- Time-budget estimates (to be tuned on recorded durations)

---
*Research completed: 2026-10-16*
*Ready for roadmap: yes*
