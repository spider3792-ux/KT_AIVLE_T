# 문제 쓰기 기준 (rubric)

weekly-quiz 스킬의 7단계에서 읽는 문제 계약이에요. 여기 적힌 규칙은 검사기(`scripts/validate-quiz.mjs`)가 확인하는 것과 사람이 판단해야 하는 것을 함께 담았어요.

## 1. 세트 구조 요약

세트 머리말 (`work/<id>/set.json` 맨 위)

| 필드 | 규칙 |
|------|------|
| id | week.mjs 의 weekId (예: 2026-W42) |
| title | 14자 이하, "10월 셋째 주 시험지" 같은 형태 |
| range | week.mjs 의 window (`from`, `to`), 양 끝 포함 |
| estimatedMinutes | 4번 항목의 공식으로 계산 (10~20 안, 보통 13~18) |
| sources | 문제가 실제로 인용하는 기록만. id 는 records.json 과 같게, 작성자는 members.json 이름 |
| questions | 정확히 10개, id 는 q1 ~ q10 |

문제 필드

| 필드 | 규칙 |
|------|------|
| kind | `concept` 7개 + `code` 3개 |
| type | `choice` 또는 `short` 만 사용 (서술형 없음) |
| choice | `choices` 4개(서로 다름), `answer` = 정답 번호 0~3 |
| short | `answer` = 인정할 답 목록 (비어 있지 않은 문자열 배열) |
| code | kind 가 code 일 때만. records.json 코드 블록의 연속된 일부를 공백·들여쓰기·빈 줄 그대로, 줄바꿈은 LF 로 복사 |
| explanation | 5줄 이하, 줄은 `\n` 으로 이음, 한 줄 100자 안팎까지 |
| concept | `{ "name": ..., "ref": ... }`. ref 는 "pandas 공식 문서 · GroupBy" 처럼 공식 문서 항목 이름이고 URL 은 쓰지 않아요 |
| sourceIds / file | 노션 기록을 인용하면 `sourceIds`, 실습 파일을 인용하면 `file`(파일 이름) |

JSON 쓰기 주의: 코드와 해설 안의 줄바꿈은 `\n` 으로, 문자열 안의 큰따옴표는 `\"` 로 적어요. 실제 줄바꿈이 한 번만 섞여도 검사기가 종료 코드 2 로 멈춰요.

## 2. 문제 쓰는 규칙

- 정확히 10문제 = 개념(concept) 7 + 코드 분석(code) 3 (GEN-04). choice 와 short 만 써요.
- 출제 재료는 노션 1. 오늘 배운 내용, 2. 어려웠던 내용, 그리고 첨부한 실습 파일·자료 파일뿐이에요. 3. 해결 방법과 4. 한 줄 인사이트(DX 관점 포함)는 문제·보기·해설에 쓰지 않아요.
- 개념 문제는 핵심 키워드의 뜻과 실무에서의 쓰임을 물어요. 실무 쓰임은 1번 칸의 설명이나 실습 자료 파일의 데이터 상황에 기대어 써요.
- 자료 파일(.csv) 문제는 파일에 실제로 있는 열 이름·값만 써서 열의 뜻, 자료형, 결측치·이상치, 맞는 전처리·분석 단계를 물어요. 문제 필드 `file`에 파일 이름을 적어요.
- 코드 문제는 기록에 있는 코드 블록(노션 1번 칸 코드 또는 실습 파일 코드)을 그대로 보여 주고 어느 분석 단계(전처리, 탐색, 시각화, 모델링, 평가)인지, 또는 무엇을 하려는 코드인지 물어요. 개념 문제보다 어려워야 해요: 눈에 띄지 않는 단계, 흔한 함정, 실행 순서 중 하나를 골라요.
- 객관식은 보기 4개의 길이를 비슷하게 하고 방어할 수 있는 정답은 정확히 하나만 둬요. 정답 위치는 골고루 흩어 한 번호에 6개 이상 몰리지 않게 해요.
- 객관식마다 오답 보기 하나 이상은 팀원이 쓴 "어려웠던 내용" / "막힌 이유" / "처음 내가 생각한 방법"에서 가져와요 (GEN-05). 해설에서 그 오해를 바로잡아요.
- 단답형은 인정할 답을 넉넉히 적어요 (한글·영어 이름, 받는 객체를 붙인 것과 뗀 것). 대소문자, 공백, 전각 문자, 끝의 괄호는 채점기가 이미 무시해요.
- 해설은 5줄 이하. 먼저 정답 이유, 다음 오답이 헷갈리는 이유, 마지막에 짧은 예시나 규칙.
- 한 기록에서 문제를 2개까지만 내고, 기록이 5개 이상이면 모든 작성자가 한 번 이상 나오게 해요.
- 이해도가 어려움 / 복습 필요 이거나 같이 얘기해요 로 표시된 기록을 먼저 골라요.
- 템플릿 기본 문구(리스트, 여기에 코드, 팀원 의견 안내 등)는 문제에 쓰지 않아요. 기록이 뒷받침하지 않는 사실은 만들지 않아요.
- 이름을 지적하는 말투는 쓰지 않아요. "누가 틀렸다"가 아니라 "이렇게 헷갈리기 쉽다"로 써요.

## 3. 예시

아래 두 문제는 `quizzes/2026-W42.json` 의 q1 과 q10 을 그대로 옮긴 것이에요.

### q1 (개념, 객관식)

```json
{
  "id": "q1",
  "kind": "concept",
  "type": "choice",
  "prompt": "df.groupby('지역')만 실행하고 결과를 출력하면 무엇이 나오나요?",
  "choices": [
    "지역별 평균이 계산된 DataFrame",
    "묶는 기준만 기억해 둔 DataFrameGroupBy 객체",
    "지역별로 쪼개진 DataFrame 리스트",
    "지역 열만 모아 놓은 Series"
  ],
  "answer": 1,
  "explanation": "groupby()만으로는 아직 아무것도 계산하지 않아요.\n묶는 기준을 기억해 둔 DataFrameGroupBy 객체가 나와요.\nmean(), sum() 같은 집계 함수를 붙여야 값이 계산돼요.\n예: df.groupby('지역')['매출'].sum()",
  "concept": {
    "name": "groupby",
    "ref": "pandas 공식 문서 · GroupBy"
  },
  "sourceIds": [
    "s1"
  ]
}
```

첫 번째 보기는 "groupby 만 해도 이미 계산된다"는 흔한 오해에서 나왔어요. 나머지 보기도 groupby 결과가 무엇인지 헷갈릴 때 떠올리는 모양(리스트, Series)이라 그럴듯해요. 해설은 정답 이유, 집계 함수가 필요하다는 점, 짧은 예시 순서예요.

### q10 (코드, 객관식)

```json
{
  "id": "q10",
  "kind": "code",
  "type": "choice",
  "prompt": "이 코드에서 평가 결과가 실제보다 좋게 나올 수 있는 부분은 어디인가요?",
  "code": "scaler = StandardScaler()\nX_scaled = scaler.fit_transform(X)\nX_train, X_test, y_train, y_test = train_test_split(\n    X_scaled, y, test_size=0.2, random_state=42\n)\nmodel.fit(X_train, y_train)",
  "choices": [
    "test_size=0.2로 평가 데이터를 20%나 남긴 부분",
    "random_state=42로 분할을 고정한 부분",
    "model.fit()에 X_train만 넣은 부분",
    "분할하기 전에 전체 X로 스케일러를 fit한 부분"
  ],
  "answer": 3,
  "explanation": "fit_transform(X)는 전체 데이터의 평균과 표준편차를 써요.\n그 안에 나중에 평가할 테스트 데이터의 정보가 섞여요.\n이런 문제를 데이터 누수라고 해요.\n먼저 split하고 X_train으로만 fit한 뒤 X_test는 transform만 해요.",
  "concept": {
    "name": "fit과 transform 순서",
    "ref": "scikit-learn 공식 문서 · StandardScaler"
  },
  "sourceIds": [
    "s6"
  ]
}
```

나머지 세 보기는 어느 줄이 누수를 만드는지에 대한 전형적인 오해(분할 비율, 난수 고정, 학습에 쓰는 데이터)예요. code 는 s6 기록의 코드 블록에서 그대로 떼어 온 연속 부분이에요.

견본 페이지 예시: 노션 커넥터가 돌려준 견본 페이지의 작성자는 이름이 아니라 사용자 멘션이에요. 그래서 이름을 찾거나 한 번만 물어서 정하고, 정한 뒤의 상태가 records.json 이에요. 두 코드 블록은 한 글자도 바꾸지 않고 그대로 담아요. 입력과 결과는 `tests/fixtures/worked-example/` (page-example.md -> records.json)에 있어요.

## 4. 예상 풀이 시간

estimatedMinutes = round(문제별 시간의 합)

| 문제 | 시간(분) |
|------|---------|
| concept choice | 1 |
| concept short | 1.5 |
| code choice | 2 |
| code short | 2.5 |

개념 7 + 코드 3 이면 합은 항상 13 ~ 18분이에요 (GEN-06). 예: 개념 객관식 5 + 개념 단답형 2 + 코드 객관식 2 + 코드 단답형 1 = 5 + 3 + 4 + 2.5 = 14.5, 반올림해서 15.
