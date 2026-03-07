# AAO Method Roadmap

## Purpose

이 문서는 지금까지 검토한 두 가지 방법론을 현재 AAO 코드베이스에 맞게 통합한 실행 로드맵이다.

통합한 관점은 아래 두 축이다.

1. `앞단 신호 / 게이트 / 공식 출처성` 중심 방법론
2. `LLM별 실제 검색 행동 시뮬레이션 / citation / query decomposition` 중심 방법론

이번 업데이트에서는 여기에 아래 기술 구현 관점도 합친다.

3. `질의 분해 -> 네이티브 검색 API 호출 -> citation/grounding 수집` 중심 방법론
4. `브라우저 모방 크롤링 -> fit content -> 장기적으로 reranking` 중심 방법론

핵심 원칙은 하나다.

**현재 AAO를 갈아엎지 않고, 현재 구조 위에 "실제 LLM 검색 행동 재현 레이어"를 단계적으로 추가한다.**

---

## Current Product Scope

현재 AAO가 이미 하고 있는 것:

- 웹페이지 크롤링
- 메인 vs 서브페이지 분리
- `PACP / SEP / SPF` 기반 페이지 진단
- `AI Reality Check`
- provenance separation
  - `실측 / 복구 / 추정`
- `정확 인식 / 오인식 / 미인식` 판정
- `wrong_entity / domain_mismatch / service_mismatch` 기반 Answer fact-check v2
- `strict_recall / live_search` 모드 분리
- `awareness / comparison / purchase` intent-aware AI Check v1
- 검색 쿼리 분해 추적
  - `searchQueriesUsed`
  - `queryPlan`
  - slot 기반 fan-out
- AI Check 비용 가드 v1
  - 전역 실행 한도
  - strict recall ChatGPT 조건부 실행
  - cache / skipped / unsupported 집계
- `Discovery / Accessibility / Entity / Answer / Source` 5레이어 요약
- `robots.txt / llms.txt / citation / mention position` 기반 앞단 신호 노출
- `sitemap.xml / canonical / indexability` 기반 Discovery 확장
- engine별 fan-out completeness / source mix / citation authority 해석
- 공개 URL 검증 / SSRF 방어 / 리다이렉트 안전 검사
- 전체 본문 대신 안전한 본문 미리보기만 노출
- 엔드포인트별 rate limit + Upstash 확장 준비

현재 AAO가 아직 안 하는 것:

- citation frequency 기반 측정
- 시계열 저장
- 경쟁사 비교
- ROI/RevOps 연결
- fit markdown 기반 본문 정제
- Search Console live 색인 상태 연동
- source quality 규칙의 산업군별 보정

---

## Current Snapshot (2026-03-07)

현재 코드 기준으로 보면 제품 상태는 아래처럼 정리된다.

- Phase 0는 구현 완료
- Phase 1은 구현 완료
- Phase 2는 Lite v1까지 구현됨
  - `awareness / comparison / purchase` 고정 intent
  - intent별 결과 분리 노출
  - 비용 가드와 cache 포함
- Phase 3는 일부 구현 시작
  - `strict_recall / live_search` 분리와 기본 UI는 들어감
  - `searchQueriesUsed`, grounding summary, 공식 citation 비율은 기본 수집됨
- Gemini도 `google_search` 기반 live search / grounding metadata를 기본 수집함
- `queryPlan`과 `brand / official / category / competitor / purchase` slot은 들어감
- engine별 fan-out completeness와 기본 source mix 해석은 들어감
- citation별 source class / authority 해석도 기본 반영됨
- entity archetype 기반 source fit(`strong / mixed / official_gap / off_pattern`)도 기본 반영됨
- Discovery는 `sitemap / canonical / indexability`까지 확인하고 Discovery 게이트에 반영됨
- Answer는 기본 recognition 위에 fact-check v2(`wrong_entity / domain_mismatch / service_mismatch`)를 얹음
- comparison intent에서는 경쟁사/대안 언급을 문장 단위 엔티티 앵커 기준으로 더 보수적으로 해석함
- source fixture regression baseline도 생겼음
- 다만 source quality 규칙은 아직 거칠고 산업별 커스터마이징 폭이 좁음
- Search Console live 상태와 answer fact-check의 산업군별 정교화는 아직 없음
- Phase 4~6은 아직 설계 단계

중요한 해석은 하나다.

**지금 AAO의 가장 큰 부족분은 "intent 분리" 자체가 아니라, 각 intent에서 실제 검색 쿼리가 어떻게 fan-out되고 어떤 grounding/citation이 선택되는지를 아직 충분히 수집하지 못한다는 점이다.**

---

## Integrated Methodology Mapping

두 방법론을 현재 제품에 매핑하면 아래처럼 정리된다.

### 지금 바로 제품에 맞는 것

- `robots.txt / llms.txt / 공식 도메인 인용 / 언급 위치`
- `질의 세트 기반 진단`
- `LLM별 네이티브 검색 API 기반 live search simulation`
- `citation frequency / visibility score / misidentification taxonomy`
- `크롤링 본문 정제와 boilerplate 감소`

### 장기적으로 맞는 것

- 시계열 저장
- 경쟁사 비교
- AI Share of Voice
- 자동 보고서
- Agentic pipeline / CRM / RevOps

### 지금은 과한 것

- cross-encoder reranking
- RRF 기반 자체 retrieval stack
- Headless browser 기반 대규모 UI 응답 수집
- WebProber / AgentA/B 류의 자율 상호작용 테스트
- MCP / agent authentication / delegated auth

위 항목들은 완전히 버리는 것이 아니라, 현재 제품 단계에서는 후순위로 둔다.

---

## Product Direction

AAO는 아래 3개 레이어로 진화한다.

### Layer 1. Page Diagnosis

질문:
- 이 사이트는 AI가 읽을 수 있는가?
- 구조는 어떤가?
- 메인 페이지와 서브페이지 사이에 정보 격차가 있는가?

현재 구현됨.

### Layer 2. Entity / Recall Check

질문:
- 이 모델은 이 회사를 정확히 알고 있는가?
- 오인식하는가?
- 미인식하는가?

현재 구현됨.

- `strict_recall` 결과를 별도 수집
- ChatGPT + Gemini를 recall 계열로 사용
- 미지원 엔진은 `unsupported`로 명시

즉 Layer 2는 이제 독립 레이어로 존재하고, 현재는 `awareness / comparison / purchase` 3 intent를 기준으로 recall을 분리 수집한다.

### Layer 3. Live Search Simulation

질문:
- 이 모델이 실제 검색/grounding/web search를 켰을 때 어떤 출처를 선택하는가?
- 공식 사이트를 실제로 인용하는가?
- 검색 쿼리를 어떻게 분해하는가?

부분 구현됨.

- `live_search` 결과를 별도 수집
- ChatGPT + Gemini + Perplexity citations / latency / tokenUsage 저장
- 엔진별 `searchQueriesUsed` / grounding summary / 공식 citation 비율 집계
- `queryPlan`과 slot 기반 fan-out(`brand / official / category / competitor / purchase`) 저장
- UI에서 recall과 live search를 분리 노출
- Dashboard에 fan-out completeness / source mix 요약 노출
- citation별 source class / authority badge 노출
- entity archetype / source fit(`strong / mixed / official_gap / off_pattern`) 노출

다만 아직 source quality 규칙이 거칠고 산업별 커스터마이징이 없어 v1 완성 상태는 아니다.

### Layer 4. Answer Fact-check

질문:
- 이 응답은 정말 이 회사를 설명하는가?
- 공식 도메인/서비스 정의와 어긋나지 않는가?
- 다른 회사를 설명하고 있지는 않은가?

부분 구현됨.

- `wrong_entity / domain_mismatch / service_mismatch / aligned / weak` 판정
- Dashboard 배지 및 Answer 게이트 evidence 반영
- comparison intent는 경쟁사 언급을 문장 단위 엔티티 앵커 기준으로 완화
- fixture regression baseline(`aligned / wrong_entity / domain_mismatch / service_mismatch / comparisonSafe / weak`) 추가

다만 아직 엔진별 정답셋, 산업군별 서비스 정의 규칙, intent별 예외 처리는 거칠다.

---

## Phase 0: Already Done

이 단계는 이미 반영됨.

- 5레이어 게이트 요약
  - `Discovery`
  - `Accessibility`
  - `Entity`
  - `Answer`
  - `Source`
- `정확 인식 / 오인식 / 미인식 / 오류` 상태 분리
- 메인 vs 서브페이지 Gap 분석
- 메인 페이지에 심을 추천 문장 생성

이 단계는 앞으로도 유지한다.

---

## Cross-cutting Hardening: Already Done

이 항목은 phase 번호와 별개로 이미 들어간 운영 안전장치다.

- 공개 URL만 허용
  - `http/https`만 허용
  - 사설/예약 네트워크 차단
  - unsafe redirect 차단
- `rawContent` 전체 본문 비노출
  - Dashboard에는 안전한 preview만 제공
- endpoint별 rate limit namespace 분리
- Upstash REST 기반 확장 가능 구조

이 항목은 앞으로 phase와 무관하게 기본 전제로 유지한다.

---

## Phase 1: Front Signal Hardening

**Status: 6/6 완료**

### Goal

점수보다 먼저, **AI가 접근 가능한지 / 실제로 무엇을 읽는지 / 실제로 무엇을 인용했는지**를 더 정직하게 보여주는 단계.

### Scope

#### 1. robots.txt LLM bot access check ✅ Done

- 대상 봇
  - `GPTBot`
  - `OAI-SearchBot`
  - `ChatGPT-User`
  - `PerplexityBot`
  - `ClaudeBot`
  - `Google-Extended`
- 출력
  - allow / disallow / unknown
- 반영 레이어
  - `Discovery` (mild score adjustment) + Raw Data 탭 표시
- 구현 위치
  - `lib/discovery-signals.js` → `fetchRobotsSignal()`
  - `lib/jina.js` → `crawlSite()` 병렬 수집
  - `lib/gate-analysis.js` → `evaluateDiscovery()` 반영
  - `components/Dashboard.js` → Raw Data 탭 LLM 봇 접근 신호 섹션

#### 2. llms.txt presence check ✅ Done

- `/llms.txt` 존재 여부
- content length 저장
- 점수 대벌점 금지
- 권고 신호로만 사용
- 구현 위치
  - `lib/discovery-signals.js` → `fetchLlmsTxtSignal()`
  - `lib/gate-analysis.js` → `evaluateAccessibility()` 반영 (+5 if exists)
  - `components/Dashboard.js` → Raw Data 탭 표시

#### 3. sitemap / canonical / indexability surfacing ✅ Done

- `robots.txt`의 sitemap URL 추출 + `/sitemap.xml` fallback
- canonical / meta robots / `x-robots-tag` 추출
- indexability 상태 계산
  - `indexable`
  - `likely_indexable`
  - `noindex`
  - `unknown`
- 반영 레이어
  - `Discovery` 게이트 점수 및 evidence
  - Raw Data 탭 메타/Discovery 섹션
- 구현 위치
  - `lib/discovery-signals.js` → `fetchSitemapSignal()`
  - `lib/jina.js` → canonical / robots / `x-robots-tag` / indexability 추출
  - `lib/gate-analysis.js` → `evaluateDiscovery()` 반영
  - `components/Dashboard.js` → Raw Data 탭 표시

#### 4. ChatGPT + Gemini + Perplexity citations extraction ✅ Done

- 실제 citation URL 추출
- 공식 도메인 인용 여부 표시
- Dashboard 노출
- 구현 위치
  - `lib/ai-check.js` → `askChatGPT()` `url_citation` 파싱
  - `lib/ai-check.js` → `askGemini()` grounding chunk URL 파싱
  - `lib/ai-check.js` → `askPerplexity()` citations 파싱
  - `components/Dashboard.js` → 엔진 카드 실제 인용 출처 목록 (최대 5개)

#### 5. Brand first-mention position ✅ Done

- 응답 텍스트 내 첫 언급 위치 계산
- `top / middle / bottom / none`
- `recognized`일 때만 강한 의미 부여
- 구현 위치
  - `lib/ai-check.js` → `computeMentionPosition()`
  - `components/Dashboard.js` → 엔진 카드 mentionPosition 배지

#### 6. Provenance separation ✅ Done

- 결과 출처를 분리
  - `실측`
  - `복구`
  - `추정`
- fallback 문구와 점수를 실제 진단처럼 보이지 않게 표시
- 구현 위치
  - `lib/diagnose.js` → top-level / axis / subscore / summary / improvement source 태깅
  - `components/Dashboard.js` → `ProvenanceBadge`, `ProvenanceLegend`

### Implementation Notes

- `robots.txt`는 `Discovery` 또는 `Accessibility` 게이트의 근거로만 약하게 반영한다.
- `llms.txt`는 권고 신호로만 사용하고 부재 자체로 큰 벌점을 주지 않는다.
- `sitemap / canonical / indexability`는 검색 발견성의 증거 레이어로 반영하되, Search Console의 실제 색인 상태와 동일시하지 않는다.
- `citations`와 `mentionPosition`은 점수보다 먼저 보여주는 증거 레이어다.
- `공식 사이트 인용`은 문자열 포함이 아니라 URL hostname 정규화 기준으로 판정하는 것이 이상적이다.
- 현재는 `strict_recall`과 `live_search` 모드를 데이터 모델과 UI에서 분리했다.
- 지원하지 않는 엔진/모드는 `unsupported`로 표기해 결과 해석을 섞지 않는다.

### Outcome

이 단계가 끝나면 사용자는 최소한 아래를 바로 알 수 있어야 한다.

- 이 사이트는 LLM 봇 접근이 허용되어 있는가?
- llms.txt가 있는가?
- sitemap과 canonical은 발견성 관점에서 정합한가?
- 이 URL에 noindex 같은 명시적 차단 신호가 있는가?
- 엔진은 실제로 어디를 봤는가?
- 브랜드는 응답의 앞부분에 등장하는가?
- 이 결과는 실제 측정인가, 복구/추정인가?

### Exit Criteria

아래 조건이 모두 만족되면 Phase 1 완료로 본다.

- robots / llms / citations / mention position 노출 완료
- sitemap / canonical / indexability 노출 완료
- provenance 라벨(`실측 / 복구 / 추정`) 도입
- fallback 결과가 UI에서 명시적으로 구분됨
- 공식 도메인 인용 판정이 hostname 정규화 기준으로 동작

---

### Note: SEO + AAO Two-track Principle

#### Background

AAO의 AI 프로필 페이지는 고객의 기존 웹사이트를 전면 수정하는 접근이 아니다.
기존 사이트는 계속 SEO용 자산으로 활용하고, AI 프로필 페이지는 `/ai-profile` 경로에 별도로 추가하여
AI 크롤러가 읽기 쉬운 공식 페이지를 제공하는 방식이다.

#### Principle

- 기존 SEO 자산을 훼손하지 않는 방향을 우선한다
- 기존 웹사이트의 HTML, CSS, JavaScript, 라우팅 구조는 가능한 한 크게 건드리지 않는다
- AI 프로필 페이지는 독립된 정적 HTML 파일 1개로 운영 가능해야 한다
- 고객 도메인의 `/ai-profile` 경로에 파일 업로드만으로 설치가 끝나는 구조를 지향한다
- SEO와 AAO가 함께 작동하도록 설계한다
  - 사람은 기존 사이트를 계속 방문하고
  - AI는 AI 프로필 페이지를 공식 출처 후보로 읽게 만든다

#### Low-friction Adoption

- 웹사이트 전체 리뉴얼이 필요하지 않다
- 기존 개발팀/마케팅팀의 대규모 승인 프로세스 없이도 도입 가능성이 높다
- FTP 또는 정적 파일 업로드만으로 짧은 시간 안에 설치 가능하도록 설계한다
- 설치 후 기존 SEO 순위 리스크를 최소화하는 방향으로 운영한다
- 제거도 파일 삭제 1회로 되돌릴 수 있는 구조를 우선한다

#### Technical Direction

- AI 프로필 페이지는 순수 정적 HTML을 기본값으로 둔다
- Schema.org JSON-LD 3종 이상 포함
  - `Organization`
  - `SoftwareApplication` 또는 `LocalBusiness`
  - `FAQPage`
- 시맨틱 HTML 구조 유지
  - `H1 -> H2 -> H3`
- `robots: index, follow` 명시

#### Discoverability Conditions

AI 프로필 페이지를 "그냥 올려두는 것"만으로는 부족할 수 있다.
최소한 아래 4가지는 설치 가이드에 반드시 포함한다.

- 메인 사이트 footer 또는 소개 페이지에 `/ai-profile` 링크 1개 추가 권장
- sitemap에 `/ai-profile` 포함 권장
- `robots.txt`와 `llms.txt`에서 차단되지 않는지 설치 전 점검
- self-canonical 및 indexable 상태 확인

#### Sales Message

"기존 웹사이트를 크게 수정하지 않고도 AI 전용 공식 페이지를 추가할 수 있습니다. 기존 SEO 자산은 유지하면서, AI가 읽기 쉬운 프로필 페이지를 별도로 제공하는 방식입니다."

#### Competitive Difference

현재 GEO/AEO 시장의 다수 업체는 진단, 컨설팅, 모니터링에 집중한다.
반면 AAO는 고객 도메인에 실제로 들어가는 AI 전용 페이지를 직접 설계하고 제작·설치까지 연결하는 실행형 서비스 포지션을 노린다.

#### Why This Is Different From Wiki / External Platforms

| 항목 | 위키/외부 사이트 | AAO AI 프로필 (자사 도메인) |
|------|----------------|--------------------------|
| AI 인용 시 출처 | "위키피디아에 따르면" | "공식 사이트에 따르면" |
| 정보 통제권 | 제한적이거나 외부 정책에 의존 | 고객이 직접 통제 |
| 소상공인/인플루언서 등재 | 플랫폼 정책에 따라 어려울 수 있음 | 자기 도메인 기준으로 누구나 가능 |
| 플랫폼 종속 | 있음 | 낮음 |
| 업데이트 속도 | 승인/운영 정책에 좌우됨 | 파일 교체로 빠른 반영 가능 |
| AI 크롤러 접근성 | 플랫폼 정책 의존 | 고객이 직접 점검 가능 |

핵심은 위키가 "남이 당신을 설명하는 구조"라면,
AI 프로필은 "공식 사이트가 AI에게 직접 자기소개하는 구조"라는 점이다.

---

## Phase 1.5: AI Profile Page Service

**Status: In Progress (v3 pilot baseline implemented)**

**Type: Commercialization Layer**

### Goal

진단 결과에서 바로 연결되는 첫 번째 유료 서비스 레이어를 만든다.
즉, "문제를 발견했습니다"에서 끝나지 않고 "해결도 제공하겠습니다"까지 하나의 흐름으로 연결한다.

### Background

현재 AAO는 진단까지는 무료로 제공할 수 있지만,
사용자는 결국 "그래서 어떻게 고치나?"를 묻게 된다.
이때 가장 자연스러운 전환은 "AI 프로필 페이지를 제작해서 설치해드리겠습니다"다.

이 레이어는 진단 도구에서 실행형 SaaS/서비스로 넘어가는 첫 번째 수익 지점이다.

### Service Scope

#### Input

- 진단 결과
  - `PACP / SEP / SPF`
  - Gap 분석
  - AI Reality Check
- 고객 기본 정보
  - 회사명
  - 업종
  - 대표자
  - 연락처
  - 주요 서비스/제품
- 고객이 이미 보유한 자료
  - 사업자등록증
  - 회사소개서
  - 포트폴리오
  - SNS/영상 링크

#### Deliverables

- AI 프로필 페이지 HTML 파일 1개
- Schema.org JSON-LD 3종 이상
  - 업종별로 `Organization`, `LocalBusiness`, `SoftwareApplication`, `Person` 등을 선택
- 시맨틱 HTML
  - `H1 -> H2 -> H3`
- FAQ 5~10개
  - 한국어 + 영어
- 역피라미드 구조
  - 핵심 정보가 상위 20% 이내
- 업종 기준 수치/근거 인라인 인용
- 한국어/영어 이중 언어
- JavaScript 제로, CSS 최소화
- 설치 가이드 문서
  - FTP
  - Vercel
  - Netlify
  - 카페24 등

#### Installation Support

- 기본: 고객이 직접 설치할 수 있도록 가이드 제공
- 옵션: 서버 접근 권한을 받아 대행 설치
- 설치 후 AAO 진단 재실행
  - Before/After 비교 리포트 제공

### Price Model

| 플랜 | 가격 | 포함 내용 |
|------|------|----------|
| 기본 | 33만 원 (1회) | AI 프로필 페이지 1개 + 설치 가이드 + Before/After 리포트 |
| 프로 | 월 5.5만 원 | 기본 + 분기별 업데이트 + AI Reality Check 월간 모니터링 |
| 비즈니스 | 월 16.5만 원 | 프로 + 다국어 3개 언어 + 경쟁사 비교 + 커스텀 FAQ 20개 |

### Automation Roadmap

#### v1: Manual Delivery

- 진단 결과 + 고객 자료를 받아 수동으로 AI 프로필 페이지 작성
- 월 10~20건 정도의 소수 고객 대응
- Before/After 케이스 스터디 축적이 목적

#### v2: Assisted Drafting

- 진단 결과에서 AI 프로필 초안 자동 생성
- 사람 검수 후 납품
- 월 50~100건 대응 가능 구조 목표

#### v3: Self-serve Generation

- 고객이 직접 정보 입력
- 초안 자동 생성
- 미리보기
- 결제
- 다운로드

### Funnel

```text
무료 진단
  -> 진단 결과 확인
    -> "AI 프로필 페이지가 필요합니다" CTA
      -> 기본 정보 입력
        -> 결제
          -> AI 프로필 제작
            -> 설치 가이드 + Before/After 리포트
              -> 월간 모니터링 구독 전환
```

### Current Snapshot In Code

현재 코드 기준으로는 최소 유효 퍼널, 기본 운영 레이어, 파일럿 운영 보드까지 들어가 있다.

- Dashboard의 `AI 프로필 페이지 제작 문의` CTA가 실제 제작 요청 페이지로 연결된다
- `/ai-profile/request` 페이지에서 진단 스냅샷을 이어받아 intake를 시작할 수 있다
- `/api/intake`가 입력값을 검증하고 문의 초안, Before/After 초안, 메일 본문, Markdown export를 생성한다
- 업종별 템플릿 라이브러리와 호스팅별 설치 SOP가 초안 생성에 반영된다
- `NEXT_PUBLIC_*` 링크를 넣으면 결제 / 킥오프 / 상태 추적 / 상담 채널을 UI에서 바로 열 수 있다
- 외부 링크가 없으면 앱 내부 fallback 운영 페이지가 대신 열린다
- 파일럿 stage flow / checklist / SLA / 공개 케이스 초안이 생성된다
- 첫 파일럿 케이스로 `AAO self-rollout` 실측 케이스가 앱에 고정돼 있다
- 메인 랜딩 `50점` -> `/ai-profile` `57점` 실측 uplift `+7점`이 반영돼 있다
- 메인 canonical, `/ai-profile` canonical, `robots.txt`, `sitemap.xml`, `llms.txt`가 코드에 반영돼 있다
- featured pilot case 상세 페이지와 재진단 진입점이 있다
- 아직 CRM 저장, 실제 결제 처리, 실고객 운영 로그는 없다

### Operating Requirements

이 레이어는 문구만으로 굴러가지 않는다.
최소 아래 4가지 운영 조건이 있어야 상업적으로 지속 가능하다.

- 업종별 템플릿 라이브러리
- 고객 자료 intake 폼
- 설치 SOP
- Before/After 측정 기준

### Core KPI

- 무료 진단 -> AI 프로필 제작 전환율
  - 목표 `5~10%`
- Before/After 평균 점수 향상
  - 목표 `+40점 이상`
- 고객 만족도(NPS)
  - 목표 `70+`
- 첫 6개월 제작 건수
  - 목표 `50건`
- 첫 6개월 공개 케이스 스터디
  - 목표 `10건`

### Exit Criteria

- 서비스 패키지 정의 완료
- 가격표 확정
- intake / 제작 / 설치 / 재측정 운영 플로우 문서화
- Before/After 리포트 템플릿 완성
- 최소 3건 이상의 파일럿 납품 완료

### Remaining Work After v3 Pilot Baseline

- 실제 결제 / 상태 추적 링크 연결
- 파일럿 운영 로그 / CRM 저장
- 첫 파일럿 케이스 공개 proof 정리
- 업종별 템플릿을 실제 납품 템플릿으로 정제
- 실제 파일럿 납품과 공개 케이스 스터디 확보

---

## Phase 2: Query Set Expansion

**Status: Not Started**

### Goal

현재의 단일 질의 기반 진단을 **질의 세트 기반 진단**으로 확장한다.

### Boundary Note

이 phase는 query set 설계와 intent 확장이 목적이다.
여기서는 `strict_recall / live_search` 양쪽에 공통으로 들어갈 intent taxonomy를 먼저 고정한다.

현재 코드 기준으로 모드 분리는 끝났고,
이제 제품은 `단일 entity 질문`에서 `intent-aware query set`으로 넘어가야 한다.

### Why

실제 LLM은 단일 고정 질문으로만 동작하지 않는다.
질문의 유형에 따라 검색과 인용 행동이 크게 달라진다.

### Scope

#### 1. Prompt taxonomy

고객사/카테고리별로 질문을 3계층 이상으로 나눈다.

- 인지
  - `~란 무엇인가?`
  - `~ 종류`
- 비교
  - `~ vs ~`
  - `~ 비교`
  - `~ 추천`
- 구매/도입
  - `~ 가격`
  - `~ 도입 방법`
  - `~ 사례`

#### 2. Query set templates

브랜드/서비스/카테고리 입력 시 자동으로 프롬프트 세트를 생성한다.

#### 3. Query fan-out awareness

직접 팬아웃을 구현하는 것이 아니라,
적어도 내부 데이터 모델 상에는 아래를 남긴다.

- 원본 프롬프트
- intent category
- brand terms
- competitor terms

### Query Design Principle

이 단계의 목적은 단순히 프롬프트를 많이 만드는 것이 아니다.

- LLM은 실제로 단일 질문을 여러 하위 검색 쿼리로 분해할 수 있다.
- 따라서 AAO도 최소한 `인지 / 비교 / 구매` 질문군을 분리해야 한다.
- 이후 live search simulation에서 수집되는 `searchQueriesUsed`를 통해 실제 팬아웃 패턴을 비교할 수 있어야 한다.

예시:

- 원본 프롬프트:
  - `B2B SaaS 고객지원 자동화 솔루션 추천`
- 내부 분류:
  - intent: `comparison`
  - brand terms
  - competitor terms
  - location

### Outcome

이 단계가 끝나면 AAO는
`이 URL의 점수`
가 아니라
`이 브랜드가 인지/비교/구매 질문에서 각각 어떻게 보이는가`
를 설명할 수 있어야 한다.

### Recommended Cut (Phase 2 Lite)

처음부터 크게 시작하지 않는다.

- intent는 `awareness / comparison / purchase` 3종만
- 각 intent당 템플릿 2~3개
- 브랜드/카테고리/경쟁사 슬롯만 먼저 지원

### Exit Criteria

- query template 생성기 구현
- 각 query에 intent/category 메타 저장
- Dashboard 또는 내부 로그에서 intent별 결과 분리 가능
- 비용 상한이 있는 fan-out 정책 존재

---

## Phase 3: Native Live Search Simulation v1

**Status: Started**

### Goal

현재 `AI Reality Check`의 recall-style 검사 위에, **실제 검색 API 기반 시뮬레이션 모드**를 추가한다.

### Principle

현재 모드는 유지한다.

- `Recall Check`
  - 지금 방식
  - 빠르고 저렴함
  - 모델이 이미 알고 있는가를 봄

- `Live Search Simulation`
  - 새 방식
  - 느리고 비싸지만 정확함
  - 모델이 실제 검색/grounding 시 어떤 행동을 하는지 봄

### Current Gap

현재 구현은 v0.7 수준이다.

- `live_search` 모드는 분리되었고
- ChatGPT + Gemini + Perplexity 결과를 별도 저장하며
- query / citations / latency / tokenUsage도 남긴다
- `searchQueriesUsed` / grounding summary / 공식 citation 비율도 기본 수집한다

하지만 아래는 아직 없다.

- deeper fan-out metadata
- source quality 규칙의 산업별 고도화
- Redis 계열 캐시나 분산 sampling 정책

### Scope

#### 1. ChatGPT live search

- OpenAI Responses API
- `web_search` / `web_search_preview`
- 수집할 것
  - response text
  - url citations
  - search context size
  - latency
  - token usage
  - user location
  - 가능하면 query annotations

#### 2. Gemini grounding

- Google Search 기반 grounding
- 수집할 것
  - `groundingMetadata.web_search_queries`
  - `grounding_chunks`
  - `grounding_supports`
  - `confidence_scores`

#### 3. Perplexity live search

- Sonar API 고도화
- 수집할 것
  - citations
  - recency filter
  - domain filter
  - related questions
  - location
  - actual search knobs used

#### 4. Claude

- 가능하면 추가
- 하지만 초기 v1에서는 보류 가능
- 이유
  - 키/도구/API 조건 추가 필요

### Simulation Principle

이 레이어의 목적은 `모델이 이미 알고 있나`를 묻는 것이 아니라, `실제 검색 시 어떤 출처를 택하나`를 관찰하는 것이다.

- `Recall Check`는 계속 유지
- `Live Search Simulation`은 별도 실행
- 둘의 결과를 섞지 말고 나란히 보여준다

### Cost Principle

- 현재는 `ChatGPT + Gemini + Perplexity` 3개 엔진을 동일 프레임에 올리고,
- 비용 가드는 우선순위 기반 `AI_CHECK_MAX_TASKS`로 통제하는 것이 현실적이다.
- Claude는 v1에서 보류해도 된다.
- 핵심 쿼리만 일간/주간으로 제한해 비용을 통제한다.
- 현재 구현은 후보 15개 중 우선순위 기반으로 최대 `AI_CHECK_MAX_TASKS`개만 실행하며, 기본값은 7이다.
- `strict_recall ChatGPT`는 env로 비활성화 가능하고, in-memory cache가 붙어 있다.
- 트래픽 증가 시에는 Redis 계열 캐시와 분산 sampling 정책이 추가로 필요하다.

### Data Schema

각 실행 결과는 최소 아래 구조로 정규화한다.

```json
{
  "mode": "recall|live_search",
  "engine": "chatgpt|gemini|perplexity|claude",
  "query": {
    "text": "...",
    "intent": "awareness|comparison|purchase",
    "location": { "country": "KR", "city": "Seoul" }
  },
  "responseText": "...",
  "citations": [],
  "matchStatus": "recognized|misidentified|unknown|error",
  "mentionPosition": {
    "found": true,
    "ratio": 0.18,
    "bucket": "top"
  },
  "latencyMs": 0,
  "tokenUsage": {},
  "searchQueriesUsed": [],
  "citationMetrics": {
    "official": 0,
    "total": 0,
    "officialRatio": 0.0
  },
  "groundingMetadata": {
    "grounded": true,
    "searchQueryCount": 0,
    "sourceCount": 0
  }
}
```

### Outcome

이 단계가 끝나면 AAO는
`모델이 이 브랜드를 기억하는가`
와
`모델이 실제 검색할 때 이 브랜드를 인용하는가`
를 분리해 보여줄 수 있어야 한다.

### Exit Criteria

- `recall`과 `live_search` 모드가 데이터 모델에서 분리됨
- 최소 3개 엔진(`ChatGPT + Gemini + Perplexity`) live search/strict recall 조합 수집 가능
- query / citations / latency / tokenUsage 저장
- `searchQueriesUsed` / grounding summary / 공식 citation 비율 저장
- intent별 실행 결과가 남음
- recall 결과와 live search 결과가 UI에서 구분 노출됨

---

## Phase 4: Citation Intelligence

**Status: Not Started**

### Goal

실검색 시뮬레이션 결과를 바탕으로 **인용과 가시성을 정량화**한다.

### Scope

#### 1. Citation Frequency

- 프롬프트 세트 중 공식 도메인 또는 브랜드가 실제 인용된 비율

#### 2. Brand Visibility Score

- 단순 언급이 아니라
  - 언급 위치
  - citation 포함 여부
  - 공식 도메인 인용 여부
  - 감성
를 합친 복합 지표

#### 3. Misidentification taxonomy

- 다른 회사로 착각
- 일반 개념으로 해석
- 약어 충돌
- 유사 카테고리 브랜드로 오인

#### 4. LLM-specific recommendation

- ChatGPT용 권고
- Gemini용 권고
- Perplexity용 권고

### Metric Principle

이 단계부터는 단순한 `인식됨/미인식`보다 아래 항목이 더 중요해진다.

- 실제 citation 존재 여부
- 공식 사이트 citation 여부
- 응답 내 첫 언급 위치
- 감성
- 오인식 유형

즉 `왜 안 보이느냐`를 넘어서 `왜 공식 사이트가 선택되지 않았느냐`를 설명하는 단계다.

### Outcome

이 단계가 끝나면 제품은
`왜 안 보이는가`
를 넘어서
`왜 공식 사이트가 인용에서 밀리는가`
까지 출처 기준으로 설명할 수 있어야 한다.

### Exit Criteria

- Citation Frequency 계산
- Brand Visibility Score 계산
- misidentification taxonomy 저장
- 엔진별 권고 로직 최소 1차 버전 구현

---

## Phase 5: Crawl Quality Upgrade

**Status: Partially Started**

### Goal

크롤링 입력층을 실제 LLM 친화적 본문에 더 가깝게 만든다.

### Scope

#### 1. Boilerplate reduction

- 메뉴
- 버튼
- 반복 CTA
- 푸터
비중이 높은 페이지를 감점 또는 경고

#### 2. Fit markdown concept

- raw extraction과 별도로
  - 노이즈를 줄인 `fit content`
  - 진단용 본문
을 분리

#### 3. Long-block control

- 긴 텍스트 블록
- 의미 단위 청킹 가능성
- 리스트/표/섹션 구조
를 더 명시적으로 진단

#### 4. Discovery/Crawl quality hardening

- 단어 수만으로 usable 판단하지 않기
- 본문 중심성 신호 강화

### Technique Direction

이 단계에서 참고할 개념은 아래와 같다.

- raw extraction
- fit content
- boilerplate reduction
- long block control
- 본문 중심성

단, 현재 제품 단계에서는 `자체 하이브리드 retrieval + reranking`까지 가지 않는다.
지금은 어디까지나 **고객 사이트에서 진단 입력으로 쓸 본문을 더 잘 뽑는 것**이 목적이다.

### Outcome

이 단계가 끝나면
`크롤링은 성공했지만 사실상 메뉴만 읽은 페이지`
를 더 잘 걸러낼 수 있어야 한다.

### Current Base Already Present

- direct fetch + light crawl + Jina fallback
- long block count
- text ratio
- main vs subpage gap

### Exit Criteria

- boilerplate 경고 또는 감점 로직 추가
- `fit content`와 `raw extraction` 분리
- usable 판정이 단어 수 외 본문 중심성까지 반영
- 메뉴/CTA 과다 페이지를 별도 식별 가능

---

## Phase 6: Monitoring & Competitive Intelligence

**Status: Not Started**

### Goal

AAO를 단발 진단이 아니라 운영형 제품으로 확장한다.

### Scope

#### 1. Scheduled reruns

- 일간 / 주간 / 월간 재진단

#### 2. Time-series storage

- DB 저장
- 점수 변화 추이
- citation 변화 추이

#### 3. Competitive comparison

- 동일 카테고리 프롬프트 세트
- 경쟁사 URL 비교
- AI Share of Voice

#### 4. Alerting

- 인용 탈락
- 감성 하락
- 오인식 증가

#### 5. Automated reports

- PDF
- 이메일
- before/after diff

### Expected Metric Layer

이 단계에서 처음으로 아래 지표가 제품의 핵심이 된다.

- Citation Frequency
- Brand Visibility Score
- AI Share of Voice
- sentiment trend
- before/after visibility delta

### Outcome

이 단계가 끝나면 AAO는
`현재 점수`
가 아니라
`시간 경과에 따라 어떻게 바뀌고 있는지`
를 설명할 수 있어야 한다.

### Exit Criteria

- 재실행 스케줄러 존재
- time-series 저장
- 경쟁사 비교 실행 가능
- alerting 1종 이상 구현
- before/after 자동 리포트 생성 가능

---

## Phase 7: Long-term Expansion

### Goal

웹페이지 진단 도구를 넘어, 에이전트 주도 구매 여정 대응 플랫폼으로 확장한다.

### Possible Directions

- 10-Gate 확장
  - Discovered
  - Selected
  - Crawled
  - Rendered
  - Indexed
  - Annotated
  - Recruited
  - Grounded
  - Displayed
  - Won
- Entity Home + API-accessible catalog
- 공식 사이트 외 제3자 출처 평가
- Agentic pipeline value
- CRM / RevOps 연동
- 필요시 query decomposition + retrieval orchestration의 자체 엔진화
- 장기적으로 UI 행동 시뮬레이션(WebProber / AgentA/B 계열) 검토

### Note

이 단계는 현재 MVP 범위를 넘는다.
지금 제품 설명에 직접 넣지 않는다.

---

## Track B: Expansion Hypothesis

이 트랙은 메인 B2B 로드맵과 같은 선상에 두지 않는다.
ICP, 가격, 운영 방식이 다르기 때문에 별도 가설로 관리한다.

### Hypothesis

웹사이트가 없는 인플루언서, 크리에이터, 프리랜서에게
"AI가 읽을 수 있는 전용 프로필 링크"를 제공하면,
기존 Linktree와 다른 AI 검색용 정체성 레이어를 만들 수 있다.

### Product Shape

- 정적 HTML 기반 AI 프로필 페이지
- `Person` + `CreativeWork` 또는 `ProfilePage` JSON-LD
- 고유 URL 발급
  - `aao.link/...`
  - 또는 커스텀 도메인 연결
- 한국어/영어 이중 언어
- 인스타그램/유튜브/틱톡 링크 기반 프로필 강화

### Why It Matters

- 플랫폼 프로필만으로는 AI 크롤러가 읽기 쉬운 구조화 데이터가 부족하다
- 인플루언서는 자기소개, 협업 문의, 전문 분야를 AI가 읽게 만들고 싶어한다
- 프리랜서/전문가/소상공인으로 확장 가능한 별도 시장이 존재한다

### Operating Risks

이 트랙은 바이럴보다 운영 리스크를 먼저 본다.

- 스팸/사칭 계정 생성 위험
- slug 선점 문제
- 신원 검증 부재 시 신뢰 붕괴
- 무료 플랜 남용으로 인한 moderation 비용 증가

### Preconditions Before Execution

메인 트랙보다 먼저 시작하지 않는다.
최소 아래 조건이 갖춰져야 검토할 수 있다.

- 메인 B2B용 AI 프로필 제작 서비스가 먼저 검증됨
- 프로필 생성/배포 파이프라인이 안정화됨
- slug 정책과 검증 정책이 정의됨
- abuse 대응 프로세스가 존재함

### Suggested GTM Order

- 1순위: 마이크로 인플루언서
- 2순위: 프리랜서/전문가
- 3순위: 소상공인

### Success Metric (Hypothesis-level)

- 첫 3개월 생성 수
  - 목표 `1,000개`
- 무료 -> 프로 전환율
  - 목표 `8~12%`
- 바이럴 계수
  - 목표 `1.5+`
- 첫 6개월 MRR
  - 목표 `500만 원`

### Note

이 트랙은 흥미롭지만, 현재 문서 기준에서는 메인 phase 흐름이 아니다.
`Phase 3.5`처럼 메인 로드맵에 넣기보다, 별도 확장 가설로 관리하는 편이 맞다.

---

## Priority Summary

### Immediate

- robots.txt ✅ Done
- llms.txt ✅ Done
- ChatGPT + Gemini + Perplexity citations ✅ Done
- mention position ✅ Done
- provenance separation ✅ Done
- strict_recall / live_search 모드 분리 ✅ Done
- 운영 안전장치(URL safety / safe preview / rate limit) ✅ Done

### Near-term

- SEO + AAO 투트랙 설치 원칙 문서화 및 가이드화
- Phase 1.5 request funnel + pilot baseline ✅ In Progress
- 실제 결제 / 상태 링크 연결
- 파일럿 납품 운영 플로우
- 첫 파일럿 케이스 실측 완료 (`50 -> 57`, source `fallback_diagnosis`)
- 공개 가능한 Before/After 케이스 확보
- Answer fact-check v3
- Source quality 산업별 refinement

### Mid-term

- live search simulation v1 완성
- AI 프로필 제작 서비스 반자동화
- citation intelligence
- LLM별 맞춤 권고
- crawl quality upgrade

### Expansion

- monitoring
- competitor benchmark
- automated reports
- time series
- Track B (인플루언서 AI 프로필 링크) 가설 검증

---

## Final Strategic Principle

AAO는 지금부터 아래 순서로 진화해야 한다.

1. `이 사이트를 AI가 읽을 수 있는가`
2. `이 브랜드를 AI가 정확히 인식하는가`
3. `실제 검색에서 공식 사이트를 인용하는가`
4. `시간이 지나며 경쟁사 대비 더 자주 선택되는가`

즉 지금의 다음 단계는
**페이지 진단 도구에서, LLM 검색 행동 시뮬레이터로 올라가는 것**이다.
