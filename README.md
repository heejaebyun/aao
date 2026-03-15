# AAO — AI Answer Optimization MVP

> AI가 당신의 회사를 정확히 설명할 수 있는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만드는 서비스

## 🚀 Quick Start

### 1. 설치
```bash
cd aao-mvp
npm install
```

### 2. API 키 설정
```bash
cp .env.example .env.local
```
`.env.local` 파일을 열고 API 키를 입력하세요:

| API | 용도 | 발급처 |
|-----|------|--------|
| `JINA_API_KEY` | URL 크롤링 | https://jina.ai (무료 키 발급) |
| `OPENAI_API_KEY` | ChatGPT 전달 확인 | https://platform.openai.com |
| `GEMINI_API_KEY` | Gemini 답변 확인 | https://aistudio.google.com |
| `PERPLEXITY_API_KEY` | Perplexity 답변 확인 | https://www.perplexity.ai/settings/api |

### 3. 실행
```bash
npm run dev
```
http://localhost:3000 에서 확인

### 4. Vercel 배포
```bash
# GitHub에 push 후 Vercel에서 import
# Environment Variables에 API 키 설정
npm run build
```

## 📁 프로젝트 구조

```
aao-mvp/
├── app/
│   ├── layout.js          # 루트 레이아웃 (Schema.org JSON-LD 포함)
│   ├── page.js            # 메인 페이지
│   └── api/
│       ├── diagnose/
│       │   └── route.js   # POST /api/diagnose — 크롤링 + 린트 + ground truth
│       └── ai-check/
│           └── route.js   # POST /api/ai-check — 3개 AI 엔진 전달 확인
├── lib/
│   ├── jina.js            # Jina AI Reader 크롤링
│   ├── aao-lint.js        # 구조 검증 (lint)
│   ├── ai-check.js        # 3개 AI 엔진 동시 질의
│   └── rate-limit.js      # 인메모리 IP 레이트리밋
├── components/
│   └── Dashboard.js       # 메인 대시보드 UI
├── .env.example           # API 키 템플릿
├── package.json
└── README.md
```

## 🔬 진단 체계

AAO는 점수판보다 `구조 검증(lint)`과 `실제 AI 전달 확인(delivery check)`을 중심으로 동작합니다.

- `lint report`: 첫 문장 정의, facts source, 정적 렌더링, 허브 구조 등 핵심 구조 오류 확인
- `delivery check`: ChatGPT, Gemini, Perplexity가 선언된 사실을 실제로 끌고 오는지 확인
- `blockage review`: 못 읽은 이유와 수정 방법을 리포트로 정리

## 🔗 API 엔드포인트

### POST /api/diagnose
```json
{ "url": "https://example.com" }
```
→ 크롤링 + lint report + declared facts 추출

### POST /api/ai-check
```json
{ "url": "https://example.com", "crawlSnapshot": { "...": "..." } }
```
→ 3개 AI 엔진 전달 확인 + missed field 원인 + 서브페이지 도달 결과

현재 지원 엔진:
- ChatGPT (OpenAI)
- Perplexity
- Gemini (Google)

Claude, 네이버 큐는 향후 추가 예정

## 📊 핵심 학술 근거

- 통계 데이터 추가 → AI 가시성 **+30~41%** (Princeton GEO)
- 키워드 스터핑 → AI 가시성 **-9%** (Princeton GEO)
- CSR 사이트 AI 추출 성공률 **10~16%** (WebArena)
- 마크다운 변환 시 토큰 **80~95% 절감** (Token Efficiency)
- 구조화 청킹 시 검색 정확도 **+40~60%** (Pinecone)
- 지식 그래프 연동 시 환각 **-40%** (MEGA-RAG)

## 🧪 Wikipedia Benchmark Pilot (100 pages / batch 10)

위키피디아 기업 페이지 100개 파일럿 파이프라인이 포함되어 있습니다. 기본 흐름은 `수집 -> 크롤링 -> 3엔진 추출 -> 분석 -> 수정 대상 선정 -> Step A~D 수정 실험`이고, 각 단계는 중간 저장 및 resume를 지원합니다.

생성 결과물은 `artifacts/wiki-benchmark/pilot-100` 아래에 저장됩니다.

### 실행 순서
```bash
npm run wiki:collect
npm run wiki:crawl
npm run wiki:extract:gpt
npm run wiki:extract:gemini
npm run wiki:extract:perplexity
npm run wiki:analyze
npm run wiki:blockage-catalog
npm run wiki:select-mods
npm run wiki:modify
```

한 번에 돌리려면:
```bash
npm run wiki:pilot
```

### 주요 출력 파일

- `urls_100.json` — 수집된 URL 100개
- `crawl_results_100.json` — HTML/텍스트/인포박스/링크/구조 특성
- `extraction_results_gpt.json`
- `extraction_results_gemini.json`
- `extraction_results_perplexity.json`
- `classification_results.json` — A/B/C 그룹 분류
- `feature_impact_ranking.json` — 구조 특성 상관도 순위
- `engine_consistency.json` — 엔진 간 일관성
- `field_difficulty.json` — 필드별 추출 난이도
- `blockage_catalog_v1.json` — 엔진별 막힘 카탈로그 초안
- `blockage_catalog_summary.json` — 엔진별 상위 막힘 요약
- `modification_targets_30.json` — 수정 실험 대상 30개
- `modification_results.json` — Step A~D 단계별 추출 결과
- `step_effectiveness.json` — 단계별 평균 개선 폭
- `page_progression.json` — 페이지별 단계별 변화
- `calibration_data.json` — 가중치 교정용 기초 데이터

### 참고

- 현재 파일럿은 100개 고정, 배치 크기 10 기준입니다.
- 위키피디아 API는 초당 1회로 제한합니다.
- 추출 단계는 엔진별 순차 실행입니다.
- `wiki:modify -- --dryRun`으로 텍스트 변형만 먼저 확인할 수 있습니다.
