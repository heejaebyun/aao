export const SITE_ORIGIN = "https://aao.co.kr";
export const AI_PROFILE_PATH = "/ai-profile";
export const AI_PROFILE_URL = `${SITE_ORIGIN}${AI_PROFILE_PATH}`;
export const SITE_DOMAIN = new URL(SITE_ORIGIN).hostname;

export const ENTITY_SHORT_NAME = "AAO";
export const ENTITY_FULL_NAME = "AI Answer Optimization";
export const ENTITY_LABEL = "AAO (AI Answer Optimization)";

export const CONTACT_EMAIL = "bhj31029943@gmail.com";
export const FOUNDER_NAME_KO = "변희재";
export const FOUNDER_NAME_EN = "Heejae Byun";
export const FOUNDING_YEAR = "2026";
export const COPYRIGHT_YEAR = FOUNDING_YEAR;
export const HEADQUARTERS_REGION = "대한민국";
export const HEADQUARTERS_REGION_EN = "South Korea";
export const ENTITY_TYPE_LABEL = "AI 검색 최적화 SaaS";
export const ENTITY_TYPE_LABEL_EN = "AI search optimization SaaS";
export const PRIMARY_SERVICES_LABEL = "AI 전달 진단, 구조 검증 리포트, AI 프로필 페이지 제작";
export const PRIMARY_SERVICES_LABEL_EN =
  "AI delivery diagnosis, structural lint reports, AI Profile Page design and deployment";
export const OFFICIAL_FACT_DESCRIPTION = "AI 검색 최적화 서비스";
export const OFFICIAL_FACT_DESCRIPTION_EN = "AI search optimization service";
export const PUBLIC_MARKETING_DESCRIPTION =
  `${ENTITY_LABEL}는 AI 검색 최적화 SaaS입니다.`;

export const ROOT_META_TITLE = `${ENTITY_LABEL} | AI 검색 최적화 서비스`;
export const ROOT_META_DESCRIPTION = PUBLIC_MARKETING_DESCRIPTION;

export const AI_PROFILE_META_TITLE = `${ENTITY_LABEL} | Official AI Profile`;
export const AI_PROFILE_META_DESCRIPTION =
  `${ENTITY_LABEL} is an ${ENTITY_TYPE_LABEL_EN}. Official AI Profile with structured company facts, official-source policy, and primary services for AI-readable discovery.`;

export const LINKEDIN_COMPANY_URL = "https://www.linkedin.com/company/aao-ai-answer-optimization";
export const X_PROFILE_URL = "https://x.com/aao_ai_official";
export const NOTION_OVERVIEW_URL =
  "https://carbonated-sofa-b62.notion.site/AAO-AI-Answer-Optimization-30b911678ad980efa7d7c887c443cac8?source=copy_link";
export const PRODUCT_HUNT_URL = "https://www.producthunt.com/products/aao";
export const FOUNDER_INDIE_HACKERS_URL = "https://www.indiehackers.com/heejaebyun";
export const FOUNDER_LINKEDIN_URL = "https://www.linkedin.com/in/heejae-byun-2887671b3/";
export const FOUNDER_PRODUCT_HUNT_URL = "https://www.producthunt.com/@heejaebyun";
export const FOUNDER_MEDIUM_URL = "https://medium.com/@bhj31029943";
export const CRUNCHBASE_URL = "https://www.crunchbase.com/organization/aao-ai-answer-optimization";

export const OFFICIAL_EXTERNAL_PROFILES = [
  { label: "LinkedIn", url: LINKEDIN_COMPANY_URL },
  { label: "X", url: X_PROFILE_URL },
  { label: "Notion overview", url: NOTION_OVERVIEW_URL },
  { label: "Product Hunt", url: PRODUCT_HUNT_URL },
  { label: "Crunchbase", url: CRUNCHBASE_URL },
];

export const SUPPORTING_PUBLIC_NOTES = [
  {
    label: "Why AI Search Engines Miss Official Company Facts",
    url: "https://carbonated-sofa-b62.notion.site/Why-AI-Search-Engines-Miss-Official-Company-Facts-322911678ad98077b048da08e6f5e418?source=copy_link",
  },
  {
    label: "Why JSON-LD Alone Is Not Enough for AI Citation",
    url: "https://carbonated-sofa-b62.notion.site/Why-JSON-LD-Alone-Is-Not-Enough-for-AI-Citation-322911678ad980e4a56ce202a7b6c3e0?source=copy_link",
  },
];
