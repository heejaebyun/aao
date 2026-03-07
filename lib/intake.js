import { SITE_ORIGIN } from "@/lib/site-identity";

const DEFAULT_TARGET_LIFT = 40;

export const AAO_CONTACT_EMAIL = "bhj31029943@gmail.com";
export const PROFILE_REQUEST_SNAPSHOT_KEY = "aao_profile_request_snapshot_v1";
export const AUTO_TEMPLATE_ID = "auto";

export const AI_PROFILE_PLANS = [
  {
    id: "basic",
    label: "기본",
    priceLabel: "33만 원 / 1회",
    turnaroundLabel: "3영업일",
    targetLift: 40,
    description: "AI 프로필 페이지 1개와 설치 가이드, Before/After 리포트를 제공합니다.",
    deliverables: [
      "AI 프로필 페이지 HTML 1개",
      "Schema.org JSON-LD 3종 이상",
      "한영 FAQ 5~10개",
      "설치 가이드 문서",
      "Before/After 리포트 초안",
    ],
  },
  {
    id: "pro",
    label: "프로",
    priceLabel: "월 5.5만 원",
    turnaroundLabel: "초기 3영업일 + 분기 업데이트",
    targetLift: 50,
    description: "기본 구성에 분기별 업데이트와 AI Reality Check 모니터링을 더합니다.",
    deliverables: [
      "기본 플랜 전 항목",
      "분기별 콘텐츠 업데이트",
      "월간 AI Reality Check 요약",
      "설치 후 점수 추적 메모",
    ],
  },
  {
    id: "business",
    label: "비즈니스",
    priceLabel: "월 16.5만 원",
    turnaroundLabel: "초기 5영업일 + 월간 관리",
    targetLift: 60,
    description: "다국어 확장, 경쟁사 비교, 커스텀 FAQ까지 포함한 운영형 플랜입니다.",
    deliverables: [
      "프로 플랜 전 항목",
      "3개 언어 확장",
      "커스텀 FAQ 20개",
      "경쟁사 비교 메모",
      "월간 운영 피드백",
    ],
  },
];

export const HOSTING_OPTIONS = [
  { id: "ftp", label: "FTP / 카페24" },
  { id: "vercel", label: "Vercel" },
  { id: "netlify", label: "Netlify" },
  { id: "other", label: "기타 / 잘 모름" },
];

export const INSTALL_SUPPORT_OPTIONS = [
  { id: "guided", label: "가이드만 받기" },
  { id: "managed", label: "대행 설치 요청" },
];

export const INDUSTRY_TEMPLATE_LIBRARY = [
  {
    id: "b2b-saas",
    label: "B2B SaaS",
    summary: "제품 정의, 핵심 기능, 도입 효과, 보안/가격 FAQ를 중심으로 AI가 제품을 한 문장으로 설명하게 만드는 템플릿입니다.",
    targetLift: 45,
    schemaTypes: ["Organization", "SoftwareApplication", "FAQPage"],
    sections: ["한 줄 제품 정의", "대상 고객과 문제", "핵심 기능 3~5개", "도입 효과 수치", "보안/가격 FAQ"],
    requiredAssets: ["서비스 소개서", "가격/플랜 정보", "고객 사례", "보안/정책 링크"],
    sourceTargets: ["공식 사이트", "문서/가이드", "G2/Capterra 같은 디렉터리"],
  },
  {
    id: "developer-tool",
    label: "개발자 도구",
    summary: "개발자가 무엇을 어떻게 쓰는지, 설치 방법과 문서 링크를 분명하게 정리하는 템플릿입니다.",
    targetLift: 48,
    schemaTypes: ["Organization", "SoftwareApplication", "FAQPage"],
    sections: ["한 줄 도구 설명", "지원 언어/프레임워크", "설치/온보딩", "문서/레퍼런스", "가격/라이선스 FAQ"],
    requiredAssets: ["Quickstart", "문서 링크", "GitHub/레퍼런스", "가격/라이선스 안내"],
    sourceTargets: ["공식 사이트", "문서", "GitHub/개발자 레퍼런스"],
  },
  {
    id: "local-business",
    label: "로컬 비즈니스",
    summary: "위치, 운영시간, 예약/문의 경로, 실제 서비스 범위를 AI가 빠르게 읽을 수 있게 정리하는 템플릿입니다.",
    targetLift: 40,
    schemaTypes: ["Organization", "LocalBusiness", "FAQPage"],
    sections: ["업체 소개", "위치/운영시간", "대표 서비스", "예약/문의", "방문 FAQ"],
    requiredAssets: ["주소/운영시간", "대표 이미지", "예약 링크", "대표 메뉴/서비스"],
    sourceTargets: ["공식 사이트", "지도/디렉터리", "리뷰/지역 플랫폼"],
  },
  {
    id: "professional-service",
    label: "전문 서비스",
    summary: "컨설팅, 에이전시, 병원, 법률/세무 같은 전문직의 전문 분야와 신뢰 근거를 정리하는 템플릿입니다.",
    targetLift: 42,
    schemaTypes: ["Organization", "ProfessionalService", "FAQPage"],
    sections: ["전문 분야 정의", "대표 서비스 패키지", "대상 고객", "사례/성과", "상담 프로세스 FAQ"],
    requiredAssets: ["회사소개서", "대표 사례", "자격/인증", "상담 절차 자료"],
    sourceTargets: ["공식 사이트", "자격/협회 정보", "사례 콘텐츠"],
  },
  {
    id: "commerce-brand",
    label: "커머스 / 브랜드",
    summary: "브랜드 소개, 주력 카테고리, 구매/배송/교환 정책을 구조화해서 AI가 구매 문맥에서 답하게 만드는 템플릿입니다.",
    targetLift: 43,
    schemaTypes: ["Organization", "Product", "FAQPage"],
    sections: ["브랜드 한 줄 소개", "주력 상품군", "차별점/원산지/소재", "구매/배송 정책", "교환/환불 FAQ"],
    requiredAssets: ["브랜드 소개", "대표 상품 링크", "배송/환불 정책", "고객 후기/UGC"],
    sourceTargets: ["공식 사이트", "상품 페이지", "마켓/리뷰 플랫폼"],
  },
  {
    id: "creator-education",
    label: "크리에이터 / 교육",
    summary: "강의, 콘텐츠, 전문 분야, 협업 문의를 AI가 명확히 인식하도록 만드는 템플릿입니다.",
    targetLift: 38,
    schemaTypes: ["Person", "ProfilePage", "FAQPage"],
    sections: ["한 줄 소개", "전문 분야/카테고리", "대표 콘텐츠/이력", "협업 문의", "FAQ"],
    requiredAssets: ["프로필 소개", "대표 콘텐츠 링크", "강의/협업 이력", "문의 링크"],
    sourceTargets: ["공식 사이트", "프로필 페이지", "콘텐츠 플랫폼"],
  },
  {
    id: "general-business",
    label: "일반 기업",
    summary: "회사 소개, 핵심 서비스, 대표 고객, 문의 경로를 균형 있게 정리하는 범용 템플릿입니다.",
    targetLift: 40,
    schemaTypes: ["Organization", "Service", "FAQPage"],
    sections: ["회사 한 줄 소개", "핵심 서비스", "고객/산업", "대표 근거", "문의 FAQ"],
    requiredAssets: ["회사 소개", "서비스 설명", "대표 사례", "문의 경로"],
    sourceTargets: ["공식 사이트", "보도자료", "디렉터리/위키"],
  },
];

export const INSTALLATION_SOPS = {
  ftp: {
    id: "ftp",
    label: "FTP / 카페24",
    summary: "기존 호스팅 파일 구조에 `/ai-profile/index.html`을 업로드하는 방식입니다.",
    steps: [
      "호스팅 파일 매니저 또는 FTP에 접속합니다.",
      "`/ai-profile` 폴더를 만들고 `index.html`을 업로드합니다.",
      "기존 rewrite 규칙이 `/ai-profile`을 다른 페이지로 보내지 않는지 확인합니다.",
      "footer 링크와 sitemap.xml에 `/ai-profile`을 추가합니다.",
    ],
    verification: [
      "`https://도메인/ai-profile`이 200 응답인지 확인",
      "canonical이 self-canonical인지 확인",
      "robots / llms / sitemap에 차단 신호가 없는지 확인",
    ],
    rollback: "업로드한 `/ai-profile` 폴더를 삭제하면 즉시 원복할 수 있습니다.",
  },
  vercel: {
    id: "vercel",
    label: "Vercel",
    summary: "`public/ai-profile/index.html` 또는 정적 route로 배포하는 방식입니다.",
    steps: [
      "프로젝트의 `public/ai-profile/index.html` 경로에 파일을 추가합니다.",
      "배포 후 `/ai-profile` 경로가 정적 HTML을 직접 반환하는지 확인합니다.",
      "필요하면 메인 네비게이션 대신 footer 또는 소개 페이지에 링크를 추가합니다.",
      "sitemap과 canonical을 점검한 뒤 다시 진단합니다.",
    ],
    verification: [
      "배포된 `/ai-profile`가 JS 없이도 본문을 보여주는지 확인",
      "Preview가 아닌 Production URL에서 200 응답 확인",
      "Search Console 인덱싱 요청 가능 상태 확인",
    ],
    rollback: "`public/ai-profile` 파일을 제거하고 재배포하면 원복됩니다.",
  },
  netlify: {
    id: "netlify",
    label: "Netlify",
    summary: "정적 publish 디렉터리에 `/ai-profile/index.html`을 포함하는 방식입니다.",
    steps: [
      "publish 디렉터리에 `/ai-profile/index.html`을 추가합니다.",
      "Netlify redirect 규칙이 `/ai-profile` 정적 파일을 덮지 않는지 확인합니다.",
      "배포 후 canonical, sitemap, footer 링크를 업데이트합니다.",
      "설치 후 같은 URL로 진단을 다시 실행합니다.",
    ],
    verification: [
      "`/ai-profile` 직접 접속 시 정적 본문 확인",
      "redirect 또는 SPA fallback이 끼지 않는지 확인",
      "robots / sitemap에 새 경로가 반영됐는지 확인",
    ],
    rollback: "정적 파일 제거 후 재배포하면 됩니다.",
  },
  other: {
    id: "other",
    label: "기타 / 잘 모름",
    summary: "호스팅 구조를 먼저 파악한 뒤 가장 단순한 정적 파일 경로에 배포하는 방식입니다.",
    steps: [
      "현재 호스팅 구조와 배포 권한을 먼저 파악합니다.",
      "정적 HTML 파일을 올릴 수 있는 경로를 확인합니다.",
      "`/ai-profile` 경로를 만들고 canonical / robots / sitemap을 점검합니다.",
      "설치 후 다시 진단해서 Before/After를 비교합니다.",
    ],
    verification: [
      "`/ai-profile` 직접 접속 가능 여부 확인",
      "정적 HTML 본문이 바로 보이는지 확인",
      "footer 링크 / sitemap / canonical 반영 확인",
    ],
    rollback: "추가한 파일과 링크만 제거하면 됩니다.",
  },
};

export const PILOT_STAGE_FLOW = [
  {
    id: "received",
    label: "접수 완료",
    owner: "AAO",
    description: "문의 접수와 기본 채널 확인",
  },
  {
    id: "scoped",
    label: "범위 확정",
    owner: "AAO + 고객",
    description: "플랜, 템플릿, 설치 범위, 납기 확정",
  },
  {
    id: "assets",
    label: "자료 수집",
    owner: "고객",
    description: "회사 소개 자료, 링크, 정책, FAQ 수집",
  },
  {
    id: "draft",
    label: "초안 전달",
    owner: "AAO",
    description: "AI 프로필 1차안과 설치 메모 전달",
  },
  {
    id: "review",
    label: "사실 검수",
    owner: "고객",
    description: "팩트, 표현, 링크, 문의 경로 확인",
  },
  {
    id: "install",
    label: "설치 완료",
    owner: "AAO / 고객",
    description: "도메인 `/ai-profile` 반영",
  },
  {
    id: "remeasure",
    label: "재진단",
    owner: "AAO",
    description: "설치 후 Before/After 비교 실행",
  },
  {
    id: "case_study",
    label: "케이스 승인",
    owner: "AAO + 고객",
    description: "공개 가능한 경우 Before/After 사례 승인",
  },
];

export const PILOT_SLA_BY_PLAN = {
  basic: {
    kickoff: "접수 후 1영업일 내",
    assetReview: "자료 수령 후 1영업일 내",
    firstDraft: "범위 확정 후 3영업일 내",
    revision: "피드백 수령 후 2영업일 내",
    install: "최종 승인 후 1영업일 내",
    remeasure: "설치 후 24시간 내",
  },
  pro: {
    kickoff: "접수 후 1영업일 내",
    assetReview: "자료 수령 후 1영업일 내",
    firstDraft: "범위 확정 후 3영업일 내",
    revision: "피드백 수령 후 2영업일 내",
    install: "최종 승인 후 1영업일 내",
    remeasure: "설치 후 24시간 내 + 월간 점검",
  },
  business: {
    kickoff: "접수 후 1영업일 내",
    assetReview: "자료 수령 후 1영업일 내",
    firstDraft: "범위 확정 후 5영업일 내",
    revision: "피드백 수령 후 2영업일 내",
    install: "최종 승인 후 1영업일 내",
    remeasure: "설치 후 24시간 내 + 월간 운영",
  },
};

export const OPERATION_FALLBACK_PATHS = {
  payment: "/ai-profile/ops/payment",
  kickoff: "/ai-profile/ops/kickoff",
  status: "/ai-profile/ops/status",
  chat: "/ai-profile/ops/chat",
};

export const OPERATION_PAGE_CONTENT = {
  payment: {
    id: "payment",
    title: "결제 안내",
    headline: "AI 프로필 제작 결제 단계",
    description: "외부 결제 링크가 아직 연결되지 않은 경우에도 현재 플랜과 작업 범위를 확인할 수 있는 내부 fallback 페이지입니다.",
    sections: [
      {
        title: "결제 전 확인",
        items: [
          "플랜, 템플릿, 설치 지원 범위 확인",
          "납기와 수정 횟수 확인",
          "파일 전달 방식과 도메인 접근 방식 확인",
        ],
      },
      {
        title: "AAO 기준 기본 흐름",
        items: [
          "결제 또는 착수 의사 확인",
          "자료 수집 시작",
          "1차 초안 작성",
          "설치 후 재진단",
        ],
      },
    ],
    note: "실제 결제 링크가 연결되면 이 페이지 대신 외부 결제 채널로 바로 보냅니다.",
  },
  kickoff: {
    id: "kickoff",
    title: "킥오프 미팅",
    headline: "AI 프로필 킥오프 아젠다",
    description: "실제 일정 예약 링크가 없더라도, 지금 기준으로 어떤 아젠다를 맞춰야 하는지 보여주는 내부 fallback 페이지입니다.",
    sections: [
      {
        title: "킥오프 아젠다",
        items: [
          "회사/브랜드 정의 문장 확정",
          "핵심 서비스와 FAQ 범위 확정",
          "설치 경로(`/ai-profile`)와 호스팅 방식 확인",
          "Before/After 측정 기준 합의",
        ],
      },
      {
        title: "고객 준비물",
        items: [
          "회사소개서 또는 소개 문서",
          "대표 서비스/제품 자료",
          "설치 권한 또는 담당자 정보",
          "공개 가능한 사례/리뷰/보도자료",
        ],
      },
    ],
    note: "실제 캘린더 링크가 연결되면 이 페이지 대신 일정 예약 화면으로 이동합니다.",
  },
  status: {
    id: "status",
    title: "상태 추적",
    headline: "현재 요청 상태 확인",
    description: "실시간 CRM이 아직 연결되지 않았기 때문에 draft 기준 예상 stage와 다음 액션을 보여주는 내부 fallback 페이지입니다.",
    sections: [
      {
        title: "기본 stage",
        items: [
          "접수 완료",
          "범위 확정",
          "자료 수집",
          "초안 전달",
          "설치 및 재진단",
        ],
      },
      {
        title: "지금 확인할 것",
        items: [
          "draftId와 회사명 일치 여부",
          "플랜/템플릿/호스팅 설정",
          "자료 전달 여부",
          "재진단 예정 URL",
        ],
      },
    ],
    note: "나중에 CRM 또는 파일럿 로그 저장이 붙으면 실시간 상태가 이 화면에 연결됩니다.",
  },
  chat: {
    id: "chat",
    title: "빠른 상담",
    headline: "빠른 문의 정리",
    description: "외부 오픈채팅/메신저 링크가 없더라도, 어떤 내용을 먼저 전달해야 하는지 정리해주는 내부 fallback 페이지입니다.",
    sections: [
      {
        title: "짧게 보내면 좋은 정보",
        items: [
          "회사명 / 도메인",
          "주요 서비스 한 줄 설명",
          "원하는 설치 방식(가이드/대행)",
          "희망 일정과 문의 포인트",
        ],
      },
      {
        title: "AAO가 바로 확인하는 것",
        items: [
          "현재 메인 페이지 정보 밀도",
          "공식 도메인 정합성",
          "설치 가능한 `/ai-profile` 경로 존재 여부",
          "재측정 목표 점수",
        ],
      },
    ],
    note: "실제 상담 링크가 연결되면 이 페이지 대신 바로 상담 채널로 이동합니다.",
  },
};

export function getPlanById(planId) {
  return AI_PROFILE_PLANS.find((plan) => plan.id === planId) || AI_PROFILE_PLANS[0];
}

export function getIndustryTemplateById(templateId) {
  return (
    INDUSTRY_TEMPLATE_LIBRARY.find((template) => template.id === templateId) ||
    INDUSTRY_TEMPLATE_LIBRARY[INDUSTRY_TEMPLATE_LIBRARY.length - 1]
  );
}

export function resolveIndustryTemplateId({ templateId, industry, mainService, headline } = {}) {
  if (templateId && templateId !== AUTO_TEMPLATE_ID) {
    return getIndustryTemplateById(templateId).id;
  }

  const haystack = `${industry || ""} ${mainService || ""} ${headline || ""}`.toLowerCase();

  if (/(saas|software|b2b|platform|crm|erp|ai 솔루션|ai platform)/.test(haystack)) {
    return "b2b-saas";
  }
  if (/(developer|sdk|api|cli|library|framework|개발자|문서|깃허브|github)/.test(haystack)) {
    return "developer-tool";
  }
  if (/(restaurant|cafe|clinic|salon|yoga|gym|local|매장|카페|식당|병원|미용실|학원)/.test(haystack)) {
    return "local-business";
  }
  if (/(consulting|agency|law|tax|accounting|clinic|studio|컨설팅|에이전시|법률|세무|노무|병원)/.test(haystack)) {
    return "professional-service";
  }
  if (/(commerce|shop|store|brand|product|mall|쇼핑몰|브랜드|상품|커머스|이커머스)/.test(haystack)) {
    return "commerce-brand";
  }
  if (/(creator|influencer|course|class|교육|강의|콘텐츠|크리에이터|인플루언서|유튜브|youtube)/.test(haystack)) {
    return "creator-education";
  }

  return "general-business";
}

export function getInstallationSop(hostingType, installSupport = "guided") {
  const base = INSTALLATION_SOPS[hostingType] || INSTALLATION_SOPS.other;

  if (installSupport !== "managed") {
    return {
      ...base,
      supportMode: "guided",
      supportModeLabel: "가이드 기반 셀프 설치",
      kickoff: "AAO가 파일과 가이드를 전달하고 고객이 직접 업로드합니다.",
    };
  }

  return {
    ...base,
    supportMode: "managed",
    supportModeLabel: "AAO 대행 설치",
    kickoff: "AAO가 접근 권한 또는 배포 초대 권한을 받아 직접 설치를 진행합니다.",
    steps: [
      "AAO가 배포/호스팅 접근 권한을 확인합니다.",
      ...base.steps,
    ],
  };
}

export function getCommercialChannelCatalog() {
  return [
    {
      id: "payment",
      label: "결제 링크",
      href: process.env.NEXT_PUBLIC_AAO_PAYMENT_LINK || "",
      fallbackPath: OPERATION_FALLBACK_PATHS.payment,
      description: "카드/계좌이체 등 실제 결제 채널로 연결합니다.",
    },
    {
      id: "kickoff",
      label: "킥오프 미팅",
      href: process.env.NEXT_PUBLIC_AAO_KICKOFF_LINK || "",
      fallbackPath: OPERATION_FALLBACK_PATHS.kickoff,
      description: "온보딩 미팅 또는 일정 예약 채널로 연결합니다.",
    },
    {
      id: "status",
      label: "상태 추적",
      href: process.env.NEXT_PUBLIC_AAO_STATUS_LINK || "",
      fallbackPath: OPERATION_FALLBACK_PATHS.status,
      description: "진행 상태를 확인하거나 추가 자료를 제출하는 채널입니다.",
    },
    {
      id: "chat",
      label: "빠른 상담",
      href: process.env.NEXT_PUBLIC_AAO_CHAT_LINK || "",
      fallbackPath: OPERATION_FALLBACK_PATHS.chat,
      description: "오픈채팅 또는 메신저 기반 빠른 문의 채널입니다.",
    },
  ];
}

export function getOperationPageContent(channelId) {
  return OPERATION_PAGE_CONTENT[channelId] || null;
}

export function buildProfileRequestHref(snapshot = {}) {
  const normalized = buildDiagnosticSnapshot(snapshot);
  const params = new URLSearchParams();

  if (normalized.companyName) params.set("companyName", normalized.companyName);
  if (normalized.domain) params.set("domain", normalized.domain);
  if (normalized.url) params.set("url", normalized.url);
  if (normalized.currentScore !== null) params.set("score", String(normalized.currentScore));
  if (normalized.targetScore !== null) params.set("targetScore", String(normalized.targetScore));

  const query = params.toString();
  return query ? `/ai-profile/request?${query}` : "/ai-profile/request";
}

export function buildDiagnosticSnapshot(input = {}) {
  const normalizedUrl = normalizeUrl(input.url || input.websiteUrl || input.targetUrl || "");
  const fallbackDomain = deriveDomain(normalizedUrl);
  const companyName = sanitizeText(
    input.companyName || input.company_name || input.name || "",
    120
  );
  const currentScore = parseNullableNumber(
    input.currentScore ?? input.score ?? input.overallScore ?? input.overall_score
  );
  const targetScoreInput = parseNullableNumber(
    input.targetScore ??
      input.expectedScoreAfter ??
      input.expected_score_after ??
      input.projectedScore
  );

  const snapshot = {
    companyName,
    domain: normalizeDomain(input.domain || fallbackDomain),
    url: normalizedUrl,
    grade: sanitizeText(input.grade || "", 12),
    headline: sanitizeText(
      input.headline ||
        input.customerSummary?.headline ||
        input.customer_summary?.headline ||
        "",
      240
    ),
    detail: sanitizeText(
      input.detail ||
        input.customerSummary?.detail ||
        input.customer_summary?.detail ||
        "",
      1200
    ),
    currentScore,
    targetScore:
      targetScoreInput !== null
        ? targetScoreInput
        : currentScore !== null
          ? clampNumber(currentScore + DEFAULT_TARGET_LIFT, 0, 100)
          : null,
    gapScore: parseNullableNumber(input.gapScore ?? input.discoveryGapScore ?? input.gap),
    pacpScore: parseNullableNumber(input.pacpScore ?? input.pacp?.score),
    sepScore: parseNullableNumber(input.sepScore ?? input.sep?.score),
    spfScore: parseNullableNumber(input.spfScore ?? input.spf?.score),
    improvements: normalizeStringArray(input.improvements, 5),
    hiddenPages: normalizeStringArray(input.hiddenPages, 5),
  };

  return snapshot;
}

export function normalizeIntakePayload(payload = {}) {
  const snapshot = buildDiagnosticSnapshot(payload.snapshot || payload);
  const companyName = sanitizeText(payload.companyName || snapshot.companyName, 120);
  const domain = normalizeDomain(payload.domain || snapshot.domain || deriveDomain(snapshot.url));
  const plan = getPlanById(payload.planId);
  const resolvedTemplateId = resolveIndustryTemplateId({
    templateId: payload.templateId,
    industry: payload.industry,
    mainService: payload.mainService,
    headline: snapshot.headline,
  });

  return {
    contactName: sanitizeText(payload.contactName, 80),
    contactEmail: sanitizeEmail(payload.contactEmail),
    phone: sanitizeText(payload.phone, 40),
    companyName,
    domain,
    industry: sanitizeText(payload.industry, 120),
    representative: sanitizeText(payload.representative, 80),
    mainService: sanitizeText(payload.mainService, 220),
    materials: sanitizeText(payload.materials, 2000),
    notes: sanitizeText(payload.notes, 2000),
    timeline: sanitizeText(payload.timeline, 120),
    hostingType: pickOption(payload.hostingType, HOSTING_OPTIONS, "other"),
    installSupport: pickOption(payload.installSupport, INSTALL_SUPPORT_OPTIONS, "guided"),
    planId: plan.id,
    templateId: resolvedTemplateId,
    snapshot: {
      ...snapshot,
      companyName: companyName || snapshot.companyName,
      domain: domain || snapshot.domain,
    },
  };
}

export function validateIntakePayload(payload = {}) {
  const errors = {};

  if (!payload.contactName) {
    errors.contactName = "담당자명을 입력해주세요.";
  }

  if (!payload.contactEmail) {
    errors.contactEmail = "이메일을 입력해주세요.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail)) {
    errors.contactEmail = "유효한 이메일 형식이 아닙니다.";
  }

  if (!payload.companyName) {
    errors.companyName = "회사명을 입력해주세요.";
  }

  if (!payload.domain && !payload.snapshot?.url) {
    errors.domain = "도메인 또는 웹사이트 URL이 필요합니다.";
  }

  if (!payload.mainService) {
    errors.mainService = "주요 서비스/제품 설명을 입력해주세요.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildIntakeDraft(rawPayload = {}) {
  const payload = normalizeIntakePayload(rawPayload);
  const validation = validateIntakePayload(payload);
  const plan = getPlanById(payload.planId);
  const template = getIndustryTemplateById(payload.templateId);
  const currentScore = payload.snapshot.currentScore;
  const targetScore =
    payload.snapshot.targetScore !== null
      ? payload.snapshot.targetScore
      : currentScore !== null
        ? clampNumber(currentScore + Math.max(plan.targetLift, template.targetLift || 0), 0, 100)
        : null;
  const expectedLift =
    currentScore !== null && targetScore !== null ? Math.max(targetScore - currentScore, 0) : Math.max(plan.targetLift, template.targetLift || 0);
  const installationSop = getInstallationSop(payload.hostingType, payload.installSupport);

  const installationChecklist = [
    "footer 또는 소개 페이지에 /ai-profile 링크 추가",
    "sitemap.xml에 /ai-profile 포함",
    "robots.txt / llms.txt에서 차단 여부 확인",
    "self-canonical 및 indexable 상태 확인",
  ];

  const deliverables = [
    ...plan.deliverables,
    `${template.label} 템플릿 기반 섹션 구조`,
    payload.installSupport === "managed" ? "대행 설치 지원" : "설치 가이드 기반 셀프 설치",
    payload.hostingType === "other" ? "호스팅 환경 파악 메모" : `${getOptionLabel(payload.hostingType, HOSTING_OPTIONS)} 기준 설치 경로 안내`,
  ];

  const priorities = [
    currentScore !== null
      ? `현재 메인 페이지 기준 ${currentScore}점에서 AI가 핵심 회사 정보를 일관되게 읽지 못하고 있습니다.`
      : "현재 점수 데이터 없이도 AI 프로필 페이지를 먼저 제작할 수 있습니다.",
    payload.snapshot.gapScore
      ? `메인 페이지와 서브페이지 사이의 정보 격차가 +${payload.snapshot.gapScore}점 수준으로 보입니다. 숨겨진 정보를 /ai-profile 상단으로 끌어올리는 것이 우선입니다.`
      : "메인 페이지에 없는 공식 정보, FAQ, Schema.org 구조를 별도 AI 프로필 페이지에 정리하는 것이 우선입니다.",
    payload.mainService
      ? `${payload.mainService}를 AI가 한 문장으로 설명할 수 있도록 정의 문장과 FAQ를 재작성해야 합니다.`
      : "서비스 정의 문장과 공식 FAQ를 정리해야 합니다.",
    `${template.label} 템플릿 기준으로 ${template.sections.slice(0, 3).join(", ")} 섹션을 우선 배치하는 것이 좋습니다.`,
  ];

  const nextSteps = [
    "AAO가 고객 자료와 현재 진단 결과를 기준으로 초안을 작성합니다.",
    "고객이 사실관계와 표현을 검수합니다.",
    "정적 HTML 파일을 /ai-profile 경로에 설치합니다.",
    "설치 후 같은 URL로 다시 진단해 Before/After 점수를 비교합니다.",
  ];

  const draft = {
    draftId: buildDraftId(payload.companyName || payload.domain || "aao"),
    generatedAt: new Date().toISOString(),
    validation,
    plan: {
      id: plan.id,
      label: plan.label,
      priceLabel: plan.priceLabel,
      turnaroundLabel: plan.turnaroundLabel,
      description: plan.description,
    },
    template: {
      id: template.id,
      label: template.label,
      summary: template.summary,
      targetLift: template.targetLift,
      schemaTypes: template.schemaTypes,
      sections: template.sections,
      requiredAssets: template.requiredAssets,
      sourceTargets: template.sourceTargets,
    },
    request: {
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      phone: payload.phone,
      companyName: payload.companyName,
      domain: payload.domain,
      industry: payload.industry,
      representative: payload.representative,
      mainService: payload.mainService,
      materials: payload.materials,
      notes: payload.notes,
      timeline: payload.timeline,
      hostingType: payload.hostingType,
      hostingLabel: getOptionLabel(payload.hostingType, HOSTING_OPTIONS),
      installSupport: payload.installSupport,
      installSupportLabel: getOptionLabel(payload.installSupport, INSTALL_SUPPORT_OPTIONS),
      templateId: template.id,
      templateLabel: template.label,
    },
    snapshot: {
      ...payload.snapshot,
      targetScore,
    },
    beforeAfter: {
      beforeScore: currentScore,
      afterTargetScore: targetScore,
      expectedLift,
      installationPath: "/ai-profile",
      summary:
        currentScore !== null && targetScore !== null
          ? `${currentScore}점에서 ${targetScore}점까지 끌어올리는 것을 목표로 합니다.`
          : `${plan.label} 플랜 기준으로 AI 프로필 페이지를 우선 제작하고 설치 후 다시 측정합니다.`,
      keyChanges: [
        "정적 HTML 기반 AI 프로필 페이지 1개",
        "Schema.org JSON-LD 3종 이상",
        "핵심 정보 상단 배치 + 한영 FAQ",
        `${template.label} 템플릿 섹션 적용`,
        "설치 후 동일 URL 재진단",
      ],
    },
    installation: {
      path: "/ai-profile",
      seoNote: "기존 메인 사이트를 크게 수정하지 않고 AI 전용 정적 페이지를 추가하는 방식으로 진행합니다.",
      checklist: installationChecklist,
      sop: installationSop,
    },
    deliverables,
    priorities,
    nextSteps,
    pilotOps: buildPilotOps({
      payload,
      plan,
      template,
      installationSop,
      targetScore,
      expectedLift,
    }),
    reportTemplate: buildReportTemplate({
      payload,
      plan,
      template,
      installationSop,
      targetScore,
      expectedLift,
      deliverables,
    }),
  };

  const mailSubject = `[AAO] AI 프로필 제작 요청 - ${draft.request.companyName || draft.request.domain || "신규 문의"}`;
  const mailBody = buildMailBody(draft);
  const channels = buildOperationsChannels(draft, mailSubject, mailBody);

  return {
    ...draft,
    mailSubject,
    mailBody,
    mailtoHref: `mailto:${AAO_CONTACT_EMAIL}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`,
    channels,
    markdown: buildMarkdownDraft(draft, mailSubject, mailBody),
  };
}

function buildReportTemplate({ payload, plan, template, installationSop, targetScore, expectedLift, deliverables }) {
  return {
    title: `${payload.companyName || payload.domain} AI 프로필 제작 리포트 초안`,
    sections: [
      {
        title: "1. 현재 진단 요약",
        body: payload.snapshot.headline || "현재 메인 페이지 기준 AI가 읽는 회사 소개 품질을 요약합니다.",
      },
      {
        title: "2. 제작 범위",
        body: `${plan.label} 플랜 기준으로 ${deliverables.slice(0, 4).join(", ")}를 포함합니다.`,
      },
      {
        title: "3. 템플릿 방향",
        body: `${template.label} 템플릿 기준으로 ${template.sections.slice(0, 4).join(", ")} 순서의 섹션 구성을 제안합니다.`,
      },
      {
        title: "4. 설치 메모",
        body: `${installationSop.label} 환경에서 /ai-profile 경로에 배포하는 것을 기준으로 하며, ${installationSop.verification[0]} 절차까지 포함합니다.`,
      },
      {
        title: "5. 예상 개선 폭",
        body:
          targetScore !== null
            ? `현재 대비 +${expectedLift}점, 목표 ${targetScore}점 수준을 가정합니다.`
            : "설치 후 재진단으로 실제 개선 폭을 측정합니다.",
      },
    ],
  };
}

function buildMailBody(draft) {
  const lines = [
    "안녕하세요. AI 프로필 페이지 제작을 요청드립니다.",
    "",
    `회사명: ${draft.request.companyName || "-"}`,
    `도메인: ${draft.request.domain || draft.snapshot.url || "-"}`,
    `담당자: ${draft.request.contactName || "-"}`,
    `이메일: ${draft.request.contactEmail || "-"}`,
    `연락처: ${draft.request.phone || "-"}`,
    `업종: ${draft.request.industry || "-"}`,
    `대표자: ${draft.request.representative || "-"}`,
    `주요 서비스/제품: ${draft.request.mainService || "-"}`,
    `희망 플랜: ${draft.plan.label} (${draft.plan.priceLabel})`,
    `적용 템플릿: ${draft.template.label}`,
    `설치 방식: ${draft.request.installSupportLabel}`,
    `호스팅 환경: ${draft.request.hostingLabel}`,
    `예상 납기: ${draft.pilotOps.sla.firstDraft}`,
    "",
    "현재 진단 스냅샷",
    `- 현재 점수: ${draft.snapshot.currentScore ?? "미측정"}점`,
    `- 목표 점수: ${draft.snapshot.targetScore ?? "설치 후 측정"}점`,
    `- 헤드라인: ${draft.snapshot.headline || "-"}`,
    "",
    "보유 자료 / 참고 링크",
    draft.request.materials || "-",
    "",
    "추가 메모",
    draft.request.notes || "-",
  ];

  return lines.join("\n");
}

function buildMarkdownDraft(draft, mailSubject, mailBody) {
  return [
    `# ${draft.reportTemplate.title}`,
    "",
    `- Draft ID: ${draft.draftId}`,
    `- Generated At: ${draft.generatedAt}`,
    `- Plan: ${draft.plan.label} (${draft.plan.priceLabel})`,
    `- Template: ${draft.template.label}`,
    "",
    "## Request",
    `- Company: ${draft.request.companyName || "-"}`,
    `- Domain: ${draft.request.domain || draft.snapshot.url || "-"}`,
    `- Contact: ${draft.request.contactName || "-"} / ${draft.request.contactEmail || "-"}`,
    `- Main Service: ${draft.request.mainService || "-"}`,
    `- Hosting: ${draft.request.hostingLabel}`,
    `- Install Support: ${draft.request.installSupportLabel}`,
    `- Template: ${draft.request.templateLabel}`,
    "",
    "## Before / After",
    `- Before Score: ${draft.beforeAfter.beforeScore ?? "미측정"}`,
    `- Target Score: ${draft.beforeAfter.afterTargetScore ?? "설치 후 측정"}`,
    `- Expected Lift: ${draft.beforeAfter.expectedLift ?? "-"}`,
    `- Install Path: ${draft.beforeAfter.installationPath}`,
    "",
    "## Deliverables",
    ...draft.deliverables.map((item) => `- ${item}`),
    "",
    "## Template Sections",
    ...draft.template.sections.map((item) => `- ${item}`),
    "",
    "## Required Assets",
    ...draft.template.requiredAssets.map((item) => `- ${item}`),
    "",
    "## Priorities",
    ...draft.priorities.map((item) => `- ${item}`),
    "",
    "## Installation Checklist",
    ...draft.installation.checklist.map((item) => `- ${item}`),
    "",
    "## Installation SOP",
    `- Hosting: ${draft.installation.sop.label}`,
    `- Support Mode: ${draft.installation.sop.supportModeLabel}`,
    ...draft.installation.sop.steps.map((item) => `- ${item}`),
    "",
    "## Pilot Ops",
    ...draft.pilotOps.stageFlow.map((stage) => `- ${stage.label} (${stage.owner}): ${stage.description}`),
    "",
    "## Pilot Checklist",
    ...draft.pilotOps.checklist.map((item) => `- [ ] ${item.owner} · ${item.label}`),
    "",
    "## Pilot SLA",
    ...Object.entries(draft.pilotOps.sla).map(([key, value]) => `- ${formatSlaKey(key)}: ${value}`),
    "",
    "## Public Case Study Draft",
    `- Title: ${draft.pilotOps.caseStudy.title}`,
    `- Hook: ${draft.pilotOps.caseStudy.hook}`,
    ...draft.pilotOps.caseStudy.metrics.map((item) => `- ${item.label}: ${item.value}`),
    "",
    "## Mail Draft",
    `- Subject: ${mailSubject}`,
    "",
    "```text",
    mailBody,
    "```",
  ].join("\n");
}

function sanitizeText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 160).toLowerCase();
}

function normalizeStringArray(value, maxItems = 5) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return sanitizeText(item, 180);
      if (item && typeof item === "object") {
        return sanitizeText(item.issue || item.title || item.url || item.path || "", 180);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeUrl(value) {
  const input = sanitizeText(value, 400);
  if (!input) return "";

  try {
    return new URL(input).toString();
  } catch {
    try {
      return new URL(`https://${input}`).toString();
    } catch {
      return "";
    }
  }
}

function deriveDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeDomain(value) {
  const input = sanitizeText(value, 255).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return input.replace(/\/.*$/, "").toLowerCase();
}

function pickOption(value, options, fallbackId) {
  return options.some((item) => item.id === value) ? value : fallbackId;
}

function getOptionLabel(optionId, options) {
  return options.find((item) => item.id === optionId)?.label || "기타";
}

function buildDraftId(seed) {
  const compact = sanitizeText(seed, 40)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "aao";

  return `${compact}-${Date.now().toString(36)}`;
}

function buildOperationsChannels(draft, mailSubject, mailBody) {
  const baseChannels = getCommercialChannelCatalog();
  const context = {
    companyName: draft.request.companyName || "",
    domain: draft.request.domain || "",
    template: draft.template.label || "",
    plan: draft.plan.label || "",
    draftId: draft.draftId || "",
  };

  return [
    {
      id: "email",
      label: "이메일 접수",
      href: `mailto:${AAO_CONTACT_EMAIL}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`,
      description: "생성된 메일 초안으로 바로 접수합니다.",
      configured: true,
      primary: true,
    },
    ...baseChannels.map((channel) => {
      const href = buildCommercialChannelHref(channel, context);
      return {
        ...channel,
        href,
        configured: Boolean(href),
        externalConfigured: Boolean(channel.href),
        source: channel.href ? "external" : "internal_fallback",
        primary: channel.id === "payment",
      };
    }),
  ];
}

export function buildCommercialChannelHref(channel, context = {}) {
  const baseHref = channel?.href || channel?.fallbackPath || "";
  return baseHref ? appendContextQuery(baseHref, context) : "";
}

function appendContextQuery(baseHref, context) {
  try {
    const url = new URL(baseHref, SITE_ORIGIN);
    Object.entries(context).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    if (/^https?:\/\//i.test(baseHref)) {
      return url.toString();
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return baseHref;
  }
}

function buildPilotOps({ payload, plan, template, installationSop, targetScore, expectedLift }) {
  const stageFlow = PILOT_STAGE_FLOW.map((stage, index) => ({
    ...stage,
    order: index + 1,
    status: index === 0 ? "ready" : "pending",
  }));
  const checklist = buildPilotChecklist({ payload, template, installationSop });
  const sla = PILOT_SLA_BY_PLAN[plan.id] || PILOT_SLA_BY_PLAN.basic;
  const caseStudy = buildCaseStudyDraft({ payload, plan, template, targetScore, expectedLift });

  return {
    stageFlow,
    checklist,
    sla,
    caseStudy,
  };
}

function buildPilotChecklist({ payload, template, installationSop }) {
  return [
    {
      id: "contact",
      owner: "고객",
      label: "담당자 이메일과 연락 채널 확정",
    },
    {
      id: "scope",
      owner: "AAO",
      label: `${template.label} 템플릿 기준 섹션 구조 확정`,
    },
    {
      id: "assets",
      owner: "고객",
      label: `${template.requiredAssets.slice(0, 3).join(", ")} 자료 전달`,
    },
    {
      id: "hosting",
      owner: payload.installSupport === "managed" ? "AAO" : "고객",
      label: `${installationSop.label} 접근 방식 확인`,
    },
    {
      id: "fact-review",
      owner: "고객",
      label: "회사명, 대표 서비스, 문의 경로 사실 검수",
    },
    {
      id: "discovery",
      owner: "AAO",
      label: "footer 링크, sitemap, canonical, robots 점검",
    },
    {
      id: "remeasure",
      owner: "AAO",
      label: "설치 후 Before/After 재진단 실행",
    },
    {
      id: "publish-consent",
      owner: "고객",
      label: "공개 가능한 Before/After 사례 승인 여부 결정",
    },
  ];
}

function buildCaseStudyDraft({ payload, plan, template, targetScore, expectedLift }) {
  const beforeScore = payload.snapshot.currentScore;
  const afterScore = targetScore;
  const companyLabel = payload.companyName || payload.domain || "고객사";
  const deltaLabel =
    beforeScore !== null && afterScore !== null ? `+${Math.max(afterScore - beforeScore, 0)}점` : `+${expectedLift}점 목표`;

  return {
    title: `${companyLabel} AI Profile Before/After`,
    hook: `${companyLabel}는 ${template.label} 템플릿과 /ai-profile 설치 후 AI 가독성 ${deltaLabel} 개선을 목표로 합니다.`,
    summary:
      beforeScore !== null && afterScore !== null
        ? `${beforeScore}점에서 ${afterScore}점으로 개선하는 것을 목표로 설정했습니다.`
        : `${template.label} 템플릿을 적용하고 설치 후 재진단으로 개선 폭을 측정합니다.`,
    metrics: [
      { id: "before", label: "Before Score", value: beforeScore !== null ? `${beforeScore}점` : "미측정" },
      { id: "after", label: "Target Score", value: afterScore !== null ? `${afterScore}점` : "설치 후 측정" },
      { id: "lift", label: "Expected Lift", value: deltaLabel },
      { id: "plan", label: "Plan", value: `${plan.label} (${plan.priceLabel})` },
      { id: "template", label: "Template", value: template.label },
    ],
    sections: [
      "고객사 배경과 기존 문제",
      "메인 페이지 vs /ai-profile 구조 차이",
      "설치 전/후 점수 비교",
      "실제 AI 응답 변화",
      "고객 코멘트",
    ],
    approvalChecklist: [
      "회사명 공개 가능 여부 확인",
      "점수 공개 가능 여부 확인",
      "스크린샷/응답 인용 허용 여부 확인",
      "고객 코멘트 인용 승인",
    ],
    interviewPrompts: [
      "설치 전 어떤 정보가 AI에 가장 자주 누락됐나요?",
      "설치 후 어떤 질문에서 변화가 가장 크게 느껴졌나요?",
      "내부 팀 설득이나 설치 과정에서 가장 큰 장애물은 무엇이었나요?",
    ],
  };
}

function formatSlaKey(key) {
  if (key === "kickoff") return "킥오프";
  if (key === "assetReview") return "자료 검토";
  if (key === "firstDraft") return "1차 초안";
  if (key === "revision") return "수정 반영";
  if (key === "install") return "설치";
  if (key === "remeasure") return "재진단";
  return key;
}
