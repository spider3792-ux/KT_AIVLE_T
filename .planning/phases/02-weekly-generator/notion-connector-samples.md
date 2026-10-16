# Notion connector samples — "(견본)" 개인 복습 기록

Fetched read-only by the orchestrator on 2026-10-16 via the Claude Notion connector (notion-fetch). This is the user's own sample copy ("AIVLE 10기 DX 복습 스터디 (견본)"), **not** the team's real DB. The team DB (screenshots in PROJECT.md Context) uses a slightly different template — intake must tolerate both.

## Data source schema (견본)

```sql
CREATE TABLE "collection://4753331e-8493-4a79-809b-a734f7fb1ba0" (
  url TEXT UNIQUE,
  createdTime TEXT,
  "이해도" TEXT,                -- one of ["이해", "복습 필요", "어려움"]
  "date:날짜:start" TEXT,       -- ISO-8601 date
  "date:날짜:end" TEXT,
  "date:날짜:is_datetime" INTEGER,
  "과목" TEXT,                  -- one of ["Python","Pandas","데이터 시각화","데이터 분석","머신러닝","기타"]
  "작성자" TEXT,                -- JSON array of user IDs (person property)
  "같이 얘기해요" TEXT,          -- "__YES__" / "__NO__"
  "복습 제목" TEXT              -- title property
)
```

Connector property rendering for a page: `"작성자":["<mention-user url=\"user://33ad872b-594c-815a-a309-000228642c31\"></mention-user>"]` — the person comes back as a user-id mention, **not a name**. A connector-based dump must resolve user ids to names (notion users lookup) or fall back to the title/`members.json`.

## Template page "📋 작성 양식 (복사해서 쓰기)" — raw content as returned

```
<callout icon="🛠️" color="yellow_bg">
	이 양식을 **템플릿**으로 등록하면 '새로 만들기'만 눌러도 4칸이 자동으로 나와요. 방법은 메인 페이지 맨 아래 '사용 가이드'에 있어요. 등록 후 이 페이지는 지워도 돼요.
</callout>
### 1. 오늘 중요했던 내용
- 핵심 개념 :
- 코드나 활용 예시 :
### 2. 어려웠던 내용
- 어떤 부분이 어려웠나? :
- 처음 내가 생각한 방법 :
- 막힌 이유 :
### 3. 해결 방법
- 해결 과정 :
- AI에게 물어봤다면 AI는 어떻게 답을 제시했는지 :
- 최종 코드 또는 정답 :
### 4. 한 줄 인사이트
- 무엇을 알게 되었는지 :
- (DX 관점) 왜 이렇게 분석했나 → 무엇을 발견했나 → 업무에선 어떤 의미인가 :
---
### 💬 팀원 코멘트
-
```

Properties: `{"date:날짜:is_datetime":0,"같이 얘기해요":"__NO__","복습 제목":"📋 작성 양식 (복사해서 쓰기)"}` (no date, no author) → intake must skip the template page itself (no 날짜, title contains "작성 양식").

## Filled example "🐼 10/13 Pandas groupby (예시)" — raw content as returned

Properties: `{"date:날짜:start":"2026-10-13","같이 얘기해요":"__YES__","과목":"Pandas","복습 제목":"10/13 Pandas groupby (예시)","이해도":"복습 필요","작성자":["<mention-user url=\"user://33ad872b-594c-815a-a309-000228642c31\"></mention-user>"]}`

```
### 1. 오늘 중요했던 내용
- 핵심 개념 : groupby는 '같은 값끼리 묶고 → 묶음마다 계산'하는 기능
- 코드나 활용 예시 :
```python
df.groupby('동')['단속건수'].sum()
```
### 2. 어려웠던 내용
- 어떤 부분이 어려웠나? : 여러 기준으로 묶은 뒤 결과 표 모양이 이상하게 나옴
- 처음 내가 생각한 방법 : groupby를 두 번 연달아 씀
- 막힌 이유 : 결과가 인덱스 2단(MultiIndex)으로 나와서 다루기 어려웠음
### 3. 해결 방법
- 해결 과정 : groupby에 리스트로 기준을 한 번에 넣고 reset_index()로 표 모양 정리
- AI에게 물어봤다면 AI는 어떻게 답을 제시했는지 : agg로 합계·평균을 한 번에 구하는 방법 제시 → 내 방법보다 짧음
- 최종 코드 또는 정답 :
```python
df.groupby(['동', '요일'])['단속건수'].agg(['sum', 'mean']).reset_index()
```
### 4. 한 줄 인사이트
- 무엇을 알게 되었는지 : 집계 결과는 reset_index로 '보기 좋은 표'로 바꿔야 다음 분석이 편하다
- (DX 관점) 요일별로 묶어 보니 특정 요일에 단속이 몰림 → 단속 인력 배치를 요일별로 조정할 근거가 될 수 있음
---
### 💬 팀원 코멘트
- (스터디 때 팀원 의견을 여기에 남겨요)
```

## Template differences to tolerate (견본 vs team screenshots)

| Part | 견본 (this file) | Team DB (PROJECT.md screenshots) |
|---|---|---|
| Section 1 heading | `### 1. 오늘 중요했던 내용` | `01. 오늘 배운 내용` (H1-ish with emoji) |
| Concept | bullet `- 핵심 개념 : …` (inline) | sub-heading `핵심 개념` + bullets (placeholder `리스트`) |
| Explanation | — | sub-heading `내 말로 설명` + bullets |
| Code | bullet `- 코드나 활용 예시 :` + fence | sub-heading `직접 작성한 코드` + fence (placeholder `# 여기에 코드`) |
| Difficulty / solution / insight | same labels, `label : value` bullets | same labels, `label:` bullets |
| Extra | `(DX 관점) …` insight line; `### 💬 팀원 코멘트` section with placeholder `(스터디 때 팀원 의견을 여기에 남겨요)` | — |
| Callout | template-registration callout (template page only) | — |
| Properties | 복습 제목, 작성자, 과목, 날짜, 이해도, 같이 얘기해요 | 작성자, 과목, 날짜, 오늘의 학습 기록 (title name unknown) |

Boilerplate to strip additionally: `(스터디 때 팀원 의견을 여기에 남겨요)`, an empty `-` bullet, label bullets whose value after ` : ` / `:` is empty. Useful extra signal: `이해도` ("어려움"/"복습 필요") and `같이 얘기해요` (__YES__) mark entries worth asking about.
