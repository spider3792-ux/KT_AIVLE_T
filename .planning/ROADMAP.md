# Roadmap: 스터디 복습 퀴즈 (Weekly Review Quiz)

## Overview

정적 사이트(서버 없음, 비용 0원)로 "혼자 만들고, 같이 쓰기". 먼저 샘플 세트로 풀이·채점·해설이 되는 사이트를 만들고(1), 노션 기록으로 실제 세트를 만드는 Claude Code 스킬을 붙인 뒤(2), GitHub Pages로 올려 6명이 링크로 쓰기 시작한다(3). 그다음 오답 복습 공간(4)과 구글 폼 기반 팀 정답률(5)을 더한다. **3단계가 끝나면 다음 금요일 스터디에서 바로 같이 풀어 볼 수 있다.**

## Phases

- [ ] **Phase 1: quiz-core (풀이·채점·해설 사이트)** - 샘플 세트로 풀이부터 정답·해설·출처 표시까지 되는 정적 사이트와 문제 JSON 형식·검사 스크립트
- [ ] **Phase 2: weekly-generator (주간 출제 스킬)** - 노션 내보내기·실습 파일로 7+3 세트를 만들고 검사까지 하는 Claude Code 프로젝트 스킬
- [ ] **Phase 3: share (배포·공유)** - GitHub 공개 저장소 + Pages 배포, 스킬이 세트를 올리는 흐름, 승환용 주간 루틴 안내
- [ ] **Phase 4: review-notebook (오답 복습·지난 주차)** - 내가 틀린 문제 모아보기, 통계에 영향 없는 다시 풀기, 지난 주차 보기
- [ ] **Phase 5: team-stats (팀 정답률)** - 미리 채워진 구글 폼으로 결과 모으기, 팀 통계 반영, "전체 정답률 낮은 문제" 탭

## Phase Details

### Phase 1: quiz-core (풀이·채점·해설 사이트)
**Goal**: 스터디원이 한 주 세트를 풀고 제출하면 즉시 채점되어 정답·5줄 해설·출처를 보는 정적 사이트가, 정해진 JSON 형식과 검사 스크립트 위에서 동작한다
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FMT-01, FMT-02, FMT-03, FMT-04, FMT-05, QUIZ-01, QUIZ-02, QUIZ-03, QUIZ-04, QUIZ-05, RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, DSGN-01, DSGN-02
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. 로컬에서 사이트를 열면 샘플 세트(실제 노션 템플릿 형태를 본뜬 10문제, 개념 7 + 코드 분석 3)가 보이고, 이름을 고른 뒤 끝까지 풀 수 있다 — 데스크톱과 모바일 폭 모두
  2. 풀다가 새로고침해도 답이 남아 있고, 제출 전 빈 문항 수를 확인한 뒤 제출하면 첫 시도 답이 고정된다
  3. 제출 즉시 객관식·단답형이 자동 채점되고(단답형은 공백·대소문자 차이를 무시), 각 문제 위에 정답 여부·정답·5줄 이내 해설·개념 출처·"작성자 · 날짜" 출처가 표시된다
  4. 검사 스크립트가 올바른 샘플은 통과시키고, 문항 수·구성·보기 수·정답 범위·출처 형식을 일부러 틀린 샘플은 어디가 틀렸는지 알려주며 거부한다
  5. 첫 화면과 퀴즈·결과 화면이 design-taste-frontend 기준의 하나의 디자인 방향으로 통일되어 있고, 모든 문구가 한국어다 (agent-browser로 화면 확인)
**Plans**: 6 plans (4 waves)

Plans:
- [ ] 01-01-PLAN.md — Walking skeleton: tracer sheet (JSON → render → 제출 → 채점 → localStorage → frozen reopen), name picker entry page, full 10-question sample week (wave 1)
- [ ] 01-02-PLAN.md — Author checker: validate-quiz CLI + pure core, --sources records check, index check, broken fixtures, grading/static-safety tests, README (wave 2)
- [ ] 01-03-PLAN.md — Home hero: tabbed folder stack with member tabs, front-folder name picker, Index-with-preview live thing, archival picture set, shared motion helpers (wave 2)
- [ ] 01-04-PLAN.md — Home sections: 출처 bars, itinerary slip, book-spine index, back-of-card footer with credits, motion layer, home gate with no allowance (wave 3)
- [ ] 01-05-PLAN.md — Exam sheet taking state: printed-exam art direction, thumb targets, verbatim code, draft autosave/restore, storage-failure notice (wave 3)
- [ ] 01-06-PLAN.md — Submit and results: blank-count dialog, frozen first attempt, graded-in-place result blocks and score, sheet picture decision, phase gate (wave 4)

### Phase 2: weekly-generator (주간 출제 스킬)
**Goal**: 승환이 Claude Code에서 "이번 주 퀴즈 만들어 줘" 한 번으로, 그 주 노션 기록(과 선택적 실습 파일)에 근거한 검사 통과 세트를 얻는다
**Mode:** mvp
**Depends on**: Phase 1 (JSON 형식·검사 스크립트)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08, GEN-09
**Success Criteria** (what must be TRUE):
  1. 노션 "개인 복습 기록" Markdown 내보내기 폴더(또는 붙여넣은 내용)를 주면 스킬이 출제 주 범위의 기록만 골라, 기록 수·작성자·날짜를 보여준 뒤 진행한다
  2. 만들어진 세트는 개념 7 + 코드 분석 3이고, 코드 분석 문제의 코드는 기록 원문 그대로이며, 오답 보기에 "막힌 이유"가 반영되고, 모든 출처가 실제 기록의 "작성자 · 날짜"다
  3. 스킬이 검사 스크립트를 스스로 돌려 통과할 때까지 고친 뒤 결과를 보여주고, 템플릿 기본 문구는 문제에 섞이지 않는다
  4. 실습 CSV(한글 CP949 포함)·엑셀·.py·.ipynb를 함께 주면 그 내용으로 만든 문제의 출처에 파일명이 붙고, 파일이 없으면 노션만으로 10문제가 나온다
  5. 기록이 기준(6개·작성자 3명)보다 적으면 스킬이 멈추고 승환에게 진행 여부를 묻는다
**Plans**: TBD
**사용자 준비**: 실제 주차 노션 Markdown 내보내기 1~2주 분량 (스킬 검증용). 견본 사본은 커넥터로 읽을 수 있어 초기 테스트에 사용 가능

### Phase 3: share (배포·공유)
**Goal**: 6명이 링크 하나로 이번 주 세트를 풀 수 있고, 승환의 주간 출제가 "만들기 → 확인 → 올리기"로 끝난다
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: GEN-10, DPLY-01, DPLY-02
**Success Criteria** (what must be TRUE):
  1. GitHub 공개 저장소에 올라간 사이트가 GitHub Pages 주소에서 열리고, 휴대폰에서도 풀 수 있다
  2. 스킬이 검사 통과 세트를 주차 목록에 추가하고, 승환이 확인하면 커밋·푸시까지 해서 몇 분 안에 사이트에 새 주차가 보인다
  3. README에 승환용 주간 루틴(노션 내보내기 → "이번 주 퀴즈 만들어 줘" → 링크 공유)이 단계별로 있다
  4. 실제 한 주 세트로 승환이 처음부터 끝까지 루틴을 한 번 돌려 10분 안에 끝난다
**Plans**: TBD
**사용자 준비**: GitHub 계정, 저장소 이름 결정. 문제 JSON의 작성자 이름·코드가 공개됨을 다시 확인

### Phase 4: review-notebook (오답 복습·지난 주차)
**Goal**: 스터디원이 언제든 들어와 자기가 틀린 문제를 한눈에 모아 보고 다시 풀고, 지난 주차를 다시 볼 수 있다
**Mode:** mvp
**Depends on**: Phase 3 (여러 주차가 쌓이는 흐름)
**Requirements**: REVW-01, REVW-03, REVW-04, REVW-05
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. "내가 틀린 문제" 탭에 이 브라우저에서 첫 시도에 틀린 문제가 주차와 상관없이 모여 있고, 각 문제의 정답·해설·출처를 다시 볼 수 있다
  2. 오답 문제를 다시 풀 수 있고, 다시 푼 결과는 첫 시도 기록과 점수를 바꾸지 않는다
  3. 지난 주차 목록에서 어떤 주차든 열어 처음 풀거나 결과를 다시 볼 수 있다
  4. 화면은 Phase 1과 같은 디자인 방향을 따른다
**Plans**: TBD

### Phase 5: team-stats (팀 정답률)
**Goal**: 서버 없이 6명의 결과가 모여, 사이트에서 문제별 "6명 중 N명 정답"과 "스터디 전체 정답률 낮은 문제"를 볼 수 있다
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, REVW-02
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. 결과 화면의 "결과 보내기"를 누르면 이름·주차·문제별 정오답이 이미 채워진 구글 폼이 열리고, 제출 버튼만 누르면 된다
  2. 승환이 폼 응답 CSV를 주고 "이번 주 결과 반영해 줘"라고 하면 팀 통계 JSON이 만들어져 올라가고, 같은 사람의 중복 응답은 첫 응답만 반영된다
  3. 통계가 있는 주차의 결과 화면에 문제별 "6명 중 N명 정답"이 보인다
  4. "스터디 전체 정답률 낮은 문제" 탭에 3명 이상 응답·정답률 50% 이하 문제가 모여 있다
  5. 구글 폼 만들기와 폼 주소·항목 ID 설정 방법이 안내 문서에 있다
**Plans**: TBD
**사용자 준비**: 구글 폼 1개 생성 (안내 문서대로)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. quiz-core | 0/6 | Planned | - |
| 2. weekly-generator | 0/TBD | Not started | - |
| 3. share | 0/TBD | Not started | - |
| 4. review-notebook | 0/TBD | Not started | - |
| 5. team-stats | 0/TBD | Not started | - |
