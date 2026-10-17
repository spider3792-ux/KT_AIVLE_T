# 스터디 복습 퀴즈

6명이 함께하는 복습 스터디용 정적 웹사이트입니다. 서버, 데이터베이스, 로그인이 없고 비용은 0원입니다. 매주 그 주의 노션 "개인 복습 기록"을 바탕으로 만든 10문제 세트를 링크 하나로 같이 풀고, 제출하면 각 문제 위에 정답, 5줄 이내 해설, 출처(작성자와 날짜)가 바로 나옵니다. 내 결과는 내 브라우저(localStorage)에만 저장됩니다.

**사이트 주소:** https://spider3792-ux.github.io/KT_AIVLE_T/ (스터디원은 이 링크만 열면 됩니다)

## 매주 하는 일 (승환, 10분 이내)

1. **금요일, 노션 내보내기.** 노션 "개인 복습 기록" 데이터베이스 → 오른쪽 위 `⋯` → 내보내기 → 형식 `Markdown & CSV` → 내보낸 zip을 **압축 풀기**. (실습 파일·CSV가 있으면 같이 모아 둡니다. 엑셀은 "CSV UTF-8"로 저장해 주세요.)
2. **Claude Code에서 출제.** 이 폴더에서 Claude Code를 열고 `이번 주 퀴즈 만들어 줘`라고 말한 뒤, 풀어 둔 폴더 경로를 알려 줍니다. 출제 범위·기록 수·작성자를 보여 주는 **입고 보고**가 먼저 나오고, 확인하면 10문제를 만들어 검사기를 통과할 때까지 고칩니다.
3. **확인하고 올리기.** 10문제와 정답을 훑어본 뒤 "올려 줘"라고 답하면 `npm run publish -- <주차 id>`가 실행되어 사이트 목록에 이번 주가 추가되고 GitHub에 올라갑니다. 1~2분 뒤 사이트에 보입니다.
4. **링크 공유.** Claude가 만들어 준 한 줄 안내를 스터디 단톡방에 보냅니다.

직접 올릴 때는 `npm run publish -- 2026-W43`처럼 실행합니다 (세트 검사 → `quizzes/index.json` 맨 앞에 추가 → 두 파일만 커밋 → push). 이번 주 범위만 보고 싶으면 `npm run week`입니다.

## 샘플 데이터입니다

`quizzes/2026-W42.json`, `quizzes/index.json`, `tests/fixtures/` 안의 파일은 모두 **지어낸 샘플 데이터**입니다. 노션 "개인 복습 기록" 템플릿 모양으로 만들었을 뿐, 실제 스터디 기록이 아닙니다. 사이트 모양과 채점을 확인하는 용도이고, 진짜 세트는 이후 단계에서 노션 기록으로 만듭니다.

## 스터디원 이름

`members.json`에는 스터디원 6명의 이름이 있습니다: 김준수, 이주현, 차승환, 송지희, 노아영, 정보경.

문제 파일의 `sources[].author`는 `members.json`의 이름과 똑같아야 검사를 통과합니다. 이름을 바꾸면 문제 파일의 작성자도 같은 이름으로 바꿔야 합니다.

## 로컬에서 보기

```
node scripts/serve.mjs
```

브라우저에서 http://127.0.0.1:8080/ 를 엽니다. 이름을 고르고 "풀기 시작"을 누르면 이번 주 시험지가 열립니다. 포트를 바꾸려면 `node scripts/serve.mjs 3000`처럼 적습니다. Node 22 이상이 필요하고 따로 설치할 패키지는 없습니다.

## 문제 형식 요약

주차 목록 `quizzes/index.json`은 최신 주차가 맨 앞인 배열입니다.

```json
[{ "id": "2026-W42", "title": "10월 셋째 주 시험지", "published": "2026-10-16", "file": "quizzes/2026-W42.json" }]
```

한 주의 세트 `quizzes/<id>.json`은 다음 항목을 가집니다.

- `id`, `title`, `range { from, to }`, `estimatedMinutes`, `sources`, `questions`
- `sources[]`: `id`, `author`, `date`, `title`, `subject` (노션 기록 하나가 출처 하나)
- `questions[]`: 정확히 **10문제 = 개념 7 + 코드 분석 3**
  - `id` (`q1`~`q10`), `kind` (`concept` | `code`), `type` (`choice` | `short`) 두 가지 유형만 있습니다. 서술형은 없습니다.
  - `prompt`, `explanation` (5줄 이내), `concept { name, ref }`
  - 객관식: `choices` 4개와 `answer` (0~3 번호)
  - 단답형: `answer` (인정 정답 배열, 대소문자·띄어쓰기·`()` 차이는 같은 답으로 봅니다)
  - 코드 분석: `code` (노션 원문 그대로, 줄바꿈은 `\n`)
  - 출처: `sourceIds` 또는 실습 파일 `file` 중 하나 이상

## 검사하기

세트가 형식에 맞는지 검사합니다. 틀린 곳은 한국어로, 어느 문제나 출처인지 함께 알려 줍니다.

```
node scripts/validate-quiz.mjs quizzes/2026-W42.json
node scripts/validate-quiz.mjs quizzes/index.json
npm run validate
```

- `quizzes/index.json`을 주면 주차 목록을 검사합니다. 최신순인지, `file`이 `quizzes/<id>.json`인지, 파일이 대소문자까지 똑같이 있는지 봅니다 (GitHub Pages는 대소문자를 구분합니다).
- `--sources <입력 기록.json>`을 주면 노션 입력 기록과 대조합니다. 출처가 기록에 있는지, 코드가 기록 원문과 **공백 하나까지** 같은지 봅니다.
- `--members <파일>`로 이름 목록을 바꿀 수 있습니다 (기본은 `members.json`). `--strict`를 주면 경고도 실패로 처리합니다.

입력 기록 파일의 모양은 다음과 같습니다 (예: `tests/fixtures/records-2026-W42.json`).

```json
{ "records": [ { "id": "s1", "author": "김준수", "date": "2026-10-13", "title": "...", "subject": "Pandas", "codeBlocks": ["노션의 코드 블록 원문"], "files": ["sales.csv"] } ] }
```

종료 코드는 다음과 같습니다.

| 코드 | 뜻 |
|------|----|
| 0 | 통과 (`통과:` 줄 출력) |
| 1 | 검사 실패 (`오류 위치: 이유` 줄이 문제마다 하나씩) |
| 2 | 사용법이 틀렸거나 파일이 없음, JSON을 읽을 수 없음 |

## 테스트

```
npm test
```

(`node --test "tests/**/*.test.mjs"`와 같습니다. 따옴표를 꼭 붙여 주세요.) 채점 규칙, 검사 규칙, 깨진 세트 예시, 브라우저 코드 안전 규칙을 확인합니다.

브라우저로 처음부터 끝까지 확인하는 스모크 테스트는 다음과 같습니다.

```
node scripts/smoke.mjs
```

이 테스트는 `.claude/skills/design-taste-frontend` 폴더와 Chrome이 있어야 돌아갑니다. 디자인 규칙 검사는 `npm run lint:design`, 전부 한 번에 돌리려면 `npm run check`입니다.
