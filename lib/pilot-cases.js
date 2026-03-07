import { AI_PROFILE_META_TITLE, ENTITY_LABEL } from "@/lib/site-identity";

const AAO_SELF_ROLLOUT_MEASUREMENTS = {
  before: {
    id: "main-landing",
    label: "메인 랜딩",
    url: "https://aao.co.kr",
    title: ENTITY_LABEL,
    measuredAt: "2026-03-08",
    score: 54,
    grade: "C",
    source: "fallback_diagnosis",
    expectedScoreAfter: 74,
    axes: {
      pacp: 12,
      sep: 19,
      spf: 23,
    },
    crawl: {
      wordCount: 167,
      hasJsonLd: true,
      hasOpenGraph: true,
      robotsMeta: "",
      indexability: "likely_indexable",
    },
  },
  after: {
    id: "ai-profile",
    label: "/ai-profile",
    url: "https://aao.co.kr/ai-profile",
    title: AI_PROFILE_META_TITLE,
    measuredAt: "2026-03-08",
    score: 57,
    grade: "C",
    source: "fallback_diagnosis",
    expectedScoreAfter: 77,
    axes: {
      pacp: 15,
      sep: 20,
      spf: 22,
    },
    crawl: {
      wordCount: 1135,
      hasJsonLd: true,
      hasOpenGraph: true,
      robotsMeta: "index, follow",
      indexability: "indexable",
    },
  },
};

const AAO_SELF_ROLLOUT_LIFT =
  AAO_SELF_ROLLOUT_MEASUREMENTS.after.score - AAO_SELF_ROLLOUT_MEASUREMENTS.before.score;

export const FEATURED_PILOT_CASES = [
  {
    id: "aao-self-rollout",
    companyName: "AAO",
    domain: "aao.co.kr",
    industry: "AI Answer Optimization / B2B SaaS",
    installPath: "/ai-profile",
    status: "measured",
    statusLabel: "실측 완료",
    baselineSource: AAO_SELF_ROLLOUT_MEASUREMENTS.before.source,
    baselineMeasuredAt: AAO_SELF_ROLLOUT_MEASUREMENTS.before.measuredAt,
    measurementSource: "live_api_diagnose_snapshot",
    measurementMeasuredAt: AAO_SELF_ROLLOUT_MEASUREMENTS.after.measuredAt,
    beforeScore: AAO_SELF_ROLLOUT_MEASUREMENTS.before.score,
    afterScore: AAO_SELF_ROLLOUT_MEASUREMENTS.after.score,
    actualLift: AAO_SELF_ROLLOUT_LIFT,
    targetScore: 91,
    expectedLift: 40,
    rootUrl: "https://aao.co.kr",
    profileUrl: "https://aao.co.kr/ai-profile",
    headline: "메인 랜딩 54점, /ai-profile 57점으로 실측됐고 구조화된 정적 페이지가 현재 +3점 개선을 만들고 있습니다.",
    summary:
      "AAO 자체 사이트를 첫 파일럿 케이스로 사용합니다. 2026년 3월 8일 실측 기준 메인 랜딩은 54점, /ai-profile은 57점으로 확인됐습니다. 기술 신호 보강으로 메인이 올라왔고, 이제 남은 병목은 /ai-profile의 인용 가능한 정의 문장과 신뢰 근거를 더 강하게 만드는 일입니다.",
    problemPoints: [
      "AAO 브랜드 엔티티가 아직 약하고 다른 의미와 충돌합니다.",
      "메인 랜딩 페이지는 제품 정의보다 카피 비중이 높아 PACP가 12점 수준에 머뭅니다.",
      "/ai-profile는 분명히 개선됐지만 여전히 fallback 진단 소스라, 더 강한 공식 출처 신호가 필요합니다.",
    ],
    interventions: [
      "/ai-profile 정적 페이지 공개",
      "Schema.org JSON-LD + FAQ + 한영 설명 구조 추가",
      "투트랙 구조: 메인 사이트 유지 + AI profile 별도 운영",
      "AI Check / Discovery / Source 레이어 개선",
    ],
    nextMilestones: [
      "canonical self-link와 공식 출처 신호 보강",
      "공개용 Before/After 스크린샷 확보",
      "실제 결제/상태 링크 연결 후 파일럿 운영 로그 축적",
    ],
    evidence: [
      {
        label: "Measured Before",
        value: "메인 랜딩 54점/100 (2026-03-08)",
      },
      {
        label: "Measured After",
        value: "/ai-profile 57점/100 (2026-03-08)",
      },
      {
        label: "Measured Lift",
        value: "+3점",
      },
      {
        label: "Diagnosis Source",
        value: "live /api/diagnose snapshot · fallback_diagnosis",
      },
      {
        label: "Install Path",
        value: "https://aao.co.kr/ai-profile",
      },
    ],
    measurements: AAO_SELF_ROLLOUT_MEASUREMENTS,
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

export function getPilotCaseLift(pilotCase) {
  if (!pilotCase) return null;
  if (typeof pilotCase.actualLift === "number") return pilotCase.actualLift;
  if (typeof pilotCase.beforeScore !== "number" || typeof pilotCase.afterScore !== "number") return null;
  return pilotCase.afterScore - pilotCase.beforeScore;
}
