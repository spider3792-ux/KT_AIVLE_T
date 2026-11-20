---
quick_id: 261120-pbc
slug: review-note-button-and-page-with-pdf-doc
date: 2026-11-20
mode: quick (planned and executed inline by the orchestrator)
---

# 복습 노트: 채점 결과의 버튼, 노트 화면, PDF·DOCX 받기

## Goal
After a member submits a week, the score block shows a "복습 노트" link (top right, same size as "내 오답 노트 열기").
It opens review.html?set=<id>: the week's concept review note (same layout as the hand-made W47 docx), with
PDF and DOCX download buttons at the top. One source file per week, review/<id>.json, drives the page, the .docx
and the .pdf. The weekly-quiz skill writes it every week and publish ships it.

## Tasks
1. js/note-format.js: pure note helpers shared by browser and node (inline **bold**/`code` parser, note validator).
2. scripts/build-note.mjs (+ `npm run note -- <id>`): review/<id>.json -> review/<id>.docx (docx package, devDependency)
   -> review/<id>.pdf (Word export through PowerShell COM). node_modules ignored.
3. review.html + js/review.js + css in sheet.css: render the note on the paper, download row, shown only once the
   week has a stored first attempt in this browser (otherwise a "먼저 풀어 주세요" panel linking to the sheet).
4. js/quiz.js / js/result.js: score block gets a top row; the 복습 노트 link is added when review/<id>.json exists.
5. scripts/publish-week.mjs: when review/<id>.json exists, require valid note + docx + pdf and commit them with the set.
6. weekly-quiz SKILL.md (steps 9-11) + .claude/skills/weekly-quiz/review-note.md format guide; tests updated
   (static-safety covers review.html; note-format unit test).
7. First data: review/2026-W47.json from today's docx content; build, verify in browser, publish.

## Verify
npm test, npm run validate, design lint, browser check of the result link + review page (desktop + mobile width).
