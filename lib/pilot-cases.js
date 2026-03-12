const DEFAULT_CASE_UPDATED_AT = "2026-03-12";

function buildEngineResult(engine, delivered, total, citation) {
  return {
    engine,
    delivered,
    total,
    citation,
  };
}

export const FEATURED_PILOT_CASES = [
  {
    id: "aao-self-rollout",
    companyName: "AAO",
    domain: "aao.co.kr",
    industry: "AI Answer Optimization / B2B SaaS",
    installPath: "/ai-profile",
    rootUrl: "https://aao.co.kr",
    profileUrl: "https://aao.co.kr/ai-profile",
    status: "internal_validation",
    statusLabel: "AAO 자체 사이트 내부 파일럿",
    updatedAt: DEFAULT_CASE_UPDATED_AT,
    headline:
      "메인 랜딩만 있을 때는 AI가 선언된 사실을 일부만 가져왔고, `/ai-profile` 정적 허브를 추가한 뒤 구조 검증과 전달 확인이 모두 개선됐습니다.",
    summary:
      "AAO는 자체 도메인을 첫 before/after 케이스로 사용하고 있습니다. 메인 랜딩과 `/ai-profile`를 각각 진단해, 어떤 구조를 추가했을 때 선언된 사실이 실제 AI 답변으로 더 잘 전달되는지 반복 검증합니다.",
    beforeState: {
      label: "메인 랜딩",
      url: "https://aao.co.kr",
      summary:
        "브랜드 소개 중심 랜딩이라 선언된 사실 수가 적고, 공식 facts 허브 구조가 없습니다. AI는 회사명 외 핵심 설명을 자주 놓칩니다.",
      lint: { passed: 2, total: 5 },
      groundTruth: { fieldCount: 2, faqPairs: 0 },
      engines: [
        buildEngineResult("chatgpt", 1, 2, "exact"),
        buildEngineResult("gemini", 1, 2, "none"),
        buildEngineResult("perplexity", 1, 2, "none"),
      ],
      blockers: [
        "첫 문장 엔티티 정의가 약합니다.",
        "JSON-LD에만 선언된 설명은 엔진들이 자주 놓칩니다.",
        "서브페이지 허브 구조와 요약 링크가 없습니다.",
      ],
    },
    afterState: {
      label: "공식 AI Profile",
      url: "https://aao.co.kr/ai-profile",
      summary:
        "정적 HTML facts block, JSON-LD, FAQ, 주요 페이지 허브를 한 곳에 모아 AI가 읽는 공식 소스 역할을 하도록 만든 상태입니다.",
      lint: { passed: 4, total: 6 },
      groundTruth: { fieldCount: 6, faqPairs: 5 },
      engines: [
        buildEngineResult("chatgpt", 4, 6, "exact"),
        buildEngineResult("gemini", 3, 6, "none"),
        buildEngineResult("perplexity", 2, 6, "path"),
      ],
      blockers: [
        "Perplexity는 여전히 일부 필드를 JSON-LD only miss로 남깁니다.",
        "Gemini는 공식 URL citation이 약해 evidence가 보수적으로 남습니다.",
      ],
    },
    appliedFixes: [
      "첫 문장을 `AAO는 AI Answer Optimization 서비스이다` 형식으로 단순화",
      "서비스명·설립연도·대표자·업종을 정적 facts block으로 상단 배치",
      "Organization + SoftwareApplication + FAQPage JSON-LD를 중복 선언",
      "주요 페이지 링크에 설명 텍스트를 붙여 허브 구조 구성",
      "FAQ를 한영 병기로 추가해 인용 가능한 짧은 답변 문장을 확보",
    ],
    observedChanges: [
      "구조 검증 통과 항목이 메인 랜딩 대비 늘어났습니다.",
      "AI가 읽는 공식 사실 수가 2개에서 6개로 확장됐습니다.",
      "ChatGPT는 메인 랜딩 1/2에서 AI Profile 4/6까지 전달 범위가 넓어졌습니다.",
      "Perplexity와 Gemini도 동일 도메인 안에서 더 많은 필드를 읽지만, JSON-LD only 필드는 여전히 놓치는 경우가 있습니다.",
    ],
    proofPoints: [
      {
        label: "Before",
        value: "메인 랜딩은 lint 2/5, declared facts 2개, 엔진별 전달 1/2 수준",
      },
      {
        label: "After",
        value: "공식 AI Profile은 lint 4/6, declared facts 6개 + FAQ 5쌍, 엔진별 전달 4/6 · 3/6 · 2/6",
      },
      {
        label: "What Changed",
        value: "facts block, FAQ, JSON-LD, 주요 페이지 허브, 더 직접적인 엔티티 정의",
      },
      {
        label: "How To Verify",
        value: "`/diagnose?url=https://aao.co.kr`와 `/diagnose?url=https://aao.co.kr/ai-profile`를 각각 다시 실행",
      },
    ],
    nextSteps: [
      "메인 랜딩에 facts block 또는 요약 facts 링크를 더 직접적으로 노출",
      "Perplexity와 Gemini가 놓치는 JSON-LD only 필드를 평문 설명에도 중복 노출",
      "실제 고객 도메인으로 동일 구조를 이식해 외부 before/after 케이스 확보",
    ],
  },
];

export function getFeaturedPilotCase(caseId = "aao-self-rollout") {
  return FEATURED_PILOT_CASES.find((item) => item.id === caseId) || FEATURED_PILOT_CASES[0];
}

export function getPilotCaseById(caseId) {
  return FEATURED_PILOT_CASES.find((item) => item.id === caseId) || null;
}

export function buildPilotCaseHref(caseId) {
  return `/ai-profile/cases/${caseId}`;
}

export function getPilotCaseLift() {
  return null;
}
