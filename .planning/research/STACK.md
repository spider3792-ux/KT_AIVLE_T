# Stack Research

**Domain:** Small-group (6 users) weekly review-quiz web app: Notion database -> LLM-generated quiz -> LLM-graded answers -> wrong-answer review
**Researched:** 2026-10-16
**Confidence:** HIGH on core stack and platform limits (verified against vendor docs and the npm registry on the research date); MEDIUM on three items flagged inline (Supabase auth hook on free plan, Notion markdown rendering of code blocks, `parse()` + streaming)

## Verdict on the candidate stack

**Validated, with three corrections.**

1. **The Friday job runs on Vercel Cron, not Supabase pg_cron/Edge Functions and not GitHub Actions** (reasoning below). But it must be built as two cheap, idempotent steps (daily Notion ingest, Friday generate), not one long job.
2. **Do not read Notion page content block-by-block.** Notion now has `GET /v1/pages/{id}/markdown` (SDK: `notion.pages.retrieveMarkdown`), which returns one page as a markdown string in a single call. At the 3 req/s limit this removes the only thing that could have made the job slow.
3. **File uploads must go browser -> Supabase Storage directly** (signed upload URL), never through a Next.js route. Vercel Functions reject request bodies above 4.5 MB (HTTP 413).

## Where the Friday job runs (the key decision)

| Option | Free-tier facts (verified) | Verdict |
|--------|---------------------------|---------|
| **Vercel Cron -> Next.js Route Handler** | Hobby: cron allowed, **once per day max, fires anywhere inside the scheduled hour (up to +59 min)**; function `maxDuration` is **300 s default and max on Hobby** (Fluid compute, on by default); 100 crons per project; time is UTC | **Use this.** One deployment, one set of secrets, 300 s fits a 1-3 min generation if Notion work is moved out of the Friday run |
| Supabase pg_cron + pg_net -> Edge Function | Edge Function free plan: **150 s wall clock**, 2 s CPU per request (I/O wait not counted), 256 MB; pg_cron jobs should run under 10 min | Reject. Tighter wall clock than Vercel (150 s vs 300 s), second runtime (Deno) and second deploy pipeline for the Notion/Anthropic code, and pg_net adds an HTTP hop whose timeout semantics I could not verify |
| GitHub Actions `schedule` | Min interval 5 min; **supports IANA `timezone:` (e.g. `Asia/Seoul`)**; runs can be delayed or dropped at high load; public-repo schedules auto-disable after 60 days of no repo activity; job timeout far above 5 min | Keep as the documented escape hatch, not the default. Its advantage is no timeout problem and exact timezone handling; its cost is a second place for secrets (service-role key, Notion token, Anthropic key) and the 60-day disable trap on a repo nobody commits to |
| Vercel Pro ($20/mo) | 800 s max duration, per-minute cron precision | Not needed. Do not pay for it |

**Why the timeout worry mostly disappears.** The risky part of the old plan was `~30 pages x (page + nested block children)` at 3 req/s. With `retrieveMarkdown` it is `~30 requests` (about 10 s). The Claude call for 10 questions is the only long step.

**Required job shape (this is a stack-level constraint for the roadmap):**

- `vercel.json` crons (UTC):
  - Daily ingest, e.g. `0 20 * * *`: query the Notion data source for pages whose `날짜` is in the current Mon-Sun week, compare `last_edited_time` with the cached row, call `retrieveMarkdown` only for changed pages, upsert into a `notion_pages` table. This is also the **Supabase keep-alive**: free projects can be paused after a 7-day low-activity window, and a daily DB write prevents that.
  - Friday generate, e.g. `0 9 * * 5` (09:00 UTC = 18:00 KST, fires between 18:00 and 18:59 KST on Hobby): run a delta ingest (cheap because of the cache), then ONE Claude call, then write the quiz. Decide the actual hour with the user; Hobby cannot guarantee the minute.
- Both routes: `export const maxDuration = 300;`, require `Authorization: Bearer ${CRON_SECRET}` (Vercel sends this automatically when `CRON_SECRET` is set), and are **idempotent keyed on the ISO week** (`quiz_sets.week_start` unique; status `pending | generating | ready | failed` plus `error`).
- A **manual retry** (server action, member-only) calls the same generate function. That satisfies the "failure is visible and retriable" requirement with no extra infrastructure.
- If a run ever exceeds 300 s: move the generate step to a GitHub Actions workflow (`workflow_dispatch` + `schedule` with `timezone: Asia/Seoul`) that calls the same code with the Supabase secret key. Do not pre-build this.
- Hobby is for non-commercial personal use (Vercel fair-use terms). A private study group fits. Only one person needs a Vercel account; the other 5 only need Google login to the app.

## Recommended Stack

### Core Technologies

| Technology | Version (verified on npm 2026-10-16) | Purpose | Why Recommended |
|------------|--------------------------------------|---------|-----------------|
| Next.js (App Router) | **16.4.2** (`latest`) | Web UI, server actions, route handlers, cron endpoints | Current stable major; engines `node >=20.9`. Single deployable for UI + cron + API on Vercel. Note Next 16 renames `middleware.ts` to **`proxy.ts`** (Supabase's SSR guide says a `middleware.ts` is never called on Next 16+, so sessions silently stop refreshing) |
| React | **19.3.1** | UI | Next 16 peer (`^19`) |
| TypeScript | **5.9.3** (pin `^5.9`) | Types | `latest` is 7.0.2 and 6.0.3 also exists; I could not verify Next 16.4 + TS 7 compatibility, so stay on the 5.9 line that Next 16 was built against. Revisit later (MEDIUM) |
| Node.js | **24 LTS** (set `engines`, `.nvmrc`, Vercel project setting) | Runtime | The dev machine has Node 25.7 (odd/non-LTS release). Vercel runs `nodejs24.x`/`22.x`; develop on the version you deploy. Pin `@types/node@^24` to match |
| Supabase (Postgres + Auth + Storage) | hosted Free plan | DB, Google OAuth, file storage | Free plan limits (verified): **500 MB DB, 1 GB storage, 50 MB max file (global cap on Free), 50k MAU, 5 GB egress**, 2 free projects. 6 users and ~30 notes/week is orders of magnitude under every limit |
| @supabase/supabase-js | **2.118.0** | DB/Auth/Storage client | Current; required peer of `@supabase/ssr` |
| @supabase/ssr | **0.12.7** | Cookie-based auth in Next (server/browser clients, `proxy.ts`) | The official SSR package. Peer `@supabase/supabase-js ^2.114` |
| @notionhq/client | **5.27.0** | Read-only Notion access | Official SDK. v5 is the data-source-era SDK (`notion.dataSources.query`, `notion.pages.retrieveMarkdown`). Built-in retry on 429/503 honoring `Retry-After` (default `maxRetries: 2`, configurable via `retry`). Since v5.27 it **throws `BrowserTokenNotAllowedError` if constructed in a browser with a token**, which is a free guard for the "token only on the server" requirement. Node >=18 |
| Notion API version | **`2026-03-11`** (set `notionVersion` explicitly; the SDK default is still `2025-09-03`) | Request header | Latest published version. Its breaking changes (`archived` -> `in_trash`, `after` -> `position`, `transcription` -> `meeting_notes`) don't affect a read-only reader. v5.12.0+ supports it. Pin it so Notion changes don't alter behavior silently |
| @anthropic-ai/sdk | **0.135.0** | Claude API (generation + grading) | Official SDK; peer `zod ^3.25 \|\| ^4`. Use `client.messages.parse()` with `zodOutputFormat()` from `@anthropic-ai/sdk/helpers/zod` for schema-validated output. `output_config.format` is the current parameter (`output_format` is deprecated; no beta header needed) |
| Zod | **4.6.7** | Schemas for quiz, grading result, form input, env | One schema source feeds Claude structured output, DB insert validation, and server-action validation. The SDK's helper converts unsupported constraints (min/max length etc.) into schema descriptions and still validates the response against the original schema |
| Tailwind CSS | **4.3.3** | Styling | Current; fits the design-taste-frontend art direction without a component framework lock-in |

### Claude model IDs (verified against the Anthropic model table, cached 2026-10-06)

| Job | Model ID | Price / MTok (in/out) | Why |
|-----|----------|----------------------|-----|
| **Quiz generation** (1x/week) | **`claude-opus-5-5`** | $4 / $20 | The product's core value is question quality grounded in six people's notes (Korean, with code analysis and distractors). It runs once a week: ~60K tokens in, ~10K out is roughly **$0.5/run**. Spend here |
| **Answer grading** (short-answer + essay) | **`claude-sonnet-5-5`** | $2 / $10 | Rubric-based grading with a stored answer key is a narrower task. Send **one call per submission** (all of a user's free-text answers together) = 6 calls/week, well under $1/week total |
| Optional cheaper grader | `claude-haiku-5-5` | $0.10 / $0.50 | Only if cost ever matters; evaluate against Sonnet on a handful of real Korean answers first. Not the default: a wrong auto-grade costs trust, which is the thing a 6-person study group notices |

**API constraints for these models (these will 400 if violated; verified in the Claude API reference):**

- **No `temperature` / `top_p` / `top_k`** (non-default values rejected) and **no `budget_tokens`**. Control depth with `output_config.effort` (`low|medium|high|xhigh|max`) and `thinking: {type: "adaptive"}`.
- **Opus 5.5:** thinking cannot be disabled; **default effort is `medium`**, so set it explicitly (`high` for generation).
- **Sonnet 5.5:** `thinking: {type:"disabled"}` is a 400; default effort `high`; use `medium` or `low` for grading.
- **No forced tool use** (`tool_choice` `any`/`tool` return 400). Use structured outputs (`output_config.format`) for JSON, not "force a tool call".
- **No assistant prefill.**
- Always check `stop_reason` before reading content: `refusal` and `max_tokens` can return output that does not match the schema. Handle both as a visible "generation failed, retry" state.
- Without sampling control, grading is not bit-for-bit deterministic. Design for it: grade against a stored `answer_key` + `rubric` generated with the question, constrain the result to an enum verdict (`correct | partial | incorrect`) + short feedback, and **persist the grade** (never re-grade on page view).
- Optional: include `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"` on the Opus/Sonnet 5.5 calls so a safety-classifier refusal reroutes automatically (Claude API only). Low priority for study notes.
- Use `messages.parse()` non-streaming with `max_tokens` around 16,000 (SDK guidance for non-streaming requests). Whether `parsed_output` is populated through `messages.stream()` was **not verified**; do a 10-minute spike before choosing streaming (MEDIUM).

### Database / Storage (all inside Supabase)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Postgres (Supabase) | managed | quiz sets, questions, attempts, answers, grades, cached Notion pages | Relational fits "per-question accuracy across 6 users" directly (a GROUP BY or a view) |
| Supabase Storage | managed | Uploaded `.csv/.xlsx/.py/.ipynb` | One private bucket, per-bucket size limit and MIME/extension allowlist, path `week/<iso-week>/<uuid>-<name>`. Free cap is 50 MB per file |
| Supabase Auth, Google provider | managed | Login | See the allowlist design below |
| Row Level Security | n/a | Authorization | Enable RLS on every table; policies `TO authenticated` with an `is_member()` predicate (see below). Views `WITH (security_invoker = true)` so the accuracy view respects RLS |

### Auth: Google login restricted to 6 emails (defense in depth, 3 layers)

1. **Table `allowed_emails`** (6 rows, lower-cased) is the single source of truth.
2. **Block at sign-up:** Supabase Auth "Before user created" Postgres hook that rejects any email not in `allowed_emails` (Supabase documents the hook with an email-domain example; adapt it to a per-email allow-list and return `http_code: 403`). **MEDIUM: the docs I could read did not state plan availability for this hook on Free.** Verify in the dashboard in the first auth task; if absent, layers 2 and 3 still enforce the rule.
3. **Block at data access (non-negotiable):** every RLS policy and every server action requires `is_member()` (an `EXISTS` on `allowed_emails` matched against the JWT email). A stranger who somehow gets a session sees nothing. Do not use `user_metadata` for this (user-editable); do not use `auth.role()` (deprecated).
4. Server code: protect pages with `supabase.auth.getClaims()` (verifies the JWT signature; the current recommendation). Never use `getSession()` for authorization.
5. Use the new key names: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe) and the **secret key** only in server env (cron routes needing to bypass RLS). Never prefix the secret key, Notion token, or Anthropic key with `NEXT_PUBLIC_`.
6. Requires a Google Cloud OAuth client (free). Only basic profile/email scopes are used, so no Google app verification is needed (MEDIUM; confirm during setup).

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| papaparse | **5.7.0** (+ `@types/papaparse` 5.5.x) | CSV parsing | Parse the uploaded CSV **on the server** from a decoded string; use `preview` and `header: true` to take only headers + first N rows + row count for the prompt. Tolerant of ragged/quoted CSV |
| read-excel-file | **9.3.12** | `.xlsx` parsing | Default export returns **all sheets** `[{sheet, data}]`; `readSheet(buffer)` for one. Node entry: `read-excel-file/node`. Small, maintained, `.xlsx` only, which is all this app needs. Send the LLM sheet names, header row, and ~20 sample rows, never the whole workbook |
| `TextDecoder` (built into Node) | n/a | CSV encoding detection | **Korean pitfall:** Excel on Windows exports "CSV" as CP949/EUC-KR, not UTF-8. Try `new TextDecoder("utf-8", {fatal: true})`, fall back to `"euc-kr"`. Also strip a UTF-8 BOM. No extra library needed |
| (none) | n/a | `.py` | Plain text; read as UTF-8, cap size, include in prompt |
| (none, `JSON.parse`) | n/a | `.ipynb` | A notebook is JSON. Extract `cells[].source` for code and markdown cells; **drop `outputs`** (base64 images/huge tables) before prompting |
| @supabase/ssr + `proxy.ts` | see above | Session refresh | Mandatory for cookie auth on Next 16 |
| react-markdown | **10.1.0** | Render explanations (<=5 lines) and question text containing markdown/code | Only if question text uses markdown. Do not enable raw HTML |
| shiki | **4.5.0** | Syntax highlighting for code-analysis questions | Server-side highlight in a Server Component; 3 code questions/week. Skip if plain `<pre>` is enough for v1 |
| p-limit | **7.3.3** | Cap Notion concurrency | Only if you parallelize `retrieveMarkdown`; keep concurrency at 2-3 to stay under the 3 req/s average (the SDK also retries 429s) |
| server-only | 0.0.1 | Import guard | Put `import "server-only"` in every module that touches the Notion/Anthropic/secret-key clients, so the bundler fails the build if one leaks into a client component |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Supabase CLI | install the latest; need **>= 2.81.3** for `supabase db advisors` | Migrations, local stack, RLS/security advisors | Use `supabase migration new`; run `supabase db advisors` before committing schema. Commit lockfile and pin packages (Supabase's own npm-security guidance) |
| Vitest | **5.0.5** | Unit tests | Test the pure parts: week-range computation (Mon-Sun in `Asia/Seoul`), Notion-markdown -> prompt-context assembly, CSV/xlsx/ipynb summarizers, Zod schemas, grading-result mapping |
| Playwright | **1.64.1** | Smoke test of login-gate and quiz flow | Optional; the `agent-browser` skill is also installed |
| eslint-config-next | 16.4.2 | Lint | Matches Next |

## Notion integration specifics

- Auth: **internal integration token**, created by the workspace owner (the owner is the only person who can), then the owner must **Connect** the integration to the "개인 복습 기록" database (guests cannot do this). Needs "Read content" capability only. Missing connection shows up as `object_not_found` (404), not 403, so the failure message should say "check that the integration is connected".
- Flow: `notion.databases.retrieve({database_id})` once to get `data_sources[0].id` (store it); then `notion.dataSources.query({data_source_id, filter: {property: "날짜", date: {on_or_after, before}}, page_size: 100})`. Use `iterateAllDataSourceRows`/`collectAllDataSourceRows` (added in v5.23) or manual `next_cursor` pagination. ~30 rows/week fits one page anyway.
- Properties come back as typed objects: `작성자` is `people` (array; **empty array when unfilled**, handle it explicitly, e.g. fall back to the page `created_by`), `날짜` is `date.start`, `과목` is `select`, `오늘의 학습 기록` is `rich_text` (array; join `plain_text`).
- Body: `notion.pages.retrieveMarkdown({page_id})` returns `{markdown, truncated, unknown_block_ids}`. Notion says code blocks and toggles are supported, but **the docs I read do not state how code blocks are rendered (fenced with language?)**. First ingest task must spike on one real template page and, if the markdown is lossy, fall back to `notion.blocks.children.list` (100 per page, recurse when `has_children`, join `rich_text.plain_text`, read `code.language` and `code.rich_text`). Keep the fallback behind the same `getPageText()` interface (MEDIUM).
- Rate limit: ~3 req/s average; keep ingest concurrency at 2-3 and rely on the SDK's 429 retry.
- The 2000-character rich-text limit applies to writes, not reads; irrelevant (read-only).

## Installation

```bash
# App scaffold (Node 24 LTS, TypeScript, App Router, Tailwind, ESLint)
npx create-next-app@16.4.2 study-quiz --ts --tailwind --eslint --app --src-dir --use-npm

# Core
npm install next@16.4.2 react@19.3.1 react-dom@19.3.1 \
  @supabase/supabase-js@2.118.0 @supabase/ssr@0.12.7 \
  @notionhq/client@5.27.0 @anthropic-ai/sdk@0.135.0 zod@4.6.7 server-only

# Supporting
npm install papaparse@5.7.0 read-excel-file@9.3.12 react-markdown@10.1.0 shiki@4.5.0
npm install p-limit@7.3.3   # only if parallelizing Notion fetches

# Dev
npm install -D typescript@~5.9.3 @types/node@^24 @types/papaparse vitest@5.0.5 @playwright/test@1.64.1
```

Pin exact versions and commit `package-lock.json`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vercel Cron + 2 idempotent steps | GitHub Actions `schedule` (+ `timezone: Asia/Seoul`) | If a single run proves to exceed 300 s, or if you need exact-minute Friday timing without paying for Pro |
| Vercel Cron | Supabase pg_cron -> Edge Function | If you drop Vercel entirely (e.g. host on Supabase + another static host). Not otherwise: 150 s wall clock, Deno runtime |
| Vercel Cron | Inngest 4.24.0 / Vercel Workflows | Durable multi-step functions without a 300 s cap. Real value, but adds a vendor and concepts for one weekly job. Revisit only if the job outgrows the two-step design |
| `claude-opus-5-5` generation + `claude-sonnet-5-5` grading | Single model (`claude-sonnet-5-5`) for both | If you want the simplest cost story; difference is cents/week, so quality wins |
| `read-excel-file` | `exceljs` 4.4.0 | Only if you need to read styles/formulas/write xlsx. Last published 2024-12; heavy dependency tree (archiver, unzipper, fast-csv) |
| `papaparse` | `csv-parse` 7.0.3 | Stream-processing huge CSVs in Node. Overkill for sampling headers + 20 rows |
| Supabase Auth Google | Auth.js (NextAuth) | If not using Supabase DB. Here Supabase Auth ties directly into RLS, which is the actual access control |
| Notion `retrieveMarkdown` | Recursive `blocks.children.list` | Fallback if markdown loses code blocks/language (see spike above) |
| Direct-to-Storage signed upload | Upload through a Next.js server action | Only for tiny files; breaks above Vercel's 4.5 MB body limit |
| `messages.parse` + Zod | Claude tool use / JSON-in-prompt parsing | Never for this app; forced tool_choice is rejected on 5.5 models and JSON-in-prompt is the fragile way |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `xlsx` from npm (0.18.5) | The npm registry copy is frozen at 0.18.5, which carries known advisories (prototype pollution, ReDoS) fixed in later releases that SheetJS only ships from its own CDN (`https://cdn.sheetjs.com/xlsx-0.20.3/...`). Parsing user-supplied workbooks with a stale parser is the exact risky use | `read-excel-file`. If you ever need SheetJS features, install the CDN tarball, not the npm name |
| `middleware.ts` on Next 16 | Renamed to `proxy.ts`; Supabase notes the old file is never called on 16+, so sessions stop refreshing and users are randomly logged out | `proxy.ts` per the Supabase SSR guide |
| `supabase.auth.getSession()` for authorization | Reads the cookie without verifying it | `supabase.auth.getClaims()` (or `getUser()` when you need a fresh server check) |
| `auth.role() = 'authenticated'` or `TO authenticated` alone in RLS | Deprecated / no row restriction (any signed-in Google user passes) | `TO authenticated USING (is_member())` plus ownership predicates `(select auth.uid()) = user_id` |
| `user_metadata` in authorization | User-editable | `allowed_emails` table / `app_metadata` |
| Uploading files through Next route handlers/server actions | Vercel rejects bodies > 4.5 MB (413) | Browser -> Supabase Storage signed upload URL (`createSignedUploadUrl`), then pass the path to the server |
| `NEXT_PUBLIC_` on any secret | Inlined into the browser bundle | Server-only env vars; `import "server-only"` |
| `temperature`, `budget_tokens`, prefill, forced `tool_choice` on Opus/Sonnet 5.5 | Rejected with 400 | `output_config.effort`, adaptive thinking, structured outputs |
| Date-suffixed model IDs (e.g. `claude-opus-5-5-2026xxxx`) | Not valid; IDs are complete as-is | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` |
| Supabase service/secret key in any client code | Bypasses RLS entirely | Secret key only in cron routes and server-only modules |
| One long cron doing Notion crawl + generation + save | Risks the 300 s Hobby cap and is not retry-safe | Daily ingest cache + Friday generate, both idempotent per ISO week |
| Hobby-cron assumptions of exact timing | Fires anywhere in the hour (+0..59 min) | Pick an hour that tolerates the window; show "generated at" in the UI |
| Relying on `typescript@latest` blindly | 7.0.2 is the latest tag; Next 16.4 support unverified | `~5.9.3` until verified |

## Stack Patterns by Variant

**If the first spike shows Notion markdown mangles code blocks:**
- Switch `getPageText()` to `blocks.children.list` recursion.
- Because generation quality for the 3 code-analysis questions depends on exact code and language tags; the extra ~5-10 calls/page are fine because ingest is a daily cached job, not part of the Friday run.

**If generation exceeds ~240 s in practice:**
- First lower `effort` to `medium` and shrink the context (truncate each page to its template sections: 핵심 개념, 내 말로 설명, 코드 blocks, 막힌 이유).
- Then move only the generate step to a GitHub Actions workflow (private repo; `timezone: Asia/Seoul`).

**If Friday timing must be exact (e.g. 18:00 sharp):**
- Use GitHub Actions `schedule` with `timezone: Asia/Seoul` to `curl` the Vercel route (still bounded by Vercel's 300 s), or run the code in the Action itself.

**If the "Before user created" hook is not available on the Free plan:**
- Let sign-up happen, but make `is_member()` fail closed everywhere and have the post-login callback sign out and show "not on the allowlist" for non-members.

## Free-tier limits that matter (6 users, 1 weekly job)

| Service | Limit | Our usage | Risk |
|---------|-------|-----------|------|
| Vercel Hobby | cron 1x/day, hour-window precision; function 300 s; body 4.5 MB; 1M invocations/mo; 4 CPU-hrs (I/O wait not counted); non-commercial only | ~35 invocations/mo cron + human traffic | Low. Watch: precision window; direct-to-storage uploads |
| Supabase Free | 500 MB DB, 1 GB storage, 50 MB/file, 5 GB egress, 50k MAU; **may pause after a 7-day low-activity period** | KBs of text/week + small files | Low; daily ingest write acts as keep-alive. Pausing is the main operational risk; add a dashboard alert note |
| Edge Functions (not used) | 150 s wall, 2 s CPU | 0 | Reason for rejection |
| Notion API | ~3 req/s average, 429 + Retry-After | ~30-60 requests/day | Low |
| Anthropic API | pay-per-token, no free tier | ~$0.5 generation + <$1 grading per week | Cost ceiling: set a monthly spend limit in the Anthropic console |
| GitHub Actions (fallback) | public-repo schedules disabled after 60 days idle; delays at top of hour | 0 unless used | Use a private repo and an off-peak minute if adopted |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.4.2 | react@19.x, node >=20.9 | Use Node 24 LTS for dev and Vercel |
| @supabase/ssr@0.12.7 | @supabase/supabase-js@^2.114 | Use 2.118.0 |
| @anthropic-ai/sdk@0.135.0 | zod ^3.25 or ^4 | Zod 4.6.7 is in range. `zodOutputFormat()` Zod-4 behavior is not documented on the page I read, but the SDK's peer range includes 4; smoke-test one schema first, fall back to `jsonSchemaOutputFormat()` if it misbehaves (MEDIUM) |
| @notionhq/client@5.27.0 | Notion-Version `2026-03-11` | Set `notionVersion` in the constructor; SDK default is `2025-09-03`; v5.12+ supports `2026-03-11` |
| read-excel-file@9.3.12 | Node >=18 | Import from `read-excel-file/node` on the server |

## Sources

- npm registry (`npm view`, 2026-10-16): next 16.4.2, react 19.3.1, @notionhq/client 5.27.0, @anthropic-ai/sdk 0.135.0, @supabase/supabase-js 2.118.0, @supabase/ssr 0.12.7, zod 4.6.7, xlsx 0.18.5 (stale), read-excel-file 9.3.12, papaparse 5.7.0, tailwindcss 4.3.3, vitest 5.0.5 — HIGH
- Vercel docs: Cron usage & pricing (Hobby once/day, +59 min precision), Functions limits and duration (300 s Hobby, 4.5 MB body), Hobby plan (non-commercial) — https://vercel.com/docs/cron-jobs/usage-and-pricing , https://vercel.com/docs/functions/limitations , https://vercel.com/docs/plans/hobby — HIGH (last updated Jul-Sep 2026)
- Supabase docs: Edge Function limits (150 s), billing/free plan limits, going-into-prod (7-day pause), Storage file limits (50 MB Free), Next.js SSR guide (proxy.ts, getClaims), cron guidance (10 min), before-user-created hook — https://supabase.com/docs/guides/functions/limits , https://supabase.com/docs/guides/auth/server-side/nextjs , https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook — HIGH (hook free-plan availability unverified)
- Notion docs: versioning (latest 2026-03-11), upgrade guides 2025-09-03 and 2026-03-11, retrieve page markdown — https://developers.notion.com/reference/versioning , https://developers.notion.com/reference/retrieve-page-markdown — HIGH; SDK source inspection of @notionhq/client 5.27.0 (default version 2025-09-03, `retrieveMarkdown`, retry defaults) — HIGH; release notes https://github.com/makenotion/notion-sdk-js/releases — HIGH
- Anthropic: claude-api reference (model IDs, prices, thinking/effort/sampling constraints, forced tool_choice removal), structured outputs doc (`output_config.format`, `zodOutputFormat`, schema limits) — https://platform.claude.com/docs/en/build-with-claude/structured-outputs — HIGH
- GitHub Actions schedule event docs (5-min minimum, `timezone`, 60-day public-repo disable) — https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows — HIGH
- SheetJS install docs (npm copy stale; CDN authoritative; Snyk advisory note) — https://docs.sheetjs.com/docs/getting-started/installation/nodejs — MEDIUM (SheetJS disputes some scanner claims, but the staleness is stated by the vendor)
- read-excel-file README (v9 API) — https://github.com/catamphetamine/read-excel-file — MEDIUM
- Local skills (`notion-api`, `supabase`): rate limits, RLS/security checklist, key handling — HIGH
- Claims marked MEDIUM above (Notion code-block rendering, auth hook on Free, `parse()` with streaming, Zod-4 helper behavior, TS 7 with Next 16, Google verification) need a short spike in the phase that first touches them.

---
*Stack research for: weekly Notion-sourced LLM quiz web app for a 6-person study group*
*Researched: 2026-10-16*
