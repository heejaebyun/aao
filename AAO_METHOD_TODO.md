# AAO Methodology TODO

현재 코드에 이미 들어간 것:

- `Discovery / Accessibility / Entity / Answer / Source` 5레이어 요약
- robots.txt / llms.txt / citations / mention position
- 공개 URL 검증 / SSRF 방어 / safe preview 노출

아래 항목은 아직 구현되지 않았거나, 현재 버전이 부분적으로만 다루는 영역입니다.

## Next

- [x] Phase 2 Lite v1
  - `awareness / comparison / purchase` intent 고정
  - intent별 query template 2~3개
  - 결과를 intent별로 분리 노출

- [x] AI Check 비용 가드 v1
  - `strict_recall ChatGPT` 조건부 실행
  - in-memory cache
  - 전역 실행 한도 / skipped 처리

- [x] query metadata / decomposition v2
  - `intent: awareness|comparison|purchase`
  - `queryPlan` 저장
  - `brand / official / category / competitor / purchase` slot 설계

- [x] live search metadata v1
  - `searchQueriesUsed`
  - grounding summary
  - 공식 도메인 citation 비율 집계

- [ ] live search metadata v3
  - source quality archetype weight를 더 세밀한 도메인/산업군 규칙으로 고도화
  - citation type / authority heuristic 튜닝
  - 엔진별 grounding metadata 필드 차이를 정규화

- [x] `Discovery` 외부 신호 v2
  - sitemap.xml 포함 여부
  - canonical 정합성
  - indexability / noindex 신호

- [ ] `Discovery` 외부 신호 v3
  - Search Console 색인 상태
  - 색인 요청/제외 상태를 진단 요약에 연결

- [x] `Answer` fact-check v2
  - `wrong_entity / domain_mismatch / service_mismatch / aligned / weak` 판정
  - 공식 도메인/서비스 정의 일치 여부 기본 체크
  - Dashboard / Answer 게이트 반영

- [ ] `Answer` fact-check v3
  - 엔진별 정답셋 비교
  - 응답 내 공식 서비스 정의 일치 여부를 산업군별 규칙으로 고도화
  - fixture 세트 확장

- [ ] `Source` 레이어 고도화
  - 공식 사이트 vs 뉴스/블로그/커뮤니티 비중을 산업군별 규칙으로 더 정교하게 보정
  - high-authority vs low-authority 가중치 튜닝
  - 공식 사이트가 실제 1차 출처인지 더 엄격하게 판별

- [x] `Phase 1.5` request funnel v1
  - Dashboard CTA -> `/ai-profile/request`
  - `intake form`
  - `/api/intake` 초안 생성
  - Before/After 리포트 초안 + 메일/Markdown export

- [x] `Phase 1.5` ops v2 baseline
  - 업종별 템플릿 라이브러리
  - 설치 SOP / 호스팅별 가이드 세분화
  - env 기반 결제 / 상태 추적 / 후속 운영 채널 연결

- [x] `Phase 1.5` internal ops fallback
  - 내부 결제/킥오프/상태/상담 페이지
  - 외부 링크가 없어도 앱 내 운영 채널 동작

- [x] `Phase 1.5` pilot case detail
  - featured case 상세 페이지
  - 메인 / `/ai-profile` 재진단 진입점

- [x] `Phase 1.5` pilot ops v3 baseline
  - 파일럿 stage flow / checklist / SLA 정리
  - 공개 가능한 Before/After case-study draft 생성
  - request 화면에 pilot 운영 보드 노출

- [x] 첫 파일럿 케이스 실측
  - `AAO self-rollout`
  - 메인 랜딩 `54점`
  - `/ai-profile` `57점`
  - 실측 uplift `+3점`

- [ ] `Phase 1.5` pilot ops v4
  - 실제 결제 링크 / 상태 추적 링크 연결
  - 파일럿 운영 로그 또는 CRM 저장
  - 첫 파일럿 케이스 공개용 스크린샷 / proof 정리
  - 공개 가능한 Before/After 케이스 1~3건 확보

## Later

- [ ] 10-Gate 파이프라인으로 확장
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

- [ ] Mention Authority / Share of Answer 벤치마크 추가
  - 고정 프롬프트 세트
  - 경쟁사 비교
  - 엔진별 추세 추적

- [ ] Agentic Pipeline Impact / ROI 레이어 추가
  - AI 기여 파이프라인 가치
  - 리드 품질 변화
  - 세일즈 사이클 단축
  - 운영비 절감

## Integrity

- [ ] 진단 재현성을 위한 스냅샷 저장 및 테스트 세트 구축
- [x] Answer fact-check fixture regression
  - `npm run test:ai-check-fixtures`
  - `aligned / wrong_entity / domain_mismatch / service_mismatch / comparisonSafe / weak`
- [x] Source fixture regression
  - `npm run test:source-fixtures`
  - `software strong / local strong / creator strong / developer strong / official gap / off pattern`
- [ ] rate limit / citation / live search 결과에 대한 회귀 테스트 추가
