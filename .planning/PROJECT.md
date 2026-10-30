# 스터디 복습 퀴즈 (Weekly Review Quiz)

## What This Is

6명이 함께하는 복습 스터디용 **정적 웹사이트**(서버·DB·로그인·AI API 없음, 비용 0원). 승환이 매주 금요일 그 주 노션 "개인 복습 기록"(그리고 선택적으로 실습파일·CSV·엑셀)을 Claude Code에 넣으면, 프로젝트 스킬이 10문제 JSON을 만들고 검사해 GitHub Pages 사이트에 올린다. 스터디원은 링크 하나로 같은 10문제를 10~20분 동안 풀고, 제출하면 각 문제 위에 정답·짧은 해설·출처가 표시된다. 각자의 결과와 틀린 문제는 각자 브라우저에 저장되고, 팀 정답률은 미리 채워진 구글 폼으로 모아 "전체 정답률 낮은 문제"로 다시 사이트에 반영된다.

"혼자 만들고, 같이 쓰기" — 만드는 건 혼자, 백엔드 없이. 그래도 6명이 실제로 쓴 데이터(정답률 변화)를 남겨 포트폴리오 이야기를 살린다.

## Core Value

매주 그 주 6명의 노션 복습 기록에 근거한 10문제 세트가 링크 하나로 공유되고, 모두가 같은 문제를 풀고 출처가 달린 해설로 복습할 수 있어야 한다 — 비용 0원, 서버 없이.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**주간 출제 (Claude Code 스킬)**
- [ ] 승환이 노션 내보내기(Markdown)나 붙여넣은 내용, 선택적 실습파일·CSV·엑셀을 넣고 "이번 주 퀴즈 만들어 줘"라고 하면 스킬이 10문제 JSON을 생성한다 (Pro 구독 사용량, 추가 비용 없음)
- [ ] 7문제 = 중요 키워드 개념 + 실무에서의 쓰임 / 3문제 = 분석 코드를 보고 어떤 분석 단계·목적인지 묻는 더 어려운 문제
- [ ] 문제 형식은 **객관식(4지선다)과 단답형만** — 서술형 없음, 스스로 채점하는 상황 없음
- [ ] 단답형은 인정 정답 목록을 함께 만들어 자동 채점
- [ ] 생성된 JSON은 검사 스크립트(문항 수·7+3 구성·보기 4개·정답 존재·출처 형식·해설 5줄 이내)를 통과해야 사이트에 올라간다
- [ ] 업로드 파일이 없으면 노션 기록만으로 구성

**풀이·채점·해설 (정적 사이트)**
- [ ] 링크만 열면 이번 주 세트를 풀 수 있다 (로그인 없음, 이름만 한 번 입력)
- [ ] 풀던 답은 브라우저에 자동 저장된다
- [ ] 제출하면 즉시 자동 채점, 각 문제 위에 정답 여부·정답 표시
- [ ] 해설: 최대 5줄 요약 + 관련 개념 출처 + 노션 출처("작성자 · 날짜") 또는 실습 파일명

**오답 복습 공간**
- [ ] "내가 틀린 문제" 탭 (각자 브라우저 기록 기준)
- [ ] "스터디 전체 정답률 낮은 문제" 탭 (구글 폼으로 모은 팀 결과 기준)
- [ ] 지난 주차 세트 다시 보기 / 다시 풀기

**팀 결과 모으기**
- [ ] 결과 화면의 "결과 보내기" 버튼 → 문제별 정오답이 미리 채워진 구글 폼
- [ ] 승환이 Claude Code에 "이번 주 결과 반영해 줘" → 폼 응답(CSV)을 통계 JSON으로 바꿔 사이트에 반영

### Out of Scope

- 서버·DB·로그인·AI API — "혼자 만들고 같이 쓰기" 결정, 비용 0원 유지 (서버 버전 리서치는 `.planning/research/_superseded-server/`에 보관)
- 서술형·자기 채점 — 사용자 결정: 개인이 직접 고르는 상황을 없앰
- 노션 API 자동 연동 — 팀 DB가 다른 팀원 워크스페이스에 있어 연결 허락 필요. 주 1회 2~3분 내보내기로 충분 (팀 워크스페이스가 Claude 노션 커넥터에 연결되면 스킬이 직접 읽도록 확장 가능)
- 정답 숨김 보안 — 정적 JSON에 정답이 포함됨. 6명 신뢰 기반 스터디라 수용
- 금요일 자동 실행(크론) — 승환이 Claude Code에서 한 번 실행하는 방식
- 모바일 앱, 공개 가입, 리더보드·시간 제한

## Context

**노션 구조 (사용자 스크린샷):** "개인 복습 기록" DB(캘린더 뷰), 항목 1개 = 1명의 하루 복습 글. 속성 `작성자`(사람)·`과목`·`날짜`·`오늘의 학습 기록`. 본문 템플릿: 01 오늘 배운 내용(핵심 개념 / 내 말로 설명 / 직접 작성한 코드) · 02 어려웠던 내용(어려운 부분 / 처음 생각한 방법 / 막힌 이유) · 03 해결 방법(해결 과정 / AI 답변 / 최종 코드) · 04 한 줄 인사이트.
- 출제 매핑: 핵심 개념·내 말로 설명 → 개념 7문제 / 직접 작성한 코드·최종 코드 → 코드 분석 3문제 / 어려웠던 내용·막힌 이유 → 오답 보기 소재
- 템플릿 기본 문구("리스트", "# 여기에 코드")는 출제 재료에서 제외
- 출처 = `작성자` 칸 이름 + `날짜` (작성자 칸이 비면 제목의 이름 사용)

**노션 접근:** 팀 DB는 다른 팀원 워크스페이스(승환은 게스트, 전체 허용). Claude 노션 커넥터는 현재 승환 워크스페이스의 "AIVLE 10기 DX 복습 스터디 (견본)" 사본만 읽힘(2026-10-16 확인). → 기본 입력은 노션 Markdown 내보내기 또는 붙여넣기.

**주 범위:** `날짜`가 지난주 금요일 ~ 이번 주 금요일이면서 직전 세트에 쓰이지 않은 기록 (금요일 출제 이후·주말 기록은 다음 주로 이월).

**공개 범위:** GitHub 공개 저장소 + GitHub Pages (사용자 결정). 문제 JSON의 작성자 이름·코드·노션 내용이 공개됨을 사용자가 인지하고 선택.

**학습 도메인:** 데이터 분석 스터디 (Python, Pandas, 데이터 시각화, 데이터 분석, 머신러닝). "분석 단계" = 수집·전처리·EDA·모델링·평가 등.

**개발 환경:** Windows 11, Node v25.7.0, git 사용자 차승환 (프로젝트 로컬 설정). 설치 스킬: design-taste-frontend, agent-browser(화면 확인), find-skills 등.

## Constraints

- **Cost**: 0원 — 서버·유료 API 없음, 문제 생성은 Claude Pro 구독 안에서
- **Hosting**: GitHub Pages 정적 호스팅 (빌드 단계 없는 HTML/CSS/JS 우선 — 비개발자도 유지보수 가능)
- **Storage**: 개인 결과는 브라우저 localStorage (기기·브라우저가 바뀌면 개인 기록은 이어지지 않음)
- **Design**: design-taste-frontend 기준 (공개 웹페이지용 스킬이라 첫 화면·전체 아트 디렉션에 적용, 퀴즈·결과·오답 화면도 같은 방향)
- **Language**: UI·문제·해설 모두 한국어, 모바일 브라우저에서 풀이 가능
- **Weekly effort**: 승환의 주간 작업은 노션 내보내기 + Claude Code 한 번 실행 + 결과 반영 한 번, 합쳐 10분 이내

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 정적 사이트 + 서버 없음 ("혼자 만들고 같이 쓰기") | 비용 0원, 구현 단순, 그래도 팀 데이터는 남김 (사용자 문서 2026-10-16) | — Pending |
| 문제 생성 = Claude Code 프로젝트 스킬 (API 아님) | Pro 구독 안에서 추가 비용 없음, API 키 노출 걱정 없음 | — Pending |
| 객관식 + 단답형만, 서술형·자기 채점 없음 | 사용자 결정: 개인이 직접 고르는 상황 제거, 자동 채점만 | — Pending |
| 단답형 = 인정 정답 목록 + 정규화(공백·대소문자) 매칭 | API 없이 자동 채점 | — Pending |
| 팀 정답률 = 미리 채워진 구글 폼 → 승환이 Claude Code로 통계 JSON 반영 | 서버 없이 팀 데이터 수집, 금요일 토론 안건 | — Pending |
| GitHub 공개 저장소 + GitHub Pages | 사용자 결정 (내용 공개 인지) | — Pending |
| 노션 입력 = Markdown 내보내기/붙여넣기 기본 | 팀 DB 연결 권한 없음, 주 1회 2~3분이면 충분 | — Pending |
| 주 범위 = 지난주 금 ~ 이번 주 금, 직전 세트 미사용 기록 | 주말 기록 누락 방지 | — Pending |
| 6명 공통 세트, 금요일 출제 | 정답률 비교·토론 안건 | — Pending |
| 출처 = `작성자` 이름 + `날짜` | 사용자 지정 | — Pending |
| 출제 재료 = 노션 1. 오늘 배운 내용 + 2. 어려웠던 내용 + 첨부 실습 파일(.py/.ipynb)·자료 파일(.csv/엑셀→CSV UTF-8); 3. 해결 방법·4. 한 줄 인사이트는 제외 | 사용자 결정 2026-10-18: 3·4번은 간단히 적는 칸이라 출제 근거로 약함. 파일 첨부 주에는 10문제 중 3~4문제를 파일에서 | — Pending |
| 날짜 범위는 승환이 직접 지정 가능 (예: 미니 프로젝트 주 = 지난주 월~금 + 이번 주 수~목) | 사용자 요청 2026-10-18 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-16 after pivot to static "혼자 만들고 같이 쓰기" approach*
