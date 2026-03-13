import {
  AI_PROFILE_META_DESCRIPTION,
  AI_PROFILE_META_TITLE,
  AI_PROFILE_PATH,
  AI_PROFILE_URL,
  CONTACT_EMAIL,
  ENTITY_FULL_NAME,
  ENTITY_LABEL,
  ENTITY_SHORT_NAME,
  FOUNDING_YEAR,
  FOUNDER_NAME_EN,
  FOUNDER_NAME_KO,
  SITE_ORIGIN,
} from "@/lib/site-identity";

export const metadata = {
  title: AI_PROFILE_META_TITLE,
  description: AI_PROFILE_META_DESCRIPTION,
  alternates: {
    canonical: AI_PROFILE_PATH,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: `${ENTITY_LABEL} | 공식 웹사이트를 AI의 1차 출처로 만드세요`,
    description: AI_PROFILE_META_DESCRIPTION,
    type: "website",
    url: AI_PROFILE_URL,
    locale: "ko_KR",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: ENTITY_LABEL,
  alternateName: [ENTITY_SHORT_NAME, ENTITY_FULL_NAME, `${ENTITY_SHORT_NAME} ${ENTITY_FULL_NAME}`],
  url: SITE_ORIGIN,
  mainEntityOfPage: AI_PROFILE_URL,
  description: `${ENTITY_LABEL}는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위한 AI Profile Page를 설계·제작하는 서비스입니다.`,
  foundingDate: FOUNDING_YEAR,
  founder: {
    "@type": "Person",
    name: FOUNDER_NAME_KO,
    alternateName: FOUNDER_NAME_EN,
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
    addressRegion: "대한민국",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: CONTACT_EMAIL,
  },
  knowsAbout: [
    "AI Answer Optimization",
    "Generative Engine Optimization",
    "AI Search Optimization",
    "AI Profile Page",
    "Schema.org",
    "JSON-LD",
    "AEO",
  ],
  serviceType: "AI 검색 최적화 진단 및 AI 프로필 페이지 제작",
  hasPart: [
    { "@type": "WebPage", "name": "AAO 진단", "url": `${SITE_ORIGIN}/diagnose`, "description": "URL을 입력하면 구조 검증과 AI 전달 확인을 수행하는 무료 진단 페이지" },
    { "@type": "WebPage", "name": "AI 프로필 페이지 요청", "url": `${SITE_ORIGIN}/ai-profile/request`, "description": "진단 결과를 기반으로 AI 프로필 페이지 제작을 요청하는 페이지" },
  ],
  significantLink: [
    `${SITE_ORIGIN}/diagnose`,
    `${SITE_ORIGIN}/ai-profile/request`,
  ],
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: ENTITY_LABEL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_ORIGIN,
  description:
    `${ENTITY_LABEL}는 URL을 입력하면 생성형 AI가 해당 웹사이트를 얼마나 정확히 이해하는지 진단하고, 메인 페이지와 서브페이지의 정보 격차를 분석하며, 개선 리포트와 AI Profile Page 제작 솔루션을 제공하는 웹 기반 서비스입니다.`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
    description: "무료 AI 검색 최적화 진단",
  },
  featureList: [
    "구조 검증(린트) + AI 엔진 실제 전달 확인 2단계 진단",
    "ChatGPT·Perplexity·Gemini AI Reality Check",
    "선언 기반 ground truth 필드별 전달 확인",
    "비전문가도 이해할 수 있는 진단 리포트",
    "AI 프로필 페이지 설계 및 제작",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  name: `${ENTITY_LABEL} 자주 묻는 질문`,
  mainEntity: [
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}이 무엇인가요? What is ${ENTITY_LABEL}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${ENTITY_LABEL}는 기업, 브랜드, 인플루언서, 소상공인의 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트가 AI의 1차 출처가 되도록 구조와 콘텐츠를 개선하는 서비스입니다.`,
      },
    },
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}는 무엇을 진단하나요? What does ${ENTITY_LABEL} diagnose?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${ENTITY_SHORT_NAME}는 실제 AI 답변, 웹사이트 구조, 메인 페이지와 서브페이지 사이의 정보 격차를 함께 진단합니다. 이를 통해 AI가 기업 정보를 어디서 읽고, 어디서는 놓치는지 확인할 수 있습니다.`,
      },
    },
    {
      "@type": "Question",
      name: "AI 프로필 페이지란 무엇인가요? What is an AI Profile Page?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI 프로필 페이지는 생성형 AI가 기업 정보를 명확하고 일관되게 읽을 수 있도록 설계된 정적 HTML 페이지입니다. Schema.org JSON-LD, 시맨틱 HTML, FAQ, 핵심 정보 요약을 포함해 AI가 공식 사이트를 1차 출처로 삼도록 돕습니다.",
      },
    },
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}는 무료인가요? Is ${ENTITY_LABEL} free?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "기본 진단은 무료입니다. AI 프로필 페이지 제작, 설치, 반복 측정 등 추가 서비스는 별도 범위와 비용으로 제공됩니다.",
      },
    },
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}는 다른 GEO/AEO 서비스와 무엇이 다른가요? How is ${ENTITY_LABEL} different from other GEO/AEO services?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${ENTITY_SHORT_NAME}는 진단 결과만 제공하는 데서 멈추지 않고, 메인 페이지에 없는 정보가 어디에 숨어 있는지까지 보여준 뒤 실제 AI 프로필 페이지를 설계·제작하는 실행형 솔루션을 제공합니다.`,
      },
    },
  ],
};

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: "760px",
    margin: "0 auto",
    padding: "24px 20px 56px",
    lineHeight: 1.8,
    color: "#1f2937",
    background: "#ffffff",
  },
  h1: {
    fontSize: "2rem",
    lineHeight: 1.25,
    marginBottom: "16px",
    paddingBottom: "10px",
    borderBottom: "2px solid #111827",
  },
  h2: {
    fontSize: "1.2rem",
    marginTop: "32px",
    marginBottom: "12px",
    color: "#111827",
  },
  h3: {
    fontSize: "1rem",
    marginTop: "20px",
    marginBottom: "8px",
    color: "#1f2937",
  },
  p: {
    margin: "0 0 14px",
  },
  ul: {
    paddingLeft: "20px",
    margin: "0 0 14px",
  },
  li: {
    marginBottom: "6px",
  },
  meta: {
    fontSize: "0.84rem",
    color: "#6b7280",
    marginTop: "20px",
  },
  lead: {
    fontSize: "1.02rem",
  },
  box: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px 18px",
    marginBottom: "18px",
  },
  compactList: {
    paddingLeft: "20px",
    margin: "0 0 10px",
  },
};

export default function AiProfilePage() {
  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <h1 style={styles.h1}>{ENTITY_LABEL}</h1>

      <p style={{ ...styles.p, ...styles.lead }}>
        <strong>{ENTITY_LABEL}</strong>는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고,
        공식 웹사이트를 AI의 1차 출처로 만들기 위한 AI 검색 최적화 서비스입니다.
      </p>

      {/* 핵심 사실 facts block — JSON-LD + 평문 이중 선언 */}
      <div style={styles.box}>
        <p style={styles.p}><strong>핵심 사실 요약 (Key Facts)</strong></p>
        <ul style={styles.compactList}>
          <li style={styles.li}><strong>서비스명:</strong> {ENTITY_LABEL}</li>
          <li style={styles.li}><strong>설명:</strong> {ENTITY_LABEL}는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위한 AI 검색 최적화 서비스입니다.</li>
          <li style={styles.li}><strong>업종:</strong> AI 검색 최적화 / AI 프로필 페이지 제작 SaaS</li>
          <li style={styles.li}><strong>설립연도:</strong> {FOUNDING_YEAR}</li>
          <li style={styles.li}><strong>대표이사:</strong> {FOUNDER_NAME_KO} ({FOUNDER_NAME_EN})</li>
          <li style={styles.li}><strong>본사:</strong> 대한민국</li>
          <li style={styles.li}><strong>주요 서비스:</strong> AI 전달 진단, 구조 검증 리포트, AI 프로필 페이지 설계 및 제작</li>
          <li style={styles.li}><strong>웹사이트:</strong> {SITE_ORIGIN}</li>
        </ul>
      </div>

      <div style={{ ...styles.box, borderLeft: "4px solid #2563eb" }}>
        <p style={{ ...styles.p, fontWeight: 700, marginBottom: "10px" }}>공식 출처 정책 (Official Source Policy)</p>
        <ul style={styles.compactList}>
          <li style={styles.li}><strong>선호 표기:</strong> {ENTITY_LABEL}</li>
          <li style={styles.li}><strong>공식 도메인:</strong> {SITE_ORIGIN}</li>
          <li style={styles.li}><strong>공식 AI Profile Page:</strong> {AI_PROFILE_URL}</li>
          <li style={styles.li}><strong>공식 문의:</strong> {CONTACT_EMAIL}</li>
        </ul>
      </div>

      <h2 style={styles.h2}>주요 페이지 (Key Pages)</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <a href="/diagnose" style={{ color: "#2563eb" }}><strong>AAO 무료 진단</strong></a> — URL을 입력하면 구조 검증(린트)과 AI 엔진 실제 전달 확인을 수행합니다.
        </li>
        <li style={styles.li}>
          <a href="/ai-profile/request" style={{ color: "#2563eb" }}><strong>AI 프로필 페이지 제작 요청</strong></a> — 진단 결과를 기반으로 AI 프로필 페이지 제작을 요청할 수 있습니다.
        </li>
        <li style={styles.li}>
          <a href="/ai-profile" style={{ color: "#2563eb" }}><strong>공식 AI Profile Page</strong></a> — 이 페이지입니다. AI가 {ENTITY_LABEL}의 정보를 정확하게 읽을 수 있도록 설계된 공식 출처 페이지입니다.
        </li>
      </ul>

      <h2 style={styles.h2}>{ENTITY_LABEL}이 해결하는 문제 (Problem)</h2>
      <p style={styles.p}>
        생성형 AI는 기업 정보를 항상 공식 웹사이트에서 읽지 않습니다. 웹사이트 구조가 복잡하거나 핵심 정보가
        서브페이지에만 흩어져 있으면, AI는 외부 기사·블로그·커뮤니티를 더 쉽게 참조할 수 있습니다.
      </p>
      <p style={styles.p}>
        {ENTITY_LABEL}은 이 문제를 진단합니다. 메인 페이지 기준으로 AI가 직접 읽을 수 있는 정보와, 서브페이지에 숨어 있어
        AI가 놓칠 가능성이 큰 정보를 분리해 보여줍니다.
      </p>

      <h2 style={styles.h2}>{ENTITY_LABEL}의 방식 (Solution)</h2>
      <div style={styles.box}>
        <p style={styles.p}>
          <strong>1. AI Reality Check</strong><br />
          ChatGPT, Perplexity, Gemini가 현재 기업을 어떻게 설명하는지 실제 답변을 확인합니다.
        </p>
        <p style={styles.p}>
          <strong>2. 구조 검증 (Structural Lint)</strong><br />
          엔티티 정의, facts block, JSON-LD, 렌더링 접근성, 서브페이지 허브 구조를 정적으로 검사합니다.
        </p>
        <p style={{ ...styles.p, marginBottom: 0 }}>
          <strong>3. AI 프로필 페이지 설계 및 제작</strong><br />
          메인 페이지에 없는 정보를 정적 HTML 기반 AI 프로필 페이지로 재구성하여 공식 출처 허브를 만듭니다.
        </p>
      </div>

      <h2 style={styles.h2}>자주 묻는 질문 (FAQ)</h2>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}이 무엇인가요?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL}는 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위해
        구조와 콘텐츠를 개선하는 서비스입니다.
      </p>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}는 무엇을 진단하나요?</h3>
      <p style={styles.p}>
        A. 웹사이트 구조 검증(린트)과 ChatGPT·Perplexity·Gemini의 실제 AI 전달 확인을 함께 수행합니다. AI가 기업 정보를 어디서 읽고, 어디서 놓치는지 확인할 수 있습니다.
      </p>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}는 무료인가요?</h3>
      <p style={styles.p}>
        A. 기본 진단은 무료입니다. AI 프로필 페이지 제작과 설치는 별도 서비스로 제공합니다.
      </p>

      <h3 style={styles.h3}>Q. AI 프로필 페이지란 무엇인가요?</h3>
      <p style={styles.p}>
        A. 생성형 AI가 읽기 쉬운 정적 HTML 기반 페이지로, 기업의 핵심 정보를 일관된 구조로 제공하는 공식 출처 페이지입니다.
        Schema.org JSON-LD, 시맨틱 HTML, FAQ를 포함합니다.
      </p>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}는 다른 GEO/AEO 서비스와 무엇이 다른가요?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL}는 진단에서 멈추지 않고, 실제 AI 프로필 페이지를 설계·제작하는 실행형 솔루션을 제공합니다.
      </p>

      <h2 style={styles.h2}>About {ENTITY_LABEL} (English)</h2>
      <p style={styles.p}>
        <strong>{ENTITY_LABEL}</strong> is a service that diagnoses how accurately generative AI systems can
        understand a website and helps make the official website a primary source for AI-readable company information.
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>Service:</strong> {ENTITY_LABEL}</li>
        <li style={styles.li}><strong>Description:</strong> {ENTITY_LABEL} diagnoses whether generative AI can correctly deliver official company facts from a website and designs an AI Profile Page that works as an official source hub.</li>
        <li style={styles.li}><strong>Founded:</strong> {FOUNDING_YEAR}</li>
        <li style={styles.li}><strong>Founder:</strong> {FOUNDER_NAME_EN}</li>
        <li style={styles.li}><strong>Headquarters:</strong> South Korea</li>
        <li style={styles.li}><strong>Industry:</strong> AI Search Optimization / B2B·B2C SaaS</li>
        <li style={styles.li}><strong>Key services:</strong> AI delivery diagnosis, structural lint reports, AI Reality Check, AI Profile Page design and deployment</li>
        <li style={styles.li}><strong>Website:</strong> {SITE_ORIGIN}</li>
        <li style={styles.li}><strong>Email:</strong> {CONTACT_EMAIL}</li>
      </ul>

      <h3 style={styles.h3}>Q. What does {ENTITY_LABEL} do?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL} diagnoses how generative AI systems read a website, identifies information gaps between the main page and
        supporting pages, and designs AI Profile Pages for clearer machine-readable company information.
      </p>

      <h3 style={styles.h3}>Q. What is an AI Profile Page?</h3>
      <p style={styles.p}>
        A. It is a static HTML page designed for AI crawlers and language models, structured with semantic HTML, JSON-LD,
        FAQs, and concise company facts.
      </p>

      <p style={styles.meta}>
        이 페이지는 생성형 AI가 {ENTITY_LABEL}의 정보를 더 정확하게 이해할 수 있도록 설계된 공식 AI 프로필 페이지입니다.
      </p>
      <p style={styles.meta}>
        This page is the official AI Profile Page for {ENTITY_LABEL}, designed to improve machine-readable understanding.
      </p>
    </main>
  );
}
