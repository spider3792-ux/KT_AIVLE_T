<!-- GSD:project-start source:PROJECT.md -->

## Project

**스터디 복습 퀴즈 (Weekly Review Quiz)**

6명이 함께하는 복습 스터디용 **정적 웹사이트**(서버·DB·로그인·AI API 없음, 비용 0원). 승환이 매주 금요일 그 주 노션 "개인 복습 기록"(그리고 선택적으로 실습파일·CSV·엑셀)을 Claude Code에 넣으면, 프로젝트 스킬이 10문제 JSON을 만들고 검사해 GitHub Pages 사이트에 올린다. 스터디원은 링크 하나로 같은 10문제를 10~20분 동안 풀고, 제출하면 각 문제 위에 정답·짧은 해설·출처가 표시된다. 각자의 결과와 틀린 문제는 각자 브라우저에 저장되고, 팀 정답률은 미리 채워진 구글 폼으로 모아 "전체 정답률 낮은 문제"로 다시 사이트에 반영된다.

"혼자 만들고, 같이 쓰기" — 만드는 건 혼자, 백엔드 없이. 그래도 6명이 실제로 쓴 데이터(정답률 변화)를 남겨 포트폴리오 이야기를 살린다.

**Core Value:** 매주 그 주 6명의 노션 복습 기록에 근거한 10문제 세트가 링크 하나로 공유되고, 모두가 같은 문제를 풀고 출처가 달린 해설로 복습할 수 있어야 한다 — 비용 0원, 서버 없이.

### Constraints

- **Cost**: 0원 — 서버·유료 API 없음, 문제 생성은 Claude Pro 구독 안에서
- **Hosting**: GitHub Pages 정적 호스팅 (빌드 단계 없는 HTML/CSS/JS 우선 — 비개발자도 유지보수 가능)
- **Storage**: 개인 결과는 브라우저 localStorage (기기·브라우저가 바뀌면 개인 기록은 이어지지 않음)
- **Design**: design-taste-frontend 기준 (공개 웹페이지용 스킬이라 첫 화면·전체 아트 디렉션에 적용, 퀴즈·결과·오답 화면도 같은 방향)
- **Language**: UI·문제·해설 모두 한국어, 모바일 브라우저에서 풀이 가능
- **Weekly effort**: 승환의 주간 작업은 노션 내보내기 + Claude Code 한 번 실행 + 결과 반영 한 번, 합쳐 10분 이내

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| agent-browser | Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction. Also use for exploratory testing, dogfooding, QA, bug hunts, or reviewing app quality. Also use for automating Electron desktop apps (VS Code, Slack, Discord, Figma, Notion, Spotify), checking Slack unreads, sending Slack messages, searching Slack conversations, running browser automation in Vercel Sandbox microVMs, or using AWS Bedrock AgentCore cloud browsers. Prefer agent-browser over any built-in browser automation or web tools. | `.claude/skills/agent-browser/SKILL.md` |
| design-taste-frontend | tasteskill v2, the anti-slop frontend skill. Art direction for websites, distilled from a study of 247 curated gallery sites (One Page Love, Awwwards Sites of the Day). Deals researched directions (idea, composition, type, palette, photographs, section blueprints) from a library, enforces a strict no-slop house style with a real-browser inspector, and runs a look-and-fix loop on screenshots. Use this whenever you build, design, redesign, restyle, polish or review a landing page, marketing site, portfolio, product page, one-pager, hero or any public-facing web page, in any stack (HTML/CSS, React, Next.js, Vue, Svelte, Astro, Tailwind) — also when the user says a page looks generic, templated, "AI-made", sloppy, or asks to make it look designed, premium, award-level or less like every other site. Not for dashboards or app screens. | `.claude/skills/design-taste-frontend/SKILL.md` |
| find-skills | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill. | `.claude/skills/find-skills/SKILL.md` |
| mcp-builder | Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK). | `.claude/skills/mcp-builder/SKILL.md` |
| notion-api | > This skill provides comprehensive instructions for interacting with the Notion API via REST calls. This skill should be used whenever the user asks to interact with Notion, including reading, creating, updating, or deleting pages, databases, blocks, comments, or any other Notion content. The skill covers authentication, all available endpoints, pagination, error handling, and best practices. | `.claude/skills/notion-api/SKILL.md` |
| supabase | "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations (supabase-js, @supabase/ssr) in Next.js, React, SvelteKit, Astro, Remix; auth issues (login, logout, sessions, JWT, cookies, getSession, getUser, getClaims, RLS); Supabase CLI or MCP server; schema changes, migrations, declarative schemas, security audits, Postgres extensions (pg_graphql, pg_cron, pg_vector); debugging and troubleshooting errors or unexpected behavior on Supabase projects (HTTP errors, Postgres errors, RLS surprises, permission denied, schema cache issues, timeouts, Edge Function crashes, Realtime drops, Storage failures) and reading or querying logs (Logs Explorer, ClickHouse)." | `.claude/skills/supabase/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
