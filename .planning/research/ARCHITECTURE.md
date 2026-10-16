# Architecture Research

**Domain:** Small-group (6 users) weekly auto-generated review quiz — Notion ingest, LLM generation and grading, Postgres/RLS answer gating
**Researched:** 2026-10-16
**Confidence:** HIGH on platform limits (Vercel, Supabase, verified against official docs 2026-07/08); MEDIUM on Notion 2025-09-03 request details and Claude structured-output schema limits (verify at implementation time); design patterns are standard and opinionated.

---

## Verified platform facts that drive the architecture

| Fact | Source | Consequence |
|------|--------|-------------|
| Vercel Hobby cron: **once per day max**, precision "per-hour (±59 min)"; 100 crons/project; schedules are UTC | vercel.com/docs/cron-jobs/usage-and-pricing (updated 2026-07-15) | Cannot do "every 5 min retry" on Vercel. Friday trigger lands anywhere in the scheduled hour. Use ONE daily idempotent "reconcile" cron, not a Friday-only cron. |
| Vercel Hobby function max duration **300 s** (fluid compute default) | vercel.com/docs/functions/limitations | Whole pipeline will fit only if split into stages, each its own invocation. |
| Vercel Function request/response body **4.5 MB** max | same | Uploads (CSV/xlsx) must go browser -> Supabase Storage directly, never through a Next.js route. |
| Supabase Free pauses projects with low activity over 7 days; docs do not say what happens to scheduled jobs | supabase.com/docs/guides/platform/free-project-pausing | The daily reconcile cron doubles as a keep-alive DB touch. Do not depend on pg_cron as the only scheduler. |
| Supabase `before-user-created` Auth hook can reject sign-ups with `{"error":{"message","http_code"}}`; Postgres fn takes `event jsonb`, grant to `supabase_auth_admin` only | supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook | Allowlist can be enforced at sign-up time (plan availability not stated in the doc page - verify on Free). RLS stays the real boundary. |
| Notion API 2025-09-03: queries go to a **data source** (`dataSources.query` in SDK v5), `data_source_id` discovered via `GET /v1/databases/{id}` -> `data_sources[]` | developers.notion.com upgrade guide | The installed `notion-api` skill still shows the legacy `/databases/{id}/query` with the new version header - do not copy that. Store `NOTION_DATA_SOURCE_ID` as config. |
| Notion average rate limit 3 req/s, 429 + `Retry-After` | notion-api skill | ~30 entries x (1 page + N block-children calls incl. nesting) is ~60-200 calls = 20-70 s serial-ish. Fits one stage but needs a limiter + backoff. |
| Claude structured outputs: `output_config.format` with JSON schema; schema needs `additionalProperties:false`; numeric / string-length constraints unsupported | platform.claude.com/docs/en/build-with-claude/structured-outputs | Shape is guaranteed, **semantics are not** - a second app-level validation layer (Zod + domain rules) is mandatory. |

---

## Standard Architecture

### System Overview

```
 BROWSER (6 members, Google login)                     SCHEDULER / TRIGGERS
 ┌───────────────────────────────────────┐             ┌───────────────────────────────────┐
 │ Next.js UI (RSC + client islands)     │             │ Vercel Cron (daily, UTC)          │
 │ - this-week / quiz taking / results   │             │   -> GET /api/cron/reconcile      │
 │ - review tabs (mine / group-low)      │             │ Manual "retry" button (any member)│
 │ - upload page                         │             │   -> server action retryRun()     │
 └───────┬───────────────────┬───────────┘             └──────────────┬────────────────────┘
         │ user JWT          │ direct upload (signed by RLS)          │ CRON_SECRET bearer
         │ (anon key, RLS)   │                                        │
┌────────▼───────────────────▼──────────┐  ┌──────────────────────────▼────────────────────┐
│ APP LAYER (Next.js route handlers /   │  │ PIPELINE LAYER (server-only, service role)    │
│ server actions, USER-scoped client)   │  │ orchestrator: claim lease -> run stage -> chain│
│ - saveDraftAnswer (or direct RLS)     │  │ ┌────────┐  ┌──────────┐  ┌────────┐ ┌───────┐ │
│ - startAttempt                        │  │ │ INGEST │->│ GENERATE │->│VALIDATE│->│PUBLISH│ │
│ - submitAttempt  (the ONLY path that  │  │ │notion+ │  │claude x2 │  │zod+    │ │1 txn  │ │
│   sets submitted_at; service role)    │  │ │uploads │  │struct.out│  │domain  │ │RPC    │ │
│ - registerUpload                      │  │ └───┬────┘  └────┬─────┘  └────────┘ └───────┘ │
└────────┬──────────────────────────────┘  └─────┼────────────┼────────────────────────────┘
         │                                       │            │
         │        ┌───────────────────────┐      │            │
         │        │ GRADING (server-only) │      │            │
         ├───────►│ mcq det. -> short norm│      │            │
         │ after  │ -> LLM batch (1 call) │      │            │
         │ submit └──────────┬────────────┘      │            │
         │                   │                   │            │
┌────────▼───────────────────▼───────────────────▼────────────▼───────────────┐
│ SUPABASE                                                                      │
│  Auth (Google, allowlist hook) │ Postgres + RLS │ Storage (private bucket)    │
│  public: weeks, quiz_sets, questions, question_keys*, question_sources,       │
│          attempts, answers, grades, question_stats, uploads, generation_runs   │
│  private (not exposed): source_entries snapshot, members helper fns           │
│  * question_keys readable only after the reader submitted that set            │
└───────────────────────────────────────────────────────────────────────────────┘
         ▲                                       ▲                 ▲
         │ Notion API (read-only, 3 rps)         │ Anthropic API   │ Google OAuth
```

### Component Responsibilities

| # | Component | Responsibility | Talks to | Implementation |
|---|-----------|----------------|----------|----------------|
| 1 | **Web UI** | Render this-week status, take quiz, results, review tabs, upload | App layer (via RLS-scoped Supabase client), Storage (upload) | Next.js App Router, RSC for reads, small client islands for answer form + polling |
| 2 | **Auth gate** | Google login, reject non-members everywhere | Supabase Auth, `members` table | `@supabase/ssr` + `proxy.ts`/middleware calling `getClaims()`; `before-user-created` hook; `private.is_member()` in every RLS policy |
| 3 | **App layer** | User-initiated writes that need server authority (start/submit attempt, retry run, register upload) | Postgres (user client for reads/drafts, service client only inside `submitAttempt`), Grading | Server actions + route handlers |
| 4 | **Scheduler** | Wake the pipeline; keep Supabase warm | Pipeline orchestrator | One Vercel cron `GET /api/cron/reconcile` (daily) with `CRON_SECRET` |
| 5 | **Pipeline orchestrator** | Idempotent, resumable state machine per week: lease, stage transitions, retries, failure classification | Postgres (`generation_runs`), stages | `server/pipeline/orchestrator.ts`; each stage = separate HTTP invocation (self-chained) |
| 6 | **Notion connector** | Query data source by `날짜` range, fetch block trees recursively, normalize to `SourceEntry` | Notion API only | `@notionhq/client` v5 + p-limit(3) + 429/5xx backoff |
| 7 | **Upload parser** | CSV/xlsx/notebook/code -> bounded text *profile* (never raw dumps) | Storage (download), none external | papaparse / exceljs (see STACK) / ipynb JSON; token budget per file |
| 8 | **Generator** | Build prompts from snapshot, call Claude with JSON schema, return draft questions | Anthropic API | Two parallel calls (7 concept, 3 code) with flat schema |
| 9 | **Validator** | Deterministic checks + (optional) blind-solve check; feeds errors back for 1 retry | none / Anthropic (optional) | Zod + domain rules |
| 10 | **Publisher** | Atomically turn a validated draft into `quiz_sets/questions/question_keys/question_sources` | Postgres RPC | One SQL function = one transaction; unique partial index guarantees 1 published set/week |
| 11 | **Grader** | MCQ exact, short-answer normalized match, residual via one LLM batch call per attempt; persist once | Postgres (service role), Anthropic | `server/grading/*` |
| 12 | **Stats maintainer** | Keep `question_stats` read model current | Postgres trigger | Trigger on `grades` (runs under service role -> bypasses RLS) |
| 13 | **Postgres + RLS** | Source of truth; the *only* place answer-hiding is enforced | everything | Supabase |

### Trust boundaries (the rule that keeps this simple)

- **User-scoped Supabase client** (anon/publishable key + user JWT): everything the browser or a normal page render does. RLS enforces access. This is the default for every read.
- **Service-role client**: exists in exactly one module (`server/db/admin.ts`, `import "server-only"`), imported only by `server/pipeline/*`, `server/grading/*`, and the `submitAttempt` action. Never in a page/RSC data loader. Lint rule: no import of `admin.ts` under `app/(app)/**`.
- Notion token and Anthropic key: server env only, never `NEXT_PUBLIC_*`.

---

## Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/login/                 # Google sign-in, "not a member" page
│   ├── (app)/                        # authed layout: member check once
│   │   ├── page.tsx                  # this week: status banner | start | results
│   │   ├── quiz/[setId]/page.tsx     # take quiz (questions only, no keys)
│   │   ├── quiz/[setId]/result/page.tsx   # post-submit: keys, explanations, sources
│   │   ├── review/mine/page.tsx      # "내가 틀린 문제"
│   │   ├── review/group/page.tsx     # "스터디 전체 정답률 낮은 문제"
│   │   ├── upload/page.tsx
│   │   └── weeks/page.tsx            # archive + per-question group stats
│   └── api/
│       ├── cron/reconcile/route.ts   # CRON_SECRET-guarded; idempotent
│       ├── pipeline/[stage]/route.ts # internal self-chain, secret-guarded
│       └── grading/retry/route.ts    # re-run stuck/errored free-text grading
├── server/                           # everything here: import "server-only"
│   ├── db/{admin.ts,user.ts}
│   ├── pipeline/{orchestrator.ts,lease.ts,stages/{ingest,generate,publish}.ts,errors.ts}
│   ├── notion/{client.ts,query.ts,blocks.ts,normalize.ts}   # blocks -> sections/code_blocks
│   ├── uploads/{parseCsv.ts,parseXlsx.ts,parseNotebook.ts,profile.ts}
│   ├── llm/{anthropic.ts,schemas.ts,prompts/{concept.ts,code.ts,grade.ts}.ts,generate.ts,validate.ts,grade.ts}
│   └── grading/{submit.ts,mcq.ts,short.ts,freetext.ts}
├── lib/                              # pure, shared, unit-testable
│   ├── week.ts                       # KST week math (Mon-Sun), the ONLY place that does date math
│   ├── normalize.ts                  # NFC, trim, case/space/punct folding for short answers
│   └── schemas/                      # Zod: Question, QuestionKey, GradeVerdict
supabase/
├── migrations/                       # schema, RLS, triggers, RPCs
└── tests/                            # pgTAP: RLS matrix (member A cannot read B's answers/keys pre-submit)
```

### Structure Rationale

- **`server/` vs `lib/`:** anything with a secret or service role is physically fenced off; `lib/` stays pure so week math, normalization and schemas are unit-tested without network.
- **Pipeline stages as separate files + separate HTTP invocations:** each stage is idempotent and reads its input from Postgres, not from the previous stage's memory. That is what makes it resumable on a 300 s function limit.
- **`supabase/tests` (pgTAP) is not optional:** the answer-hiding guarantee lives in SQL; test it there.

---

## Architectural Patterns

### Pattern 1: Resumable stage pipeline with lease (long-running work on Hobby)

**What:** A `generation_runs` row is the job. The orchestrator `claim`s it with a compare-and-set lease, runs exactly one stage, writes the result to Postgres, sets the next status, then triggers the next stage as a *fresh* HTTP invocation (own 300 s budget) using `fetch(selfUrl, {headers:{Authorization:`Bearer ${INTERNAL_SECRET}`}})` inside `after()`/`waitUntil`. If the chain breaks (crash, timeout), the next daily reconcile or a manual retry resumes at the recorded stage.

**When to use:** Any job whose total time can exceed the plan's function limit or that has independent external calls (Notion, Claude).

**Trade-offs:** More moving parts than one big function, but each stage is ~20-120 s, restartable, and observable (status column). Not worth adopting Inngest/Trigger.dev/Vercel Workflow for 3 stages and 1 job/week; revisit only if stages stop fitting 300 s.

**Example:**
```sql
-- claim: atomic, safe against duplicate cron fires and concurrent manual retry
update generation_runs
   set status = 'ingesting', lease_expires_at = now() + interval '6 minutes', attempt = attempt + 1
 where id = $1
   and (status in ('queued','retry_wait') or lease_expires_at < now())
returning *;      -- 0 rows => someone else owns it; return 200 and exit
-- plus: unique partial index so a week can never have two active runs
create unique index one_active_run_per_week on generation_runs(week_id)
  where status not in ('published','failed','insufficient_data','cancelled');
```
Stage budget (design target, not measured): ingest 20-90 s, generate 40-120 s (two parallel Claude calls, streamed), validate <5 s (+30 s if blind-solve), publish <2 s. Put a hard `AbortSignal.timeout(240_000)` on every outbound call group so the lease is released with a recorded error rather than a platform 504.

### Pattern 2: Snapshot, then generate (decouple Notion from the LLM)

**What:** Ingest writes an immutable per-run snapshot (`source_entries`) of everything the model will see — Notion entries *and* parsed upload profiles — plus `generation_runs.input_manifest` (page ids, `last_edited_time`, content hashes, upload ids). Generation reads only the snapshot.

**When to use:** Always here. Gives: retry of generation without re-hitting Notion (rate limit, edits mid-run), reproducibility ("why this question?"), stable citations, and fixture capture for offline prompt iteration.

**Trade-offs:** ~30 small rows per week duplicated per run; negligible.

### Pattern 3: Answer-key separation enforced by RLS (not by the UI)

**What:** `questions` holds only what a taker may see (stem, choices, code snippet). Everything revealing lives in `question_keys` (correct choice, accepted answers, rubric, model answer, explanation, concept note) and `question_sources`. The SELECT policy on those tables requires that the reader has a *submitted* attempt for that quiz set. `attempts.submitted_at` is writable **only by the service role** (no UPDATE policy for users), so a client cannot self-unlock.

**When to use:** Any "reveal after commit" product. Hiding in the React tree, or `select` of fewer columns on a shared row, leaks via the Data API.

**Trade-offs:** One extra join/table; mandatory server action for submit (which you need anyway for grading).

### Pattern 4: Deterministic-first grading, LLM only for the residual

**What:** MCQ -> compare index. Short answer -> normalize (NFC, trim, lowercase, strip spaces/punctuation) and match against `accepted_answers[]`; a hit is final (no LLM). Misses and all essays -> one batched Claude call per attempt with rubric = `key_points[]`; LLM returns per-key-point booleans + 1-2 sentence Korean feedback; **code computes the score** from the booleans (e.g. >= 80% points = 1.0, >= 40% = 0.5, else 0). Persist once in `grades`; never re-grade on view.

**When to use:** Always. Cheaper, consistent, and explainable; keeps the LLM from inventing a numeric scale.

**Trade-offs:** Short-answer `accepted_answers` quality depends on the generator; mitigated by LLM fallback on misses (so false negatives are rescued, false positives only come from a too-loose accepted list).

### Pattern 5: Denormalized read model for group accuracy

**What:** `question_stats` (one row per question) maintained by a trigger on `grades`. Reads (low-accuracy tab, per-question stats) are indexed single-table selects with a simple member+submitted RLS policy. Avoids the "view bypasses RLS" trap (views run as owner by default) and avoids exposing other users' raw grades.

### Pattern 6: Cite by ID, label on the server

**What:** The model may only reference `source_id`s that exist in the snapshot. The human label ("이주현 · 10/14", or the upload filename) is built by code from `source_entries` at publish time and stored on `question_sources.label`. Validator rejects any question whose source ids are unknown or empty. Code-analysis questions additionally must quote a `code_snippet` that appears (whitespace-normalized) in a snapshot code block.

**Why:** Eliminates hallucinated attributions and hallucinated code, the two failures that destroy trust in this product.

---

## Data Flow

### A. Weekly pipeline (Friday trigger -> published set)

```
Vercel Cron (daily, UTC, ±59 min jitter)
  └─ GET /api/cron/reconcile  [Authorization: Bearer CRON_SECRET]
       1. nowKst = Asia/Seoul; target week = Mon-Sun containing nowKst.date   (lib/week.ts)
       2. touch DB (keep-alive) + sweep: grades stuck 'pending' > 10 min -> re-queue
       3. if weekday(nowKst) < Fri            -> exit 200 (no-op)
          if published set exists for week   -> exit 200
          ensure_week(week_start) (INSERT .. ON CONFLICT DO NOTHING)
          ensure run: insert generation_runs(status='queued') if no active/failed-resumable run
       4. fire stage chain: POST /api/pipeline/ingest {runId}   (don't await; use after())

INGEST (stage 1, own invocation)
  claim lease
  a. Notion: dataSources.query(filter: 날짜 on_or_after Monday AND on_or_before Sunday, by property id)
       paginate (has_more/next_cursor); keep last_edited_time
  b. per page: fetch block children recursively (has_children, depth<=4), paginate 100/page
       limiter 3 rps, retry 429(Retry-After)/5xx w/ jittered exponential backoff
  c. normalize: split by template headings (01 오늘 배운 내용 / 02 어려웠던 내용 / 03 해결 방법 / 04 한 줄 인사이트),
       sub-labels (핵심 개념 / 내 말로 설명 / 직접 작성한 코드 ...), code blocks as {language, code, section};
       drop empty template placeholders; author = people property name ->
       fallback created_by name -> "작성자 미기입"
  d. uploads: list uploads for week with created_at <= run.started_at (freeze list in input_manifest),
       download via service role, parse -> bounded profile text
  e. write source_entries (kind 'notion' | 'upload'), content_hash, is_substantive
  f. gate: count substantive entries; below MIN (config, default ~6 entries, >=1 code block for code questions)
       -> status 'insufficient_data' (public message) and STOP (visible on site, manual retry allowed)
  g. status 'ingested' -> chain GENERATE

GENERATE
  claim lease; load source_entries for run
  build prompt: sources as <source id="s_12" author="..." date="2026-10-14" subject="...">..</source>;
       + last 4 weeks' question stems (dedupe); token budget trim (code blocks prioritized)
  call A (7 concept: mcq + short), call B (3 code: mcq/essay) in parallel, streamed, flat JSON schema
  persist raw drafts to generation_runs.draft (jsonb) IMMEDIATELY (cost already spent)
  status 'generated' -> VALIDATE (same invocation if time remains, else chained)

VALIDATE
  Zod parse (discriminated union by type)  +  domain rules:
    counts 7 concept / 3 code; type allowed per kind; mcq: 4 distinct choices, key in range;
    short: >=1 accepted_answers; essay: 3-4 key_points; explanation <= 5 lines;
    every source_id exists; code_snippet found in snapshot; sum(est_seconds) in [600, 1200];
    no duplicate stems vs recent weeks (cheap similarity)
  fail -> one retry of ONLY the failing group with validator errors in the prompt (attempt<=2)
  still fail -> status 'failed', error_code LLM_INVALID_OUTPUT
  optional v1.x: blind-solve each MCQ with a cheap model; mismatch with key -> regenerate that question

PUBLISH
  RPC publish_quiz_set(run_id)  -- single SQL transaction:
     insert quiz_sets(status 'published') ; questions ; question_keys ; question_sources(label built from snapshot)
     update generation_runs set status='published'
  unique partial index (week_id) where status='published' makes a double publish a no-op
```

**Retries and idempotency summary**

| Failure | Handling |
|---------|----------|
| Cron fires twice / manual retry races cron | Lease CAS + `one_active_run_per_week` index; loser exits 200 |
| Function killed mid-stage | `lease_expires_at` passes; next reconcile/manual retry re-claims at same status; stages are overwrite-safe (ingest deletes+reinserts run snapshot in one txn; generate overwrites `draft`) |
| Notion 429/5xx | Honor `Retry-After`, jittered backoff, max ~5 tries per call; after that run -> `failed` code `NOTION_RATE_LIMIT`/`NOTION_UNAVAILABLE` |
| Notion 401/403/404 | No retry; `NOTION_AUTH` (integration not connected to the DB, token revoked) - actionable message |
| Property renamed/removed | Resolve properties by **id** at start of ingest; mismatch -> `NOTION_SCHEMA_MISMATCH` |
| Claude timeout/overload | SDK retries (maxRetries) inside stage; then `LLM_TIMEOUT`, manual retry |
| Invalid LLM output | One validator-guided retry, then `LLM_INVALID_OUTPUT` |
| Partial upload parse failure | Non-fatal: warning stored in run (`warnings[]`), visible in banner; set still publishes |
| Published set exists | All later triggers no-op. Published sets are immutable; "regenerate" only allowed when the set has **zero attempts** (supersede), otherwise create nothing |

**Which week and when:** Friday run sees Mon-Fri (Sat/Sun entries don't exist yet) - set the cron late enough on Friday that Friday's entries exist (UTC 09:00 = KST 18:00, jitter to 19:00; choose with the study group). The week is always computed in **Asia/Seoul**, never from the cron's UTC weekday (KST Friday 00:00-08:59 is still UTC Thursday). A manual retry on Sat/Sun re-snapshots and so picks up weekend entries.

### B. Taking and submitting

```
GET /quiz/[setId]            (user client)
  select quiz_sets, questions            -> allowed to any member when set published
  select question_keys                   -> RLS returns 0 rows (no submitted attempt) -- never even queried here
  select answers (own draft)             -> RLS own-only
startAttempt   -> insert attempts(user_id=auth.uid(), status 'in_progress', submitted_at NULL)   [check enforces NULL]
autosave       -> upsert answers(attempt_id, question_id, ...)   RLS: only while attempt.submitted_at is null
submitAttempt (server action, verifies session, then service role):
  1. UPDATE attempts SET submitted_at=now(), status='grading'
        WHERE id=$1 AND user_id=$uid AND submitted_at IS NULL RETURNING *    -- atomic; double-click loses
  2. same txn: grade MCQ deterministically -> grades(status='done')
     short answers: normalized match -> done; misses + essays -> grades(status='pending')
  3. return immediately -> UI redirects to /result (keys now visible via RLS since submitted_at set)
  4. after(): one Claude batch call for pending items -> UPDATE grades (status 'done'|'error'), attempt status 'graded'
  5. trigger refreshes question_stats per graded row
/result page: shows MCQ outcome + keys instantly; free-text rows show "AI 채점 중" and poll every ~3 s (router.refresh)
              until grades.status='done'. 'error' rows show "채점 지연 - 다시 시도" -> /api/grading/retry
```

### C. Review tabs

```
내가 틀린 문제:  view my_wrong_questions (security_invoker=true)
   grades(user_id = auth.uid(), status='done', score < 1) JOIN questions JOIN question_keys JOIN question_sources
   -> cross-week, ordered by week desc. RLS passes because the user has submitted each set. Partial credit (0.5) is listed with a "부분 정답" tag.
스터디 전체 정답률 낮은 문제:  view low_accuracy_questions (security_invoker=true) over question_stats
   WHERE graded_count >= 3 AND avg_score <= 0.5 AND status='active'   ORDER BY avg_score ASC, graded_count DESC
   RLS on question_stats: member AND reader has submitted that quiz set -> sets you haven't taken are invisible
```

---

## Data Model

All week math: `weeks.week_start` = Monday (KST) as `date`. Names below are logical; DDL is a sketch (add timestamps, FKs, `on delete` rules in the migration).

```sql
-- identity / allowlist -------------------------------------------------------
members(email text pk, display_name text not null, notion_user_id text null,   -- maps Notion 작성자 -> member
        is_admin bool default false)                                           -- optional

-- weeks and runs ---------------------------------------------------------------
weeks(id uuid pk, week_start date unique not null, week_end date not null)

generation_runs(id uuid pk, week_id fk, trigger text check in ('cron','manual'),
  status text check in ('queued','ingesting','ingested','generating','generated','validating',
                        'publishing','published','failed','insufficient_data','retry_wait','cancelled'),
  attempt int default 0, lease_expires_at timestamptz,
  input_manifest jsonb,                -- notion page ids + last_edited + hashes, upload ids
  draft jsonb,                         -- raw model output, kept for debugging/retry
  model text, prompt_version text, usage jsonb,      -- tokens in/out per call
  error_code text, public_message text,              -- member-visible, sanitized
  error_detail text,                                 -- service-role only (use a view or column grants to hide)
  warnings jsonb default '[]', started_at, finished_at, created_by uuid null)

-- snapshot (private schema, not exposed to the Data API) -------------------------------
private.source_entries(id uuid pk, run_id fk, kind text check in ('notion','upload'),
  notion_page_id text null, upload_id uuid null,
  entry_date date null, author_name text, subject text,
  sections jsonb,        -- {핵심 개념:[..], 내 말로 설명:[..], 어려웠던 내용:[..], 한 줄 인사이트:".."}
  code_blocks jsonb,     -- [{language, code, section}]
  text_content text,     -- flattened fallback when template parsing fails
  profile text null,     -- uploads: bounded text profile (cols/dtypes/head/stats; or code text)
  notion_last_edited timestamptz, content_hash text, token_estimate int, is_substantive bool,
  unique (run_id, notion_page_id), unique (run_id, upload_id))

-- uploads (live registry; raw files in Storage bucket 'uploads', path {week_start}/{uuid}-{name}) -----------
uploads(id uuid pk, week_id fk, uploader_id uuid, filename text, storage_path text, mime text,
        size_bytes int, status text check in ('uploaded','parsed','failed'), created_at)

-- quiz content ---------------------------------------------------------------------
quiz_sets(id uuid pk, week_id fk, run_id fk, status text check in ('published','superseded'),
          title text, question_count int, est_minutes int, published_at,
          -- unique partial index: one 'published' per week
          )
questions(id uuid pk, quiz_set_id fk, position int, kind text check in ('concept','code'),
          type text check in ('mcq','short','essay'), stem text, code_snippet text null,
          code_language text null, choices jsonb null,        -- mcq: ["..","..","..",".."]
          est_seconds int, status text default 'active' check in ('active','voided'),  -- void bad questions later
          unique (quiz_set_id, position))
question_keys(question_id uuid pk fk, quiz_set_id fk,          -- denormalized for the RLS predicate
          correct_choice int null, accepted_answers text[] null,
          key_points text[] null, model_answer text null,
          explanation text not null,                           -- <= 5 lines enforced by validator + check
          concept_note text null)                              -- LLM-supplied general concept pointer, NO URLs
question_sources(question_id fk, source_entry_id uuid null,    -- id only for provenance; no read access to the snapshot
          label text not null,                                 -- "이주현 · 10/14" or "sales_2026.xlsx"; built by code
          kind text, primary key (question_id, label))

-- taking and grading -----------------------------------------------------------------
attempts(id uuid pk, user_id uuid fk auth.users, quiz_set_id fk,
         status text check in ('in_progress','grading','graded','grading_failed'),
         started_at, submitted_at timestamptz null, score numeric null, max_score numeric null,
         unique (user_id, quiz_set_id))                        -- one attempt per member per set
answers(id uuid pk, attempt_id fk, question_id fk, selected_choice int null, answer_text text null,
        saved_at, unique (attempt_id, question_id))
grades(answer_id uuid pk fk, attempt_id fk, question_id fk, quiz_set_id fk, user_id uuid,   -- denormalized for RLS/aggregates
       status text check in ('pending','done','error'),
       method text check in ('mcq','normalized','llm'),
       score numeric check (score in (0, 0.5, 1)),
       feedback text null, key_points_hit jsonb null, grader_model text, raw jsonb null, graded_at)

-- read model ---------------------------------------------------------------------------
question_stats(question_id uuid pk, quiz_set_id fk, graded_count int, correct_count int,
               score_sum numeric, avg_score numeric, updated_at)   -- trigger on grades; + rebuild fn
-- (optional) set_results(quiz_set_id, user_id, display_name, score, submitted_at) for a per-member scoreboard

-- indexes worth having
-- grades(user_id, score) where status='done'            -- wrong-note tab
-- question_stats(avg_score) where graded_count >= 3      -- low-accuracy tab
-- attempts(quiz_set_id) where submitted_at is not null   -- RLS helper
-- generation_runs(week_id) unique where active           -- one active run
```

**Why `source_entries` is per-run and in `private`:** retries that re-ingest do not mutate what a published set cited; members never need to read raw notes through the API (labels are copied to `question_sources`). Exposed schemas need explicit `GRANT`s anyway (per the supabase skill: new tables may not be Data-API-exposed), so `private` + service role is the safest default for pipeline internals.

**`voided` status:** costs one column now, saves a painful migration the first time the model ships a wrong key. Voided questions are excluded from `question_stats` and from the low-accuracy tab.

### Low group accuracy, concretely

- Per question: `n = graded_count` (graded answers from **submitted** attempts; non-takers are not zeros, pending/error grades excluded), `avg_score = sum(score)/n` with score in {0, 0.5, 1}.
- **Flag as low when `n >= 3 AND avg_score <= 0.5`** (with 6 members: at most half the effective correct answers). Show `"4명 중 1명 정답"` rather than a percentage - at n=6 a percentage implies false precision.
- Sort ascending by `avg_score`, then descending `n`. Show `응시 n/6` on the set so a half-submitted week is understood.
- Thresholds live in one place (SQL view constants or a one-row `app_settings` table); tune after the first 3-4 weeks. Because the tab shows only questions from sets the viewer has submitted, early submitters can see stats grow as others finish - acceptable, and avoids pre-submit hints.
- Low accuracy can mean a *broken question*, not a hard one: when `avg_score` is very low and MCQ picks cluster on one non-key option, surface a "문제 오류 의심" hint and allow an admin to set `questions.status='voided'`.

---

## RLS Policy Design (6 allowlisted users)

Principle: **membership is checked on every table; ownership/state is layered on top.** Skill reminders applied: policies use `TO authenticated` + a predicate (never role alone), `(select auth.uid())` wrapping, UPDATE policies carry both `USING` and `WITH CHECK`, never use `user_metadata`, no `SECURITY DEFINER` in `public`.

```sql
create schema if not exists private;

-- membership by verified JWT email (top-level claim, not user_metadata)
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m
                  where lower(m.email) = lower((select auth.jwt() ->> 'email')))
$$;
revoke all on function private.is_member() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- "reader has submitted this set" (invoker: reads attempts under the caller's own RLS)
create or replace function private.has_submitted(p_set uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.attempts a
                  where a.quiz_set_id = p_set and a.user_id = (select auth.uid())
                    and a.submitted_at is not null)
$$;
```

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `members` | `is_member()` | service only | service only | service only |
| `weeks`, `quiz_sets`, `questions`, `generation_runs` (safe cols) | `is_member()` | service only | service only | service only |
| `question_keys` | `is_member() and private.has_submitted(quiz_set_id)` | service only | service only | service only |
| `question_sources` | same as keys (join through `questions.quiz_set_id`; or denormalize `quiz_set_id`) | service only | - | - |
| `attempts` | `user_id = (select auth.uid())` | `user_id = uid and submitted_at is null and status='in_progress' and is_member()` | **none for users** (submit/grade status via service role) | none |
| `answers` | own (via `attempts.user_id = uid`) | own, and attempt `submitted_at is null` | own, same condition, `USING` + `WITH CHECK` | none |
| `grades` | `user_id = (select auth.uid())` | service only | service only | none |
| `question_stats` | `is_member() and private.has_submitted(quiz_set_id)` | trigger/service only | trigger/service only | - |
| `uploads` | `is_member()` | `uploader_id = uid and is_member()` | none | own, and week's set not yet published |
| `storage.objects` (bucket `uploads`) | `is_member()` | `is_member()`, bucket-level size/mime limits | **avoid upsert** (skill: upsert needs INSERT+SELECT+UPDATE) - use uuid paths | own only |
| `private.source_entries` | not exposed | service only | service only | service only |

Defense in depth for the allowlist (three layers): (1) Auth `before-user-created` hook rejects non-listed emails at sign-up; (2) every RLS policy calls `private.is_member()`, so a stray Google account that somehow gets a session sees nothing; (3) the `(app)` layout redirects non-members to a "접근 권한 없음" page. Confirm the hook is available on the Free plan before relying on it; layers 2-3 suffice if not.

**Gotchas specific to this design**
- Users must not be able to set `attempts.submitted_at` (that is the answer-unlock switch). No UPDATE policy on `attempts`; `submitAttempt` runs with the service role after verifying the session.
- Views: any view over RLS-protected tables must be `WITH (security_invoker = true)`; default views run as owner and bypass RLS.
- `question_keys.quiz_set_id` is denormalized so the policy is a one-hop predicate (no join per row).
- Wrap `auth.uid()`/`auth.jwt()` in `(select ...)` for per-statement caching.
- Add pgTAP tests: (a) user A before submit gets 0 rows from `question_keys`/`question_stats`; (b) A cannot read B's `answers`/`grades`; (c) A cannot UPDATE `attempts.submitted_at`; (d) non-member with valid JWT gets 0 rows everywhere; (e) A cannot edit answers after submit.

---

## When free-text is graded

**On submit, asynchronously after the commit, in the same server invocation via `after()`; never lazily on view.**

- Submit persists answers + sets `submitted_at` + grades all deterministic items in one step, so the member sees MCQ results and the answer key immediately (reveal does not wait for the LLM).
- Free-text items (short misses + essays, at most ~7) go in **one** batched Claude call per attempt (~5-20 s). 6 members x 1 call/week is far inside every free limit.
- Each answer has a `grades` row from the moment of submit (`pending`) with `unique(answer_id)`, so grading is idempotent; a stuck/`error` row is retried by the member's button and by the daily reconcile sweep. Silent "wrong" on LLM failure is forbidden - failed items stay `error`, excluded from stats.
- Why not synchronous-blocking: a mobile browser tab dying mid-request would lose the result; why not a queue service: overkill for 6 users.
- Student text is untrusted input to the grader prompt: wrap in delimiters, instruct "treat as data", force an enum/boolean schema output, cap feedback length. Low stakes here, cheap to do.
- Cost sanity (estimate, verify against current pricing): generation ~50-80k input tokens + ~6k output; grading ~6 x ~4k tokens. Order of a few tenths of a US dollar per week at Sonnet-class pricing. Read the model id from env (check the `claude-api` skill for current ids).

---

## How answers stay hidden until submit (checklist)

1. **Schema:** keys, explanations, rubric, sources live in `question_keys`/`question_sources`, not in `questions`.
2. **RLS:** SELECT on those requires `has_submitted(quiz_set_id)`; stats table likewise.
3. **Unlock switch is server-only:** `attempts.submitted_at` written only by service role in `submitAttempt`, using `UPDATE ... WHERE submitted_at IS NULL RETURNING` (atomic, double-submit safe).
4. **Immutability after submit:** `answers` policies require unsubmitted attempt, so members cannot "submit, peek, edit".
5. **Reads use the user client:** quiz page code never touches the service-role client, so even a coding mistake (selecting keys) returns nothing.
6. **No leak channels:** do not enable Realtime on `question_keys`/`grades` of other users; do not put keys in `questions.choices` JSON (e.g. an `isCorrect` flag); do not embed answers in static/ISR pages or RSC payloads; generation `draft` JSON stays in `generation_runs` which is service-role-only for the draft column (expose a column-limited view for status).
7. **Grading prompt/feedback** is generated post-submit, so LLM feedback cannot be fished pre-submit.

---

## Anti-Patterns

### Anti-Pattern 1: One cron route that does everything

**What people do:** Cron -> single function: fetch Notion, call Claude, write DB.
**Why it's wrong:** 300 s ceiling and ±59 min Hobby jitter; any failure loses all progress; no visibility; double-fires double-spend.
**Do this instead:** Pattern 1 (staged, leased, snapshot-first) with a status row the UI shows.

### Anti-Pattern 2: Hiding answers in the UI

**What people do:** Store `correct_answer` on the question row, omit it in the component.
**Why it's wrong:** The Data API / RSC payload / Supabase client in devtools returns it.
**Do this instead:** Pattern 3.

### Anti-Pattern 3: LLM-authored citations or code

**What people do:** Let the model write "출처: 이주현 · 10/14" or paraphrase the code to ask about.
**Why it's wrong:** Wrong attribution or non-existent code is the fastest way to lose the group's trust.
**Do this instead:** Pattern 6; validator rejects unknown ids and non-verbatim snippets.

### Anti-Pattern 4: Grading on read / re-grading

**What people do:** Compute correctness when rendering review tabs; call the LLM each time.
**Why it's wrong:** Non-deterministic scores shift accuracy numbers, cost grows with views.
**Do this instead:** Persist `grades` once; review tabs are pure SELECTs.

### Anti-Pattern 5: Routing uploads through Next.js

**What people do:** `POST /api/upload` with the file.
**Why it's wrong:** 4.5 MB Vercel body limit; xlsx files exceed it.
**Do this instead:** Browser -> Storage under member-only RLS, then a small "register upload" write; parse server-side in INGEST from Storage.

### Anti-Pattern 6: Sending raw CSV/xlsx to the model

**What people do:** Dump full file contents into the prompt.
**Why it's wrong:** Token blowup, cost, and the model quizzes on row trivia rather than concepts.
**Do this instead:** Profile (sheet names, columns, inferred dtypes, ~20 head rows, simple stats), hard-capped per file and per run.

### Anti-Pattern 7: Cron-day weekday logic and UTC dates

**What people do:** `if (new Date().getUTCDay() === 5)`; week boundaries in UTC.
**Why it's wrong:** KST is UTC+9; entries written Monday morning KST belong to Sunday UTC.
**Do this instead:** All week math in `lib/week.ts` with `Asia/Seoul`; `날짜` property compared as date-only strings.

### Anti-Pattern 8: Service-role client in page data loaders / `NEXT_PUBLIC_` secrets

**Why it's wrong:** Bypasses RLS silently and can leak the key. **Instead:** fenced `server/db/admin.ts`.

### Anti-Pattern 9: Unconfirmed assumption that Supabase stays awake

**Why it's wrong:** Free projects pause after 7 days of low activity. **Instead:** daily reconcile cron touches the DB; keep the owner's warning email address monitored.

---

## Scaling Considerations

This is a fixed 6-user system; "scaling" means free-tier headroom, not user growth.

| Concern | Now (6 users, ~30 entries/week) | If it grew to ~50 users | Notes |
|---------|-----------------------------------|--------------------------|-------|
| Notion calls | 60-200 per run, ~1 run/week | Same (source side unchanged) | Only retries multiply it |
| Pipeline time | Fits 300 s with stages | Same | Re-check if a week exceeds ~60 entries or heavy files |
| LLM grading | 1 call/attempt | 1 call/attempt; add concurrency cap | Still trivial |
| `question_stats` trigger | Row-level recompute trivial | Fine to thousands of grades | Keep rebuild fn |
| Supabase free DB/Storage | KBs/week of text; uploads capped (e.g. 10 MB/file via bucket limit) | Watch 1 GB storage | Add retention for old uploads if needed |
| Vercel Hobby | Within limits | ToS: Hobby is non-commercial | Study group qualifies |

**First bottleneck:** Notion nested-block fan-out (one call per toggle/list with children). Mitigate with depth cap, concurrency 3, and skipping image/file/embed blocks. **Second:** Hobby cron jitter making "Friday evening" imprecise - pick a mid-evening KST slot and expose manual retry, or move the trigger to GitHub Actions/pg_cron if minute-level timing becomes important.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Notion | Internal integration created by the workspace **owner**, shared to the "개인 복습 기록" DB; SDK v5 `dataSources.query`; resolve properties by id | Enable the integration capability to read user info, or `작성자` people objects come back without names (then the author label falls back to `created_by`, which has the same limit). Document the owner-only setup step as a manual precondition. Screenshots/images of code are ignored (pitfall). |
| Anthropic | Server-only SDK; `output_config.format` JSON schema; stream long calls; `maxRetries` + own validation retry | Keep schema flat (nullable fields + `type` enum) rather than deep `oneOf`; check current schema-feature limits before adding constraints; model id from env |
| Supabase Auth | Google provider, `@supabase/ssr` cookies, `getClaims()` in proxy; Auth hook for allowlist | Never base authorization on `user_metadata` |
| Supabase Storage | Private bucket, member-only RLS, bucket `file_size_limit` + allowed mime types | Parse in INGEST with service role |
| Vercel Cron | `vercel.json` single daily entry; `CRON_SECRET` bearer is auto-sent | Production deployments only; handler must tolerate duplicate invocations |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI <-> App layer | Server actions / RLS-scoped client | No secrets; no service role |
| App layer <-> Grading | In-process call after atomic submit | Grading owns writes to `grades` |
| Cron <-> Orchestrator | HTTP GET with bearer secret | Returns fast; work happens in chained invocations |
| Orchestrator <-> Stages | HTTP POST with internal secret; state in Postgres only | Stages never pass data in memory |
| Generator <-> Notion | **None** - only via `source_entries` snapshot | Keeps LLM iteration offline-testable with fixtures |
| Publisher <-> content tables | One RPC transaction | Only writer of `quiz_sets/questions/question_keys/question_sources` |
| Grades -> `question_stats` | DB trigger | Read model; UI never aggregates raw grades |

---

## Suggested Build Order (dependencies)

```
[0 Foundation: schema + RLS + Google auth + allowlist + app shell + pgTAP RLS tests]
        │
        ├──► [1 Notion ingest -> source_entries snapshot (CLI/route, no LLM)]      ◄─ highest external risk, de-risk first
        │            │
        │            ▼
        │    [2 Generator + validator + publish RPC, iterated offline on captured snapshot fixtures]
        │            │
        │            ▼
        │    [3 Orchestrator: runs table, lease, stage chain, daily cron, status banner, manual retry]
        │
        └──► [4 Quiz taking + submit + MCQ/short deterministic grading + answer reveal]   (needs only a published set;
                     │                                                                     develop against a seeded fixture set,
                     ▼                                                                     parallel to 1-3)
             [5 LLM free-text grading (async, pending UI, retry)]
                     │
                     ▼
             [6 Stats trigger + "내가 틀린 문제" + "전체 정답률 낮은 문제" tabs]

[7 Uploads: Storage + RLS + parsers + feed into INGEST]   (depends on 1; pipeline must already tolerate zero uploads)
[8 Hardening: keep-alive/alerts, void question admin, blind-solve check, design polish]
```

**Ordering rationale**
- Phase 0 first because RLS/answer-gating is a schema decision that is expensive to retrofit; the pgTAP matrix proves the boundary before any UI exists.
- Notion ingest before generation: it is the riskiest unknown (owner-only integration, guest workspace, template parsing, missing `작성자`, 2025-09-03 data-source API). The snapshot it produces is also the fixture set that makes prompt iteration cheap and offline.
- Generation before orchestration: get a trustworthy 10-question set from a fixed snapshot manually first; then wrap it in leases/cron. Orchestration without a good generator is just a reliable way to produce bad quizzes.
- Quiz-taking/grading branch is independent of 1-3 (needs a published set only) and can proceed in parallel using a seeded set; it must follow Phase 0.
- Free-text grading after deterministic grading so the submit/reveal path is already correct and the async piece is purely additive.
- Stats/review tabs need real graded data, so they come after grading.
- Uploads last among features: optional by requirement, and the ingest interface should be designed from day one to accept an empty upload list, so adding them is additive.

**Research flags for roadmap**
- Phase 1 (Notion): needs hands-on discovery with the real workspace (sample page JSON, nesting depth, how often `작성자` is blank, user-info capability, data source id). Verify SDK v5 + request shapes against the live docs.
- Phase 2 (Generation): prompt/eval work is the real effort; needs a small eval harness (fixture snapshots -> validator pass rate, blind-solve agreement). Check structured-output schema limits at implementation time.
- Phase 3: verify Auth `before-user-created` availability on Free and that `vercel.json` cron + `CRON_SECRET` behave on the actual deployment.
- Phases 4-6: standard patterns, low research need; the RLS pgTAP tests are the main deliverable to review.

---

## Sources

- Vercel Cron usage and limits (Hobby: once/day, ±59 min, 100 crons): https://vercel.com/docs/cron-jobs/usage-and-pricing (HIGH, fetched 2026-10-16, page dated 2026-07-15)
- Vercel Functions limits (300 s Hobby max, 4.5 MB body): https://vercel.com/docs/functions/limitations (HIGH, page dated 2026-08-24)
- Vercel max duration configuration: https://vercel.com/docs/functions/configuring-functions/duration (HIGH)
- Supabase free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing.md (HIGH)
- Supabase before-user-created hook: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook.md (HIGH for behavior; plan availability UNVERIFIED)
- Notion 2025-09-03 upgrade guide (data sources): https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03.md (MEDIUM - guide lists the query as PATCH in prose and shows no body; use SDK v5 `dataSources.query`)
- Claude structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs (MEDIUM - schema-limit details not fully read)
- Project skills: `.claude/skills/supabase/SKILL.md` (RLS/security checklist applied above), `.claude/skills/notion-api/SKILL.md` (limits, pagination; its query examples use the pre-2025-09-03 endpoint)
- Pattern choices (staged resumable jobs, snapshot-then-generate, key separation, deterministic-first grading): design judgment, MEDIUM-HIGH; no single authoritative source

---
*Architecture research for: weekly Notion-sourced group review quiz*
*Researched: 2026-10-16*
