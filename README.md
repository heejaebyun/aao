# AAO — AI Answer Optimization MVP

> AI가 당신의 회사를 정확히 설명할 수 있는지 진단하고 최적화하는 서비스  
> Princeton GEO Research (KDD 2024) 기반 3축 진단: PACP · SEP · SPF

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
| `OPENAI_API_KEY` | 진단 엔진 + ChatGPT 답변 확인 | https://platform.openai.com |
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
│       │   └── route.js   # POST /api/diagnose — 크롤링 + 진단
│       └── ai-check/
│           └── route.js   # POST /api/ai-check — 3개 AI 엔진 질의
├── lib/
│   ├── jina.js            # Jina AI Reader 크롤링
│   ├── diagnose.js        # OpenAI 진단 엔진 (GEO 기반 프롬프트)
│   ├── ai-check.js        # 3개 AI 엔진 동시 질의
│   └── rate-limit.js      # 인메모리 IP 레이트리밋
├── components/
│   └── Dashboard.js       # 메인 대시보드 UI
├── .env.example           # API 키 템플릿
├── package.json
└── README.md
```

## 🔬 진단 체계 (3-Axis Scoring)

| 축 | 만점 | 기반 연구 |
|----|------|-----------|
| **PACP** (위치 기반 인용 확률) | 40점 | Princeton GEO PAWC, Citation Frequency |
| **SEP** (의미론적 엔티티 정밀도) | 30점 | Semantic F1, NER, Knowledge Graph |
| **SPF** (구조적 파싱 충실도) | 30점 | Token Efficiency, WebArena, Chunking |

## 🔗 API 엔드포인트

### POST /api/diagnose
```json
{ "url": "https://example.com" }
```
→ 크롤링 + PACP/SEP/SPF 점수 + 개선 리포트

### POST /api/ai-check
```json
{ "companyName": "회사이름" }
```
→ 3개 AI 엔진 답변 + 인식 여부 + 정확도

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
