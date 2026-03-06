export const metadata = {
  title: "AAO — AI Answer Optimization | AI가 기업 정보를 정확히 설명하도록 돕는 서비스",
  description:
    "AAO는 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위한 AI 프로필 페이지를 설계·제작하는 서비스입니다.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "AAO — 공식 웹사이트를 AI의 1차 출처로 만드세요",
    description:
      "AAO는 웹사이트를 진단하고 AI 프로필 페이지를 제작해 ChatGPT, Perplexity, Gemini가 기업 정보를 더 정확히 읽도록 돕습니다.",
    type: "website",
    url: "https://aao.co.kr/ai-profile",
    locale: "ko_KR",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AAO",
  alternateName: "AI Answer Optimization",
  url: "https://aao.co.kr",
  description:
    "AAO는 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위한 AI 프로필 페이지를 설계·제작하는 서비스입니다.",
  foundingDate: "2026",
  founder: {
    "@type": "Person",
    name: "변희재",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "bhj31029943@gmail.com",
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
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AAO - AI Answer Optimization",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AAO는 URL을 입력하면 생성형 AI가 해당 웹사이트를 얼마나 정확히 이해하는지 진단하고, 메인 페이지와 서브페이지의 정보 격차를 분석하며, 개선 리포트와 AI 프로필 페이지 제작 솔루션을 제공하는 웹 기반 서비스입니다.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
    description: "무료 AI 검색 최적화 진단",
  },
  featureList: [
    "Princeton GEO 연구 기반 3축 진단",
    "ChatGPT·Perplexity·Gemini AI Reality Check",
    "메인 페이지 vs 서브페이지 Gap 분석",
    "비전문가도 이해할 수 있는 개선 리포트",
    "AI 프로필 페이지 설계 및 제작",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "AAO가 무엇인가요? What is AAO?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AAO(AI Answer Optimization)는 기업, 브랜드, 인플루언서, 소상공인의 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트가 AI의 1차 출처가 되도록 구조와 콘텐츠를 개선하는 서비스입니다.",
      },
    },
    {
      "@type": "Question",
      name: "AAO는 무엇을 진단하나요? What does AAO diagnose?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AAO는 실제 AI 답변, 웹사이트 구조, 메인 페이지와 서브페이지 사이의 정보 격차를 함께 진단합니다. 이를 통해 AI가 기업 정보를 어디서 읽고, 어디서는 놓치는지 확인할 수 있습니다.",
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
      name: "AAO는 무료인가요? Is AAO free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "기본 진단은 무료입니다. AI 프로필 페이지 제작, 설치, 반복 측정 등 추가 서비스는 별도 범위와 비용으로 제공됩니다.",
      },
    },
    {
      "@type": "Question",
      name: "AAO는 다른 GEO/AEO 서비스와 무엇이 다른가요? How is AAO different from other GEO/AEO services?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AAO는 진단 결과만 제공하는 데서 멈추지 않고, 메인 페이지에 없는 정보가 어디에 숨어 있는지까지 보여준 뒤 실제 AI 프로필 페이지를 설계·제작하는 실행형 솔루션을 제공합니다.",
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
};

export default function AiProfilePage() {
  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <h1 style={styles.h1}>AAO — AI Answer Optimization</h1>

      <p style={{ ...styles.p, ...styles.lead }}>
        <strong>AAO</strong>는 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고,
        공식 웹사이트를 AI의 1차 출처로 만들기 위한 구조와 콘텐츠를 설계하는 서비스입니다.
      </p>
      <p style={styles.p}>
        기업, 브랜드, 인플루언서, 소상공인의 웹사이트를 대상으로 ChatGPT, Perplexity, Gemini와 같은
        생성형 AI가 무엇을 읽고 무엇을 놓치는지 확인한 뒤, 실제 수정 방향과 AI 프로필 페이지 제작까지 연결합니다.
      </p>

      <h2 style={styles.h2}>기본 정보 (Company Overview)</h2>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>서비스명:</strong> AAO / AI Answer Optimization</li>
        <li style={styles.li}><strong>설립연도:</strong> 2026</li>
        <li style={styles.li}><strong>대표자:</strong> 변희재</li>
        <li style={styles.li}><strong>업종:</strong> AI 검색 최적화 / B2B·B2C SaaS</li>
        <li style={styles.li}><strong>서비스 유형:</strong> AI 검색 가독성 진단 + AI 프로필 페이지 설계 및 제작</li>
        <li style={styles.li}><strong>웹사이트:</strong> https://aao.co.kr</li>
        <li style={styles.li}><strong>이메일:</strong> bhj31029943@gmail.com</li>
      </ul>

      <h2 style={styles.h2}>AAO가 해결하는 문제 (Problem)</h2>
      <p style={styles.p}>
        생성형 AI는 기업 정보를 항상 공식 웹사이트에서 읽지 않습니다. 웹사이트 구조가 복잡하거나 핵심 정보가
        서브페이지에만 흩어져 있으면, AI는 외부 기사·블로그·커뮤니티를 더 쉽게 참조할 수 있습니다.
      </p>
      <p style={styles.p}>
        AAO는 이 문제를 진단합니다. 메인 페이지 기준으로 AI가 직접 읽을 수 있는 정보와, 서브페이지에 숨어 있어
        AI가 놓칠 가능성이 큰 정보를 분리해 보여줍니다.
      </p>

      <h2 style={styles.h2}>AAO의 방식 (Solution)</h2>
      <div style={styles.box}>
        <p style={styles.p}>
          <strong>1. AI Reality Check</strong><br />
          ChatGPT, Perplexity, Gemini가 현재 기업을 어떻게 설명하는지 실제 답변을 확인합니다.
        </p>
        <p style={styles.p}>
          <strong>2. Technical Readiness Diagnosis</strong><br />
          Princeton GEO 연구를 참고한 구조로 웹사이트의 AI 가독성을 진단합니다.
        </p>
        <p style={{ ...styles.p, marginBottom: 0 }}>
          <strong>3. Gap Analysis and Execution</strong><br />
          메인 페이지에 없는 정보가 어디에 숨어 있는지 분석하고, AI 프로필 페이지 설계 및 제작까지 연결합니다.
        </p>
      </div>

      <h2 style={styles.h2}>핵심 기능 (Key Features)</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <strong>3축 진단:</strong> PACP, SEP, SPF 기준으로 웹사이트의 AI 가독성을 평가합니다.
        </li>
        <li style={styles.li}>
          <strong>메인 vs 서브페이지 분리 분석:</strong> 메인 페이지 기준 공식 점수와 서브페이지 보강 정보를 구분해 보여줍니다.
        </li>
        <li style={styles.li}>
          <strong>AI 프로필 페이지 제작:</strong> 정적 HTML, Schema.org JSON-LD, FAQ 구조를 포함한 AI 전용 페이지를 설계합니다.
        </li>
      </ul>

      <h2 style={styles.h2}>누구를 위한 서비스인가요? (Target Users)</h2>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>중소기업/스타트업:</strong> 공식 사이트는 있지만 AI 답변이 부정확한 기업</li>
        <li style={styles.li}><strong>브랜드/커머스:</strong> 제품과 서비스 설명이 AI에 일관되게 노출되어야 하는 브랜드</li>
        <li style={styles.li}><strong>인플루언서/크리에이터:</strong> 자기 소개와 활동 정보가 AI에 정확히 반영되어야 하는 개인 브랜드</li>
        <li style={styles.li}><strong>소상공인/로컬 비즈니스:</strong> 위치, 연락처, 서비스 정보가 정확해야 하는 오프라인 기반 사업자</li>
      </ul>

      <h2 style={styles.h2}>왜 AI 프로필 페이지가 필요한가요? (Why AI Profile Page)</h2>
      <p style={styles.p}>
        AI 프로필 페이지는 생성형 AI가 읽기 쉬운 형태로 핵심 정보를 한 페이지에 정리한 공식 출처 페이지입니다.
        JavaScript 의존도를 줄이고, 시맨틱 HTML과 JSON-LD, FAQ를 포함해 AI가 기업 정보를 명확하게 파악하도록 돕습니다.
      </p>
      <p style={styles.p}>
        AAO의 AI 프로필 페이지는 고객 도메인의 <code>/ai-profile</code> 경로에 설치하는 것을 기본 구조로 설계합니다.
      </p>

      <h2 style={styles.h2}>자주 묻는 질문 (FAQ)</h2>

      <h3 style={styles.h3}>Q. AAO가 무엇인가요?</h3>
      <p style={styles.p}>
        A. AAO는 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위해
        구조와 콘텐츠를 개선하는 서비스입니다.
      </p>

      <h3 style={styles.h3}>Q. AAO는 무엇을 진단하나요?</h3>
      <p style={styles.p}>
        A. 실제 AI 답변, 웹사이트 구조, 메인 페이지와 서브페이지 사이의 정보 격차를 함께 진단합니다.
      </p>

      <h3 style={styles.h3}>Q. AAO는 무료인가요?</h3>
      <p style={styles.p}>
        A. 기본 진단은 무료입니다. AI 프로필 페이지 제작과 설치는 별도 서비스로 제공합니다.
      </p>

      <h3 style={styles.h3}>Q. AI 프로필 페이지란 무엇인가요?</h3>
      <p style={styles.p}>
        A. 생성형 AI가 읽기 쉬운 정적 HTML 기반 페이지로, 기업의 핵심 정보를 일관된 구조로 제공하는 공식 출처 페이지입니다.
      </p>

      <h3 style={styles.h3}>Q. AAO는 다른 GEO/AEO 서비스와 무엇이 다른가요?</h3>
      <p style={styles.p}>
        A. AAO는 진단에서 멈추지 않고, 메인 페이지에 없는 정보가 어디에 숨어 있는지까지 보여준 뒤 실제 AI 프로필 페이지를
        설계·제작하는 실행형 솔루션을 제공합니다.
      </p>

      <h2 style={styles.h2}>About AAO (English)</h2>
      <p style={styles.p}>
        <strong>AAO (AI Answer Optimization)</strong> is a service that diagnoses how accurately generative AI systems can
        understand a website and helps make the official website a primary source for AI-readable company information.
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>Service:</strong> AAO / AI Answer Optimization</li>
        <li style={styles.li}><strong>Founded:</strong> 2026</li>
        <li style={styles.li}><strong>Founder:</strong> Heejae Byun</li>
        <li style={styles.li}><strong>Industry:</strong> AI Search Optimization / B2B·B2C SaaS</li>
        <li style={styles.li}><strong>Website:</strong> https://aao.co.kr</li>
        <li style={styles.li}><strong>Email:</strong> bhj31029943@gmail.com</li>
      </ul>

      <h3 style={styles.h3}>Q. What does AAO do?</h3>
      <p style={styles.p}>
        A. AAO diagnoses how generative AI systems read a website, identifies information gaps between the main page and
        supporting pages, and designs AI Profile Pages for clearer machine-readable company information.
      </p>

      <h3 style={styles.h3}>Q. What is an AI Profile Page?</h3>
      <p style={styles.p}>
        A. It is a static HTML page designed for AI crawlers and language models, structured with semantic HTML, JSON-LD,
        FAQs, and concise company facts.
      </p>

      <p style={styles.meta}>
        이 페이지는 생성형 AI가 AAO의 정보를 더 정확하게 이해할 수 있도록 설계된 공식 AI 프로필 페이지입니다.
      </p>
      <p style={styles.meta}>
        This page is the official AI Profile Page for AAO, designed to improve machine-readable understanding.
      </p>
    </main>
  );
}
