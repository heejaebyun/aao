# AAO 현재 상태 정리

## 완료된 것

- `aao.co.kr` 도메인 연결 및 Vercel 배포 완료
- `https://aao.co.kr/ai-profile` 공개 완료
- Google Search Console 도메인 인증 완료
- 색인 요청 완료
  - `https://aao.co.kr`
  - `https://aao.co.kr/ai-profile`
- 진단 구조 분리 완료
  - 메인 페이지 공식 점수
  - 서브페이지 보강 정보
  - Gap 분석
- 크롤링 구조 개선 완료
  - 직접 HTML fetch
  - light crawl
  - Jina fallback
- 앞단 신호 노출 완료
  - robots.txt LLM bot access
  - llms.txt 존재 여부
  - sitemap.xml 존재/포함 여부
  - canonical / meta robots / x-robots-tag 추출
  - indexability(`indexable / likely_indexable / noindex`) 판정
  - citations 표시
  - mention position 표시
- provenance separation 완료
  - `실측 / 복구 / 추정` 라벨
- AI Check 모드 분리 완료
  - `strict_recall`
  - `live_search`
- Phase 2 Lite v1 반영
  - `awareness / comparison / purchase`
  - intent별 결과 분리 노출
  - mode별 budget / skipped / unsupported 표시
- AI Check 비용 가드 반영
  - 전역 실행 한도
  - ChatGPT strict recall 조건부 실행
  - in-memory cache
- live search metadata v1 반영
  - `searchQueriesUsed`
  - grounding summary
  - 공식 도메인 citation 비율 집계
- query fan-out v2 반영
  - `queryPlan` 저장
  - `brand / official / category / competitor / purchase` slot 설계
  - Dashboard에서 설계 slot과 실제 search query를 나란히 노출
- live search interpretation v2 반영
  - engine별 `fan-out completeness` 계산
  - `official / mixed / third-party-only` source mix 해석
  - Dashboard에 fan-out / source mix 배지 및 summary 노출
- source interpretation v3 반영
  - citation별 `official / news / wiki / docs / directory / community / social / blog` 분류
  - citation별 권위도(`high / medium / low`) 해석
  - Dashboard에 citation type / authority badge 노출
- source quality v4 반영
  - entity archetype(`software_service / developer_tool / local_business / creator_media / general_business`) 추론
  - `strong / mixed / official_gap / off_pattern` source fit 판정
  - Dashboard에 source archetype / source fit 노출
- Gemini live search / grounding 반영
  - 기본 모델을 `gemini-3.1-flash-lite-preview`로 정리
  - `google_search` 기반 `searchQueriesUsed / grounding chunk / support` 집계
  - `vertexaisearch` redirect citation을 domain-level citation으로 정규화
- 운영 안전장치 반영
  - 공개 URL 검증 / SSRF 방어
  - 전체 본문 비노출, preview만 노출
  - endpoint별 rate limit namespace 분리
- Discovery 확장 반영
  - `sitemap.xml` 시그널 수집
  - canonical 정합성 반영
  - `noindex` / indexability를 Discovery 게이트 점수와 Raw Data 탭에 반영
- Answer fact-check v2 반영
  - `wrong_entity / domain_mismatch / service_mismatch / aligned / weak` 판정
  - 공식 도메인/서비스 정의 정합성 체크
  - Dashboard와 Answer 게이트에 fact-check badge/evidence 반영
- Answer fact-check v3 일부 반영
  - `comparison` intent에서 경쟁사/대안 언급을 문장 단위 앵커 기준으로 완화
  - 비교 문맥의 경쟁 도메인 언급과 실제 오인식을 덜 거칠게 구분
- Answer fixture regression 반영
  - `npm run test:ai-check-fixtures`
  - `aligned / wrong_entity / domain_mismatch / service_mismatch / comparisonSafe / weak` 6개 고정 fixture 통과
- Source fixture regression 반영
  - `npm run test:source-fixtures`
  - `software strong / local strong / creator strong / developer strong / official gap / off pattern` 6개 고정 fixture 통과
- Phase 1.5 request funnel v1 반영
  - Dashboard CTA가 실제 제작 요청 페이지로 연결
  - `/ai-profile/request` intake 페이지 추가
  - `/api/intake` 초안 생성 API 추가
  - Before/After 리포트 초안 + 메일 본문/Markdown 다운로드 생성
- Phase 1.5 ops v2 baseline 반영
  - 업종별 템플릿 라이브러리 내장
  - 호스팅별 설치 SOP 미리보기 및 초안 포함
  - `NEXT_PUBLIC_*` 기반 결제 / 킥오프 / 상태추적 / 상담 채널 연결
- Phase 1.5 pilot ops v3 baseline 반영
  - 납품 stage flow / checklist / SLA 생성
  - 공개 가능한 Before/After 케이스 초안 생성
  - request 화면에서 pilot 운영 보드와 case-study draft 노출
- 첫 파일럿 케이스 실측 반영
  - `AAO self-rollout` 케이스 추가
  - 메인 랜딩 `50점`
  - `/ai-profile` `57점`
  - 실측 uplift `+7점`
  - 측정 source `live /api/diagnose snapshot · fallback_diagnosis`
- 내부 운영 채널 fallback 반영
  - `/ai-profile/ops/payment`
  - `/ai-profile/ops/kickoff`
  - `/ai-profile/ops/status`
  - `/ai-profile/ops/chat`
- 파일럿 케이스 상세 페이지 반영
  - `/ai-profile/cases/aao-self-rollout`
  - 메인 재진단 / `/ai-profile` 재진단 진입점 포함
- AAO 공식 출처 신호 정렬 반영
  - 메인 랜딩 canonical `/`
  - `/ai-profile` canonical `/ai-profile`
  - `robots.txt`, `sitemap.xml`, `llms.txt` route 추가
  - 메인 footer와 CTA에 `/ai-profile` 링크 노출
  - `AAO (AI Answer Optimization)` 표기 기준 정렬

## 지금 실측 해석

- 2026-03-07 실측 기준 `https://aao.co.kr` 메인 랜딩은 `50/100`, `https://aao.co.kr/ai-profile`는 `57/100`이다.
- `Gap 0`은 이번 실행에서 서브페이지가 메인보다 의미 있게 풍부하다고 잡히지 않았다는 뜻이다.
- Perplexity, Gemini는 아직 `AAO`를 다른 엔티티와 혼동하고 있다.
- ChatGPT 호출 스펙 오류는 수정되었고, 이제 핵심 이슈는 엔티티 강도와 공식 출처성이다.

## 현재 제품 해석

- 기술적으로는 예전보다 더 잘 읽히는 상태다.
- 다만 `AAO`라는 브랜드 엔티티 자체는 아직 약하다.
- 메인 랜딩 페이지는 여전히 마케팅 카피 비중이 높아서 PACP/SEP가 낮게 나온다.
- `/ai-profile`는 앞으로 Before/After 실험용 기준 페이지로 써야 한다.
- 측정 결과에서 제작 요청으로 넘어가는 첫 상업화 퍼널은 이제 앱 안에서 바로 열 수 있다.
- 첫 파일럿 케이스도 앱 안에 고정되어 있고, `50 -> 57` 실측값까지 공개용으로 바로 보여줄 수 있다.

## 바로 다음 액션

1. 방금 넣은 공식 출처 신호를 배포하고 재측정한다.
   - `https://aao.co.kr`
   - `https://aao.co.kr/ai-profile`
   - canonical / robots / sitemap / llms 반영 확인
2. 첫 파일럿 케이스 공개 패키지를 완성한다.
  - 공개용 스크린샷 확보
  - `50 -> 57` 실측 케이스 문구 정리
  - 재측정 후 delta 업데이트
3. Phase 1.5를 실제 파일럿 운영으로 전환한다.
  - 업종별 실제 납품 템플릿 3~5개 정제
  - 결제/상태 채널 실제 URL 연결
  - 공개 가능한 Before/After 케이스 1~3건 확보
  - 파일럿 고객 기준 stage별 운영 로그 축적
4. Answer fact-check를 더 고도화한다.
  - 엔진별 정답셋 비교
  - 산업군별 서비스 정의 힌트 정교화
  - fixture 세트 확장
5. Source 품질 규칙을 더 세밀하게 만든다.
  - 도메인/산업군별 authority weight refinement
  - fixture 세트 확장

## 현재 약점

- 진단 엔진이 구조화된 정적 페이지에도 아직 너무 박하게 점수를 준다.
- JSON-LD, FAQ, 연락처, 회사 개요 같은 기계적 신호는 이후 별도 가산점으로 반영할 필요가 있다.
- 현재 메인 랜딩 페이지는 아직 AI 1차 출처용 페이지처럼 동작하지 않는다.
- intent-aware query set, slot 기반 fan-out, grounding support, source archetype/source fit까지 들어갔지만, source quality 규칙은 아직 거칠고 산업별 커스터마이징 폭이 좁다.
- Phase 1.5는 제품 안에서 초안 생성까지 되지만, 실제 결제 링크/상태 링크는 env를 채워야 완성된다.
- 외부 링크가 없어도 앱 내부 fallback 채널은 동작하지만, 실제 결제/일정/상태 채널로는 아직 이어지지 않는다.
- Phase 1.5는 pilot 보드와 case-study draft까지 생성하지만, 아직 실제 CRM 저장이나 실고객 이력 축적은 없다.
- 첫 파일럿 케이스는 `50 -> 57` 실측이 들어갔지만, 진단 provenance는 아직 `fallback_diagnosis`라서 더 강한 공식 출처 신호 보강이 필요하다.
- Discovery는 `sitemap / canonical / indexability`까지 보지만 Search Console의 실제 색인 상태는 아직 모른다.
- Answer 레이어는 comparison intent 오탐을 줄였고 고정 fixture도 생겼지만, 엔진별 정답셋 기반 fact-check와 산업군별 서비스 정의 규칙은 아직 없다.
- AI Check는 기본 예산과 cache가 생겼지만, 트래픽 증가 시 샘플링 정책과 Redis 계열 캐시가 필요하다.
