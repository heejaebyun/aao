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

## 지금 스크린샷 해석

- `51/100` 점수는 현재 `https://aao.co.kr` 메인 랜딩 페이지 진단 결과에 가깝다.
- `Gap 0`은 이번 실행에서 서브페이지가 메인보다 의미 있게 풍부하다고 잡히지 않았다는 뜻이다.
- Perplexity, Gemini는 아직 `AAO`를 다른 엔티티와 혼동하고 있다.
- ChatGPT `API 오류 (400)`는 `gpt-5-mini` 호출 시 `max_tokens`를 보내서 발생한 문제였다.

## 현재 제품 해석

- 기술적으로는 예전보다 더 잘 읽히는 상태다.
- 다만 `AAO`라는 브랜드 엔티티 자체는 아직 약하다.
- 메인 랜딩 페이지는 여전히 마케팅 카피 비중이 높아서 PACP/SEP가 낮게 나온다.
- `/ai-profile`는 앞으로 Before/After 실험용 기준 페이지로 써야 한다.

## 바로 다음 액션

1. ChatGPT AI 체크를 다시 테스트한다.
2. 아래 두 URL을 분리해서 다시 진단한다.
   - `https://aao.co.kr`
   - `https://aao.co.kr/ai-profile`
3. 아래 항목을 비교 기록한다.
   - 총점
   - PACP / SEP / SPF
   - 크롤링 원문
   - AI Reality Check 답변
4. 엔티티 표기를 일관되게 강화한다.
   - `AAO (AI Answer Optimization)`
   - `aao.co.kr`

## 현재 약점

- 진단 엔진이 구조화된 정적 페이지에도 아직 너무 박하게 점수를 준다.
- JSON-LD, FAQ, 연락처, 회사 개요 같은 기계적 신호는 이후 별도 가산점으로 반영할 필요가 있다.
- 현재 메인 랜딩 페이지는 아직 AI 1차 출처용 페이지처럼 동작하지 않는다.
