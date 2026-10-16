# Feature Research

**Domain:** Small-group (6 people) weekly review quiz web app. Questions are LLM-generated from members' Notion study logs. Everyone takes the same 10-question set, then sees answers plus sourced explanations. Wrong answers go to a review notebook (오답노트). Korean UI, data-analysis study.
**Researched:** 2026-10-16
**Confidence:** MEDIUM

Confidence basis:
- Competitor feature sets (Quizlet, Anki, Kahoot, LLM quiz generators, 오답노트 practice) come from training knowledge. I did not re-fetch their pages, so treat those as MEDIUM.
- LLM question-quality and grading findings are backed by two web searches of academic preprints (see Sources), so MEDIUM. They are early-stage preprints, not settled practice.
- The fit to this project's constraints (6 users, free tier, weekly cadence) is my own analysis of PROJECT.md. It is reasoned, not externally verified.

## Framing: What This Product Is, Relative to Its Neighbors

| Product | What it is | Takeaway for us |
|---------|-----------|-----------------|
| Quizlet (Learn / Test / Magic Notes) | Self-study with a deck the user owns. Modes: flashcards, learn, test. AI generates from notes. | Table-stakes UX: per-question feedback, "missed" pool, retry only the missed ones. No group dimension. |
| Anki | Spaced repetition (SM-2 / FSRS) with self-rated recall (Again/Hard/Good/Easy), tags, leech detection. | Retry-until-mastered is the valuable idea. Full scheduling is overkill for 10 questions a week. |
| Kahoot (incl. study mode) | Live, synchronous, points and leaderboard, per-question countdown. | Almost all of it is anti-feature here. We are async and reflective, not a game show. The useful piece is the post-game per-question accuracy report. |
| LLM quiz generators (Quizgecko, Notion-style "make a quiz from this page") | One-shot generate from pasted text. Little verification, no sources, no group stats. | This is where we compete: grounded in a specific week's notes, sourced explanations, and a quality-control pipeline. |
| 오답노트 (the Korean practice) | Manually record the problem, your answer, the correct answer, why you got it wrong, and how to fix it. | The notebook should be low-effort and automatic, with an optional "why I got it wrong" memo. |

Net position: **a group-synchronized, async, grounded quiz with automatic wrong-answer collection**. No competitor combines "same set for everyone" with "questions come from our own notes", so the differentiation sits in grounding, trust, and group accuracy. Gamification is not where we compete.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes a 6-friend study tool feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google login restricted to a 6-email allowlist | Required by project. Per-person wrong-answer data is meaningless without identity. | LOW | Allowlist in config or table. Reject non-listed emails after OAuth. Map email to member (display name, matches Notion `작성자`). |
| Weekly quiz "home" showing state: not generated / generating / ready / failed / closed | The user must always know what state this week is in. The requirements say failure must be visible. | LOW | Explicit week status enum. The home page doubles as the retry entry point for admin. |
| Take quiz: one page or stepper, 10 questions, MCQ + short-answer + (some) essay inputs | Core loop. | MEDIUM | Mobile-responsive. Code snippets need syntax highlighting, monospace and horizontal scroll. A readable code block is table stakes for the 3 code-analysis questions. |
| Draft autosave and resume (per question, server-side or at least localStorage) | A 10-20 minute session on a phone will be interrupted, and a refresh loses everything otherwise. Quizlet/Anki never lose progress. | LOW-MEDIUM | Save on change, debounced. Resume restores answers. Server-side is better so the user can switch devices. |
| Single "제출" action with confirmation, including an unanswered count | Required by project ("한 번에 제출"). Warn about blanks before the point of no return. | LOW | After submit, lock answers. Idempotent (double-click safe). |
| Instant auto-grade for MCQ | Expected everywhere. | LOW | Deterministic comparison. |
| AI grading of short-answer and essay, with visible "grading…" state and failure fallback | Required by project. LLM calls take seconds and can fail. | MEDIUM-HIGH | Grade asynchronously after submit. Show per-question pending state. On LLM failure mark "채점 대기" and allow admin or auto retry. Never lose the submission. |
| Grade result in 3 levels (정답 / 부분 정답 / 오답) plus a one-line feedback, not a numeric score | The research shows LLM-grading agreement is strong for binary or coarse rubrics and degrades with finer granularity. Coarse levels are both more reliable and easier for users to trust. | MEDIUM | Grade against a stored reference answer plus 2-4 key points (rubric) generated with the question, not free-floating. Treat "부분 정답" as wrong for the accuracy stat, or as 0.5, and decide once. |
| Post-submit review: each question shows my answer, the correct answer, and the explanation | Core requirement. | LOW-MEDIUM | Reveal only after the user has submitted, never before, so the quiz can't be leaked within the group. |
| Explanation in fixed format: at most 5 lines, concept source, and Notion or file source ("이주현 · 10/14") | Core requirement, and a major trust feature. | MEDIUM | Enforce via structured output (schema: `explanation_lines: string[≤5]`, `concept_source`, `source_refs[]`). Build the "작성자 · 날짜" string in code from Notion page IDs, not from LLM text. See Dependencies and Pitfalls. |
| Handling of empty or unknown `작성자` in source attribution | PROJECT.md flags the template leaves `작성자` blank by default. | LOW | Fallback chain: `작성자` → Notion `created_by` → "작성자 미상". Surface a "작성자 칸을 채워주세요" warning to admin. |
| Wrong-answer notebook, tab 1: "내가 틀린 문제" across all weeks | Core requirement. Quizlet's "missed terms" and the 오답노트 tradition. | MEDIUM | Query: my first-attempt wrong or partial answers across weeks. Show question, my answer, correct answer, explanation. Filter by week and subject (`과목`). |
| Wrong-answer notebook, tab 2: "스터디 전체 정답률 낮은 문제" | Core requirement. | MEDIUM | Sort by group accuracy ascending. Needs a threshold plus a minimum-respondents rule (e.g. hide or mark "응답 부족" if fewer than 3 responded) so 1 of 2 correct doesn't read as "50%". Label with n. |
| Re-attempt from the notebook (retry a question, see result) | A notebook you can't practice from is just a list. Anki/Quizlet both loop on missed items. | MEDIUM | Retries are stored separately from the first attempt and must NOT alter group accuracy. MCQ re-grade is instant. Free-text re-grades cost an LLM call, so rate-limit and cache. |
| Group results: per-question accuracy and participation | Core requirement. | LOW-MEDIUM | Visible after the viewer has submitted. Show "n/6 제출". |
| Archive of past weeks (view past sets and my results) | The notebook is cross-week, so users need to navigate to the source quiz. | LOW | List by week. Read-only. |
| Admin: see generation status and failure reason, retry whole-week generation | Core requirement ("수동 재시도"). Generation will fail: Notion rate limits, LLM errors, sparse data. | MEDIUM | Admin page with last run log, error, and a "다시 생성" button. Idempotent per-week. Keep failed runs as records. |
| Admin: regenerate a single bad question | LLM output will occasionally be wrong. Whole-week regeneration is too blunt. | MEDIUM | Regenerate slot N with the same type and source subset. Needs the "void or replace" rule below. |
| Admin: void or exclude a question after people have answered | Once someone has answered, silently replacing the question corrupts stats. | MEDIUM | Question status `active` / `voided`. Voided questions are excluded from scores and accuracy and show a "무효 처리됨" note. This is the safe path after submissions exist. Replacement is only for before anyone answers. |
| Sparse-week handling: minimum-content threshold with a visible "not enough notes" outcome | Required by project ("기록이 부족하면 실패가 드러남"). | MEDIUM | See the Sparse-Weeks section below. Never fabricate 10 questions from 2 short entries. |
| Mobile-friendly layout, Korean UI and copy | Required by project. | LOW-MEDIUM | Quiz sessions happen on phones. |
| Question length and time budgeting (10-20 min) | Core requirement. | MEDIUM | See Time Budget below. Enforced in the generator and validator, not hoped for. |
| Generation-time quality gate (answer verification, grounding, dedupe) | For LLM-generated questions this is table stakes, not a differentiator. A wrong answer key in a study tool erodes trust fast. | HIGH | See Question Quality Controls below. |

### Differentiators (Competitive Advantage)

These align with the Core Value (grounded in what we actually learned, sourced, everyone on the same set).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Distractors built from real misunderstandings in `어려웠던 내용 / 막힌 이유` sections | Research suggests LLMs are weak at anticipating the misconceptions real students have. Your notes contain real ones, so distractors become genuinely tempting. Generic LLM quiz tools can't do this. | MEDIUM | A prompt-input choice: pass the "difficulty" sections as a distractor-source field. Record which note a distractor came from, for the explanation ("흔한 오해: 박서준 · 10/14"). |
| Every explanation is traceable to a specific teammate's note, with the attribution built from data, not generated | "이주현 · 10/14" turns a quiz into a conversation about each other's learning, and removes hallucinated attribution. | MEDIUM | `source_refs` are page IDs chosen at generation and validated to exist in the fetched set. Rendering looks up name and date. |
| Answer-verification pass (independent blind solve) before publishing | Catches the worst failure: a wrong key. Catches ambiguous stems too. | MEDIUM-HIGH | A second LLM call receives the stem and options without the key and answers. Mismatch means regenerate, and a second mismatch means flag for admin. Roughly 2x generation cost, which is trivial at 10 questions a week. |
| Pairwise distractor check | Drop distractors that also fit the stem (an "also-correct option" is a classic MCQ defect). The ISSR-style validator in the literature does this. | MEDIUM | Can be folded into the blind-solve pass: ask "is more than one option defensible?" |
| Time estimation validated at generation | Keeps the quiz inside 10-20 minutes, which is a stated product promise. | MEDIUM | Heuristic: per-type weights plus stem and code length. Reject sets outside the band. Display "예상 약 15분" on the quiz home. |
| Reader-reported "문제 신고" (flag a question) on the post-submit screen | Cheapest possible crowdsourced QA. Six people will spot a bad key quickly. Feeds the admin void-or-fix workflow. | LOW | A button plus optional reason, stored per user. Admin sees flagged questions with counts. |
| AI-grade appeal ("채점 이의") and admin override | Free-text AI grading will occasionally be wrong. Without an escape valve the group stops trusting scores. | MEDIUM | A user clicks "내 답이 맞다고 생각해요", admin sees the question, answer, and AI feedback, and one click overrides. Store the override with the original. |
| Personal "why I got it wrong" memo in the notebook | The 오답노트 tradition's real value is the reflection. Anki has no equivalent. | LOW | A textarea per wrong entry, private. |
| Notebook "졸업" (graduate) state: mark resolved after N consecutive correct re-attempts | Light version of spaced repetition: shrinks the notebook so it stays useful. | LOW-MEDIUM | Do N=2 consecutive correct retries. Leave full scheduling (SM-2/FSRS) out. |
| Weekly group recap: hardest questions, accuracy by `과목` and by question type (concept vs code), participation | Data already exists. Gives the study group a talking point for the weekly meeting. | LOW-MEDIUM | Pure aggregation. Do not add per-person rankings by default. |
| Uploaded files (CSV, Excel, practice files) feeding generation with file-name source | Required by project as optional. Enables questions over real data. | HIGH | Parsing and summarizing tabular data for an LLM prompt, size limits, and Storage are all real work. Treat as a later phase. Source label is the filename. |
| Avoid repeating recent concepts or stems | Weekly cadence means topics recur (pandas groupby every week). Duplicate questions bore users and inflate stats. | LOW-MEDIUM | Pass the last 2-3 weeks' stems or concept keys to the generator and reject near-duplicates. |
| Coverage balancing: questions should draw on multiple members' notes | With 6 authors, an all-one-author set feels unfair and defeats "복습 for everyone". | LOW-MEDIUM | Constraint in the generator and validator: no single author's entries as the source of more than ~4 of 10. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live/synchronous play, per-question countdown, points for speed (Kahoot-style) | "Make it fun." | Six friends reviewing asynchronously across time zones and schedules. Speed pressure undermines thoughtful code analysis and punishes slow readers. Real-time infrastructure is wasted. | Soft elapsed-time display only, with a recommended 10-20 minute range. No hard auto-submit. |
| Public leaderboard / ranking of the 6 members | "Friendly competition." | In a group of 6 friends, a ranking shames the lowest scorer and discourages honest attempts. It also pushes people to avoid hard weeks. | Show own score plus question-level group accuracy. If the group wants individual scores, make it an explicit opt-in decision later. |
| On-demand "generate a quiz now" button / personal question sets | "I want to practice more." | Explicitly out of scope: breaks the same-set premise that makes group accuracy meaningful. Also creates LLM cost spikes and abuse surface. | Practice through the wrong-answer notebook re-attempts. |
| Full spaced-repetition scheduler (SM-2/FSRS, due dates, daily review queues) | Anki is the gold standard for retention. | Pool size is about 10 questions a week, roughly 40 a month. Scheduling machinery, reminders, and a daily-use habit are heavy for a weekly product. | Notebook with re-attempt plus the "졸업" rule. Revisit only if the pool grows and users ask. |
| Hard time limit with auto-submit | "Keeps it fair." | A 10-20 minute guideline doesn't need enforcement among friends. It creates data-loss and unfair cutoffs. | Show elapsed time, record duration for tuning, and allow submit any time. |
| Strict anti-cheat (tab-switch detection, proctoring, randomized option order per user to catch sharing) | "People might look up answers." | It's a self-study tool among friends. It adds friction and hostility. Fixing option order per question keeps the group-discussion case workable. | None. Trust the group. |
| Write-back of results to Notion | "Keep everything in one place." | Out of scope per PROJECT.md. Needs write permissions, the owner-only integration complicates it, and it adds failure modes. | Read-only Notion source. Results live in the app. |
| Multiple quizzes per week / different cadences / per-subject quizzes | "More coverage." | Splits the sample, so group accuracy per question gets noisy with n=6. Raises generation and admin load. | One weekly set. Use `과목` filtering inside the notebook. |
| Auto-publishing with zero fallback when the generation is poor | "Fully hands-off." | Core Value says no human labor, but a wrong answer key discovered after six people answered is the worst outcome. | Automated pipeline plus validators plus visible admin controls (void, regenerate, retry). Hands-off in the normal case, correctable in the bad case. |
| Rich question types (drag and drop, matching, image-hotspot, runnable code sandboxes) | "Modern quiz platforms have them." | Large build cost, little pedagogical gain for concept recall plus read-the-code questions. Code execution adds a security and infra burden. | Static code blocks with MCQ, short-answer, or essay about the code. |
| Notification channels (email, KakaoTalk/Slack bots, push) in v1 | "Remind everyone on Friday." | Extra infrastructure and secrets, KakaoTalk has no easy free bot path, and it's six people who already chat. | Show "미제출" status on the home page. A shareable link is enough. Add a webhook (Discord/Slack) later if wanted. |
| Editing questions by every member / free-form collaborative question authoring | "Let us fix bad questions ourselves." | Permissions, versioning, and conflicts. It undermines identical-set consistency. | Members flag questions (문제 신고). Admin edits or voids. |
| LLM-generated reference URLs as the "concept source" | "Cite sources." | LLMs fabricate URLs. A dead or wrong link in a sourced explanation destroys the trust the feature exists to build. | Concept source as a named concept plus official-doc section title, or an allowlisted doc-site domain only. Notion and file sources are code-built from IDs. |

## Question Quality Controls (LLM-Generated Content)

This is where the product wins or loses. Layered controls, cheapest first. The weekly volume of 10 questions makes even a multi-call pipeline cost almost nothing.

| # | Control | Catches | Complexity |
|---|---------|---------|------------|
| 1 | **Structured output with schema validation** (type, stem, options, key, rubric, explanation lines ≤5, `source_refs[]`, difficulty, `category` = concept or code). | Malformed output, over-long explanations, missing sources. | LOW |
| 2 | **Grounding check in code**: every `source_refs` ID must exist in the week's fetched set; code-analysis questions must quote the code from the cited note, not invent it. | Hallucinated sources and invented code. | LOW-MEDIUM |
| 3 | **Composition check**: exactly 7 concept + 3 code; at least N MCQ; at most 1-2 essay; ≤ ~4 questions per single author. | Drifting from the spec. | LOW |
| 4 | **Blind-solve verification**: a second call answers without the key. Mismatch means regenerate once, then flag. Also asks whether more than one option is defensible. | Wrong key, ambiguous stem, multiple-correct. | MEDIUM-HIGH |
| 5 | **Distractor review**: reject distractors that are also correct, trivially absurd, or duplicates. Prefer distractors seeded from the notes' "막힌 이유". | Weak or "also correct" distractors. | MEDIUM |
| 6 | **Length and time estimate**: cap stem length and code snippet lines (~15-20), and compute estimated minutes. | A set that runs over 20 minutes. | MEDIUM |
| 7 | **Near-duplicate check** against the last few weeks' stems. | Repeating questions. | LOW-MEDIUM |
| 8 | **Strip template boilerplate** before prompting (unfilled "어떤 부분이 어려웠나…" placeholders, empty sections, empty code blocks). | Questions built from placeholder text. | LOW |
| 9 | **Post-publish human signals**: member flag (문제 신고), plus admin void and regenerate. | Whatever slipped through. | LOW-MEDIUM |

Honest limit: even a verified key can be subtly wrong in domain-specific code analysis. Controls 4 and 9 reduce but don't eliminate it. Also be aware of prompt injection: Notion text (including pasted "AI answers") and user free-text answers go into prompts, so delimit them and instruct the model to treat them as data.

Difficulty split (7 concept + 3 code) maps to the Notion template (per PROJECT.md): `핵심 개념 / 내 말로 설명` → concept; `직접 작성한 코드 / 최종 코드` → code analysis; `어려웠던 내용 / 막힌 이유` → distractors. Recommended formats inside that split:
- Concept (7): about 5 MCQ and 2 short-answer.
- Code (3): about 1 MCQ about the analysis stage or purpose with the code shown, 1 short-answer ("이 코드는 분석의 어떤 단계이고 왜?"), and 1 essay. The essay is where AI grading is least reliable, so keep it to one and grade it against a stated rubric.

## Time Budget (10-20 minutes)

| Question kind | Typical time | Count | Subtotal |
|---------------|--------------|-------|----------|
| Concept MCQ | ~0.75-1 min | 5 | ~4-5 min |
| Concept short-answer | ~1.5 min | 2 | ~3 min |
| Code MCQ | ~2-3 min | 1 | ~2.5 min |
| Code short-answer | ~3 min | 1 | ~3 min |
| Code essay | ~4-5 min | 1 | ~4.5 min |
| **Total** | | 10 | **~17-18 min** |

This sits at the high end of the target. To land nearer the middle (~15), make concept items mostly MCQ, keep code snippets short, and allow only one essay. Treat these numbers as my estimates (LOW-MEDIUM confidence) to tune using the recorded per-user durations after the first few weeks.

## Submit / Grading UX

- Question navigator showing answered/unanswered (a numbered strip), with a progress indicator. No countdown.
- Submit-confirm dialog showing the count of blanks.
- After submit: a "채점 중" state. MCQ results appear immediately, AI-graded items fill in as they complete, and any failure shows "채점 대기" with retry. The user never sees a hard error that loses their answers.
- Result screen order: overall result, then per-question cards (my answer, the correct answer, 정답/부분/오답 chip, ≤5-line explanation, concept source, Notion or file source, "문제 신고" and "채점 이의" actions).
- Answers only visible after the user's own submission. Group accuracy visible after submission too.
- Late submissions allowed (the week stays open for a defined period, e.g. until next generation). Group stats update as people finish, with n shown.

## Wrong-Answer Notebook UX

| Aspect | Recommendation |
|--------|----------------|
| Tabs | "내가 틀린 문제" and "스터디 전체 정답률 낮은 문제", as specified. |
| Tab 1 contents | My first-attempt wrong and partial questions, newest first. Chips for week and `과목`. A "미해결 / 졸업" toggle. |
| Tab 2 contents | Group-low-accuracy questions sorted by accuracy ascending. Rule: include if accuracy is below a threshold (e.g. under 50%) and respondents ≥ 3. Show accuracy and n. Mark "나도 틀림" or "나는 맞힘". Add a tab 2 entry only after the week has enough submissions. |
| Card | Question, my answer (tab 1), correct answer, explanation with sources, group accuracy, personal memo field. |
| Re-attempt | Answer in place and see instant correct/incorrect (MCQ) or AI feedback (free-text). Stored as a retry, excluded from group stats. Two consecutive correct retries means "졸업", which hides it from the default list but it stays findable. |
| Question statuses | Voided questions don't appear in either tab (or appear with a "무효" note). |
| Unattempted weeks | If a member hasn't submitted a week, don't show them group-low questions from it (spoiler protection). |

## Group Results Visibility

Recommended defaults:
- Visible to a member after they submit: per-question group accuracy, n submitted, and who has submitted (a nudge, not a score).
- Visible to a member: their own score.
- Hidden by default: other members' individual scores and answers. This is a decision for the user to confirm (see Open Decisions).
- Every figure labelled with n, since n ≤ 6 makes percentages noisy. Show "4/6명 정답" rather than "66.7%".

## Admin Needs

Admin is a single person (the builder or Notion workspace owner). Keep an admin area, not a CMS.

| Need | Detail | Complexity |
|------|--------|------------|
| Week status board | Status, run history, error message, timestamps, which Notion entries and files were used (with counts). | MEDIUM |
| Retry full generation | Idempotent per week. Keep the previous run for audit. Disable while a run is in progress. | MEDIUM |
| Regenerate one question | Same slot type. Allowed freely before any submission. After submissions exist, require the void path (below) or create a new version and explicitly mark prior answers for that slot as void. | MEDIUM |
| Void a question | Excludes it from scores and accuracy, shows a note. Safe at any time. | MEDIUM |
| Edit a question manually (fix a key or typo) | Small text edit before anyone answers, or void-and-note after. Rare but a cheap escape hatch. | LOW-MEDIUM |
| View flagged questions and grade appeals | Lists with counts and reasons. Override grade in one click. | MEDIUM |
| Manage allowlist | v1: config or DB row. A UI is optional. | LOW |
| Manage uploaded files | See uploads for the week, remove a bad one before generation. | LOW-MEDIUM |
| Force-generate despite sparse data | Admin override of the sparse threshold. | LOW |

## Sparse Notion Weeks

The failure mode is a week where fewer people wrote, entries were short, template placeholders were left unfilled, or there's no code at all (so 3 code questions can't be grounded).

Recommended tiered policy:
1. Compute "usable content" after stripping the template boilerplate: entry count, distinct authors, total characters of real text, and the count of non-empty code blocks.
2. **Sufficient** (e.g. at least ~8 entries, 3+ authors, and at least 3 code blocks): generate the full 7+3.
3. **Degraded** (some content but a missing piece): generate what is groundable. Examples: no code at all → fewer or zero code questions, and clearly say so; low content → reduced question count (e.g. 5-7) but keep the 7:3 ratio roughly. Tell the group the set is shorter this week. This is a v1.x feature.
4. **Insufficient** (almost nothing): don't generate. Show "이번 주는 기록이 부족해 출제하지 않았어요 (n건)" on the home page. Admin can force-generate. In v1, tiers 2 and 3 can collapse into one "generate, or fail visibly" rule with an admin force option.
5. Optional later: fill gaps from recent unused entries or from the group-low-accuracy pool, labelled "지난주 복습". This is a differentiator, not v1.

The `날짜`-based Mon-Sun window also has edge cases to surface: entries missing `날짜` (fall back to created time, flag it), entries dated into the future, and entries edited after the quiz is generated. Snapshot the source text used at generation, so explanation sources stay consistent if a Notion page is later edited or deleted.

## Feature Dependencies

```
Google login + allowlist
    └──requires──> Member identity ──enables──> Personal wrong-answer notebook
                                      └──enables──> "Who submitted" status

Notion fetch (Mon-Sun by 날짜)
    └──requires──> Notion integration set up by workspace owner (external prerequisite)
    └──requires──> Boilerplate stripping + sparse-week policy
            └──requires──> Structured question generation (schema, 7+3, sources)
                    ├──requires──> Question quality gate (grounding, blind-solve, time estimate)
                    ├──requires──> Weekly status model (pending/generating/failed/ready)
                    └──requires──> Source snapshot (page IDs + text + 작성자 + 날짜)
                            └──enables──> Sourced explanations ("작성자 · 날짜")

Take quiz (UI + autosave)
    └──requires──> Published question set
    └──requires──> Submit/lock
            ├──requires──> MCQ auto-grade
            └──requires──> AI grading (short/essay) + pending/failed states
                    └──requires──> Stored rubric/reference answer from generation
            └──enables──> Result/explanation reveal
                    └──enables──> Group accuracy view (after own submission)
                    └──enables──> Wrong-answer notebook (both tabs)
                            └──requires──> Minimum-respondents rule for group-low tab
                            └──enables──> Re-attempt (separate from stats)

Admin retry/regenerate/void
    └──requires──> Weekly status model
    └──requires──> Question status (active/voided) in the data model
    └──enhances──> Question flagging (문제 신고) and grade appeal

File upload (CSV/Excel)
    └──requires──> Storage + parsing/summarization step
    └──enhances──> Generation (extra source type "파일명")
    └──conflicts (timing)──> Friday generation: uploads must close before the run

Per-person ranking ──conflicts──> Honest-attempts culture (6 friends)
Replace-question-after-submissions ──conflicts──> Accuracy-stat integrity (use void instead)
```

### Dependency Notes

- **Sourced explanations require the source snapshot at generation time.** If the `작성자 · 날짜` label is built later from live Notion, edited or deleted pages break it. Store `{page_id, author, date, text_excerpt}` with the question set.
- **Question status (active/voided) must exist in the very first data model.** Retrofitting it after stats exist is painful. It's cheap now and blocks the "admin fixes bad question" requirement.
- **Stored reference answer and rubric are produced at generation, not at grading.** Grading a free-text answer against a rubric written at the same time as the question is more consistent than asking the grader to decide correctness fresh.
- **Re-attempt requires a first-attempt vs retry distinction in the answers table.** Without it, group accuracy would drift as people practice in the notebook.
- **The group-low tab requires a respondents threshold,** otherwise it's dominated by noise (with n=2 one wrong answer is 50%).
- **File upload must precede generation in the weekly timeline** and is the most expensive optional feature. It can ship after the Notion-only loop works end to end without breaking anything.
- **The Notion integration is an external prerequisite.** Only the workspace owner can create it and connect it to the DB, so this is a human task that blocks the first real generation.

## MVP Definition

### Launch With (v1)

Smallest loop that delivers the Core Value (Notion-only, no uploads):

- [ ] Google login with the 6-email allowlist and member-to-Notion-name mapping. Required for identity.
- [ ] Weekly Notion fetch (Mon-Sun by `날짜`), boilerplate stripping, and the minimum-content threshold with a visible "not enough notes" failure.
- [ ] 10-question generation (7 concept + 3 code; MCQ + short-answer, a single essay) with the structured schema, grounding check, composition check, blind-solve verification, and time estimate.
- [ ] Weekly status model with admin retry for the whole week, plus visible failure reasons.
- [ ] Take quiz with autosave, a readable code display, and a confirm-and-lock submit.
- [ ] MCQ auto-grade and AI grading of free-text (3-level result with a stored rubric), with pending and failed states.
- [ ] Result reveal with the ≤5-line explanation, concept source, and code-built "작성자 · 날짜" source.
- [ ] Per-question group accuracy (with n) visible after submission.
- [ ] Wrong-answer notebook with both tabs, and re-attempt stored separately.
- [ ] Question status (active/voided), plus admin "void" and single-question regenerate (before any submissions).
- [ ] Past-week archive.

### Add After Validation (v1.x)

- [ ] 문제 신고 (flag) and 채점 이의 (appeal) with admin override. Add once real use shows how often keys or grades are disputed. If the first weeks show errors, move this up to v1.
- [ ] Personal "why I got it wrong" memo and the "졸업" rule.
- [ ] Weekly recap (hardest questions, accuracy by `과목` and type).
- [ ] Degraded-week mode (fewer questions, no-code weeks).
- [ ] Recent-stem de-duplication and author-coverage balancing, if the first sets show repetition or skew.
- [ ] Distractors seeded explicitly from `막힌 이유` sections (could be in v1 prompting for free, but tracked as a quality lever).
- [ ] Manual question edit.

### Future Consideration (v2+)

- [ ] File upload (CSV/Excel/practice files) as a generation source. Highest build cost, and it is optional in the requirements.
- [ ] Gap-filling from older unused notes or the group-low pool.
- [ ] Discord or Slack webhook reminder.
- [ ] Optional individual-score visibility or streaks, if the group opts in.
- [ ] Lightweight spaced scheduling for the notebook, only if the pool grows large.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Allowlisted Google login | HIGH | LOW | P1 |
| Notion weekly fetch + sparse-week threshold | HIGH | MEDIUM | P1 |
| Structured generation (7+3, sources, rubric) | HIGH | HIGH | P1 |
| Blind-solve verification + grounding + time check | HIGH | MEDIUM-HIGH | P1 |
| Weekly status model + admin retry | HIGH | MEDIUM | P1 |
| Quiz UI with autosave and code display | HIGH | MEDIUM | P1 |
| Submit/lock + MCQ grade + AI grade (3-level) | HIGH | MEDIUM-HIGH | P1 |
| Sourced explanation (≤5 lines + concept + 작성자·날짜) | HIGH | MEDIUM | P1 |
| Group accuracy (with n) | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Wrong-answer notebook (2 tabs) + re-attempt | HIGH | MEDIUM | P1 |
| Question status (void) + admin single regenerate | HIGH | MEDIUM | P1 |
| Past-week archive | MEDIUM | LOW | P1 |
| 문제 신고 + 채점 이의 + override | MEDIUM-HIGH | MEDIUM | P2 (P1 if early weeks show bad keys) |
| Wrong-answer memo + 졸업 | MEDIUM | LOW-MEDIUM | P2 |
| Weekly recap | MEDIUM | LOW-MEDIUM | P2 |
| Degraded-week mode | MEDIUM | MEDIUM | P2 |
| Stem de-duplication + author balancing | MEDIUM | LOW-MEDIUM | P2 |
| File upload as source | MEDIUM | HIGH | P3 |
| Reminder webhook | LOW | LOW-MEDIUM | P3 |
| Spaced scheduler / leaderboard / live mode | LOW (or negative) | HIGH | Do not build |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Quizlet | Anki | Kahoot | Generic LLM quiz tools | Our Approach |
|---------|---------|------|--------|------------------------|--------------|
| Question source | User deck, or AI from notes | User cards | Host-authored | Pasted text | Auto from the group's own weekly Notion logs |
| Answer verification | None or implicit | N/A (human-authored) | N/A | Usually none | Blind-solve second pass plus member flag |
| Grading of free text | Limited exact-match | Self-rated | Mostly MCQ | Sometimes AI | AI against a stored rubric, 3-level, with appeal |
| Review of misses | "Missed" pool, Learn mode loops | Again/Hard queue, leech detection | Post-game report | Rare | Cross-week notebook with re-attempt and 졸업 |
| Group dimension | Class sharing | Shared decks, no shared stats | Live, ranking | None | Same set for all, per-question group accuracy, group-low tab |
| Sources on answers | None | Optional notes | None | Rare | Code-built "작성자 · 날짜" + concept source |
| Pacing | Self-paced | Daily scheduler | Timed, live | Self-paced | Async, one weekly set, soft 10-20 min |
| Gamification | Streaks, points | Minimal | Heavy | Minimal | Deliberately none |

## Open Decisions to Confirm with the User

1. Should members see each other's individual scores, or only per-question group accuracy plus who has submitted? (Default recommended: the latter.)
2. How should "부분 정답" count in accuracy: as wrong, or half? (Pick one and keep it for all weeks.)
3. How long does a week's quiz stay open for submissions (until Sunday, or until the next Friday)? This drives when group stats and the group-low tab become meaningful.
4. Who is the admin (one person or all six)? Affects the void, regenerate, and override controls.
5. Is "관련 개념 출처" a doc-section name, or must it be a link? If a link, restrict it to an allowlist of official documentation domains.
6. Sparse threshold values (entry count, authors, code blocks). Defaults here are guesses and should be tuned once real weekly data exists.

## Sources

- Quality of distractors: [Assessing Distractors in Multiple-Choice Tests (arXiv 2311.04554)](https://arxiv.org/pdf/2311.04554). Metrics for incorrectness, plausibility, and diversity. MEDIUM.
- Distractor generation with teacher evaluation: [Ghent/IDLab distractor generation study (arXiv 2307.16338)](https://arxiv.org/abs/2307.16338v1). About half of LLM distractors judged directly usable. MEDIUM.
- Self-review that drops distractors that also fit the stem: [ISSR, summary](https://www.themoonlight.io/en/review/issr-iterative-selection-with-self-review-for-vocabulary-test-distractor-generation). Secondary summary of a preprint, so MEDIUM-LOW.
- LLMs and real student misconceptions in distractors: [Can LLMs Model Incorrect Student Reasoning? (arXiv 2603.15547)](https://arxiv.org/pdf/2603.15547). MEDIUM.
- Rubric-based LLM grading reliability: [Rubric-Conditioned LLM Grading (arXiv 2601.08843)](https://arxiv.org/pdf/2601.08843). Binary rubrics align better than fine-grained, and deferring low-confidence cases helps. MEDIUM.
- LLM grading in content-dense domains: [arXiv 2505.04645](https://www.arxiv.org/pdf/2505.04645). Only the abstract was seen, so LOW as evidence.
- Competitor feature sets (Quizlet, Anki, Kahoot, 오답노트 practice): training knowledge, not re-verified this session. MEDIUM.
- Project constraints and Notion template mapping: `C:/Users/User/Desktop/Claude/.planning/PROJECT.md`. HIGH.

---
*Feature research for: 6-person weekly study review quiz (LLM-generated from Notion logs)*
*Researched: 2026-10-16*
