# Sonnet Handoff: AAO Crawling Methodology Implementation

## Goal

현재 AAO는 다음 두 가지를 이미 하고 있다.

- 웹페이지 크롤링 기반 진단 (`PACP / SEP / SPF`)
- `AI Reality Check` 기반 엔티티 인식 확인

하지만 아직 **각 LLM의 실제 검색/인용 행동을 재현하는 앞단 신호**는 약하다.

이번 작업의 목적은 전체 시스템을 갈아엎는 것이 아니라, 현재 구조 위에 아래 4가지를 추가해 **진단 정확도와 설명력**을 높이는 것이다.

1. `robots.txt` 기준 LLM 봇 접근 허용 여부 체크
2. `llms.txt` 존재 여부 체크
3. Perplexity 응답의 `citations` 실제 URL 추출 및 표시
4. 응답 텍스트 내 브랜드 첫 언급 위치 계산

이 작업은 **즉시 적용 범위**다.

중기 작업과 확장 작업은 맨 아래 TODO로만 남긴다.

---

## Current State

### 현재 구현되어 있는 것

- 크롤링 파이프라인
  - [lib/jina.js](/Users/byunheejae/Desktop/aao-mvp/lib/jina.js)
- 진단 API
  - [app/api/diagnose/route.js](/Users/byunheejae/Desktop/aao-mvp/app/api/diagnose/route.js)
- AI Reality Check API
  - [app/api/ai-check/route.js](/Users/byunheejae/Desktop/aao-mvp/app/api/ai-check/route.js)
- 3개 엔진 질의 및 인식 판정
  - [lib/ai-check.js](/Users/byunheejae/Desktop/aao-mvp/lib/ai-check.js)
- 5레이어 게이트 요약
  - [lib/gate-analysis.js](/Users/byunheejae/Desktop/aao-mvp/lib/gate-analysis.js)
- 대시보드 UI
  - [components/Dashboard.js](/Users/byunheejae/Desktop/aao-mvp/components/Dashboard.js)

### 현재 부족한 것

- `robots.txt`와 `llms.txt`를 실제로 읽어보지 않음
- Perplexity가 실제로 어떤 출처를 인용했는지 UI에 안 나옴
- 브랜드가 답변의 앞부분에 언급됐는지, 뒤에 묻혔는지 안 보임
- `Discovery / Accessibility` 레이어가 실제 외부 접근 허용 신호까지 보지 못함

---

## Scope

## Immediate Scope

### 1. robots.txt LLM bot allow/deny 체크

#### 목표

타깃 도메인의 `/robots.txt`를 가져와서 아래 봇 기준 허용/차단 상태를 판정한다.

- `GPTBot`
- `OAI-SearchBot`
- `ChatGPT-User`
- `PerplexityBot`
- `ClaudeBot`
- `Google-Extended`

#### 구현 방식

- 새 유틸 파일 추가 권장:
  - `lib/discovery-signals.js`
- 입력: URL
- 출력 예시:

```js
{
  robots: {
    fetched: true,
    url: "https://example.com/robots.txt",
    bots: {
      GPTBot: "allow",
      "OAI-SearchBot": "allow",
      "ChatGPT-User": "allow",
      PerplexityBot: "disallow",
      ClaudeBot: "unknown",
      "Google-Extended": "allow",
    },
    summary: {
      allowedCount: 4,
      deniedCount: 1,
      unknownCount: 1,
    }
  }
}
```

#### 반영 위치

- 크롤링 단계에서 함께 수집
  - [lib/jina.js](/Users/byunheejae/Desktop/aao-mvp/lib/jina.js)
- `crawl.main`, `crawl.combined` 또는 상위 `crawl.discoverySignals`에 포함
- 5레이어 게이트에 반영
  - [lib/gate-analysis.js](/Users/byunheejae/Desktop/aao-mvp/lib/gate-analysis.js)

#### 점수 반영 원칙

- `SPF` 세부 점수에 직접 큰 가중치로 넣지 말 것
- 우선 `Discovery` 또는 `Accessibility` 레이어의 근거로만 반영
- 예:
  - 주요 봇 4개 이상 허용: 가산
  - 전부 차단: 실패
  - 일부만 허용: 주의

#### 주의

- `robots.txt` 파서는 완벽 구현이 아니라 MVP 수준으로 충분
- `User-agent` 섹션을 단순 순차 해석하되, `*` fallback과 봇별 섹션 우선순위는 최소한 지킬 것

---

### 2. llms.txt 존재 여부 체크

#### 목표

타깃 도메인에서 아래 경로를 확인한다.

- `/llms.txt`

#### 구현 방식

- `GET https://domain/llms.txt`
- 성공 조건:
  - HTTP 200
  - `text/plain` 또는 유사 텍스트 응답
  - 본문 길이 최소 20자 이상

#### 출력 예시

```js
{
  llmsTxt: {
    fetched: true,
    exists: true,
    url: "https://example.com/llms.txt",
    contentLength: 842
  }
}
```

#### 반영 위치

- [lib/jina.js](/Users/byunheejae/Desktop/aao-mvp/lib/jina.js)
- [lib/gate-analysis.js](/Users/byunheejae/Desktop/aao-mvp/lib/gate-analysis.js)
- [components/Dashboard.js](/Users/byunheejae/Desktop/aao-mvp/components/Dashboard.js)

#### UI 원칙

- `Discovery` 또는 `Accessibility` 카드 근거 항목으로만 먼저 보여줄 것
- 없다고 큰 벌점을 주지 말 것
- 개선 리포트에는 권고사항으로 넣을 수 있음

---

### 3. Perplexity citations 파싱 및 표시

#### 목표

Perplexity 응답에서 실제 인용 URL 리스트를 추출해 UI에 보여준다.

#### 현재 상태

- [lib/ai-check.js](/Users/byunheejae/Desktop/aao-mvp/lib/ai-check.js) 에서 텍스트 응답 중심
- citations를 구조화해서 내려주지 않음

#### 구현 방식

- Perplexity API 응답에서 `citations` 필드가 있으면 저장
- 없으면 빈 배열

#### 출력 예시

```js
{
  engine: "perplexity",
  response: "...",
  citations: [
    "https://example.com/article-1",
    "https://example.com/article-2"
  ],
  status: "success"
}
```

#### UI 반영

- [components/Dashboard.js](/Users/byunheejae/Desktop/aao-mvp/components/Dashboard.js)
- AI 답변 확인 탭에서 엔진별 카드 하단에
  - `실제 인용 출처`
  - URL 3~5개까지 노출
- 공식 도메인이 citations에 포함되면 작은 배지로 표시
  - `공식 사이트 인용`

#### 주의

- citations는 `Perplexity`만 우선 적용
- ChatGPT/Gemini는 나중에 live search 모드 도입 시 확장

---

### 4. 브랜드 첫 언급 위치 계산

#### 목표

응답 텍스트에서 공식 엔티티가 처음 언급되는 위치를 계산해

- 상위 언급
- 중간 언급
- 하위 언급

으로 분류한다.

#### 기준

- first mention position = `첫 언급 index / 전체 텍스트 길이`
- 분류:
  - `0.00 ~ 0.20`: 상위 언급
  - `0.20 ~ 0.60`: 중간 언급
  - `0.60 ~ 1.00`: 하위 언급
  - 언급 없음: `없음`

#### 탐지 대상

- `companyName`
- `officialTitle`
- `aliases`
- `domain root label`

#### 반영 위치

- 계산 로직:
  - [lib/ai-check.js](/Users/byunheejae/Desktop/aao-mvp/lib/ai-check.js)
- UI:
  - [components/Dashboard.js](/Users/byunheejae/Desktop/aao-mvp/components/Dashboard.js)

#### 출력 예시

```js
{
  mentionPosition: {
    found: true,
    ratio: 0.12,
    bucket: "top"
  }
}
```

#### 주의

- `recognized`일 때만 강한 의미를 부여할 것
- `misidentified`나 `unknown`일 때는 참고 정보로만 보여줄 것

---

## Implementation Order

1. `lib/discovery-signals.js` 신규 생성
   - robots.txt
   - llms.txt
2. `lib/jina.js` 에 discovery signals 연결
3. `lib/gate-analysis.js` 에 robots/llms 반영
4. `lib/ai-check.js` 에 `citations`, `mentionPosition` 추가
5. `components/Dashboard.js` 에 표시 UI 추가

---

## Acceptance Criteria

### robots.txt

- `https://example.com/robots.txt`를 읽고 주요 LLM 봇 허용/차단 여부가 JSON으로 정리된다.
- 대시보드에서 최소 3개의 봇 상태가 보인다.

### llms.txt

- `/llms.txt` 존재 여부가 수집된다.
- 없으면 실패가 아니라 `권고` 수준으로 표시된다.

### Perplexity citations

- Perplexity가 citations를 반환하는 URL에서 실제 링크 리스트가 UI에 보인다.
- 공식 도메인 포함 여부를 바로 확인할 수 있다.

### 브랜드 언급 위치

- AI 답변 확인 탭에서 `상위 언급 / 중간 언급 / 하위 언급 / 없음`이 엔진별로 보인다.

---

## Non-Goals For This Task

이번 작업에서는 아래를 구현하지 않는다.

- OpenAI Responses API `web_search` 기반 live search simulation
- Gemini grounding metadata 수집
- Claude web search integration
- DB 저장
- 시계열 모니터링
- 경쟁사 비교
- 자동 PDF/이메일 보고서
- A/B diff 히스토리

이 항목들은 TODO로만 남긴다.

---

## TODO Only

### Mid-term

- [ ] LLM별 맞춤 개선 권고
  - ChatGPT용
  - Gemini용
  - Perplexity용

### Expansion

- [ ] 모니터링 파이프라인
  - 동일 URL 주기 재진단
  - DB 저장
  - 시계열 추적

- [ ] 경쟁사 비교 / AI Share of Voice
  - 동일 카테고리 프롬프트 세트
  - URL 다중 비교

- [ ] 자동 보고서 생성
  - PDF
  - 이메일 발송

- [ ] A/B 테스트 프레임워크
  - 최적화 전후 점수 비교
  - diff view

- [ ] 실측 / 복구 / 추정 provenance 표시
  - fallback 결과와 실제 결과 분리

---

## Final Guidance

이번 작업의 핵심은 **제품을 더 화려하게 만드는 것**이 아니라,
AAO가 지금 실제로 설명하지 못하던 앞단 신호를 더 정직하게 보여주는 것이다.

특히 다음 원칙을 지켜라.

- `robots.txt`는 접근 허용 신호이지, 그 자체로 높은 점수의 증거는 아니다.
- `llms.txt`는 권고 신호이지, 부재 자체로 큰 벌점 대상이 아니다.
- citations는 `Perplexity 실제 참조 출처`라는 증거로서 매우 중요하다.
- 브랜드 언급 위치는 `정확 인식`일 때만 강한 해석을 붙인다.

결과적으로 이 작업이 끝나면 사용자는 적어도 아래 질문에 바로 답을 얻어야 한다.

- 이 사이트는 LLM 봇 접근이 허용되어 있는가?
- llms.txt는 있는가?
- Perplexity는 실제로 어디를 인용했는가?
- 우리 브랜드는 답변의 앞부분에서 언급되는가, 뒤에 묻히는가?
