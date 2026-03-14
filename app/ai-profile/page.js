import {
  AI_PROFILE_META_DESCRIPTION,
  AI_PROFILE_META_TITLE,
  AI_PROFILE_PATH,
  AI_PROFILE_URL,
  CONTACT_EMAIL,
  ENTITY_LABEL,
  ENTITY_SHORT_NAME,
  ENTITY_TYPE_LABEL,
  ENTITY_TYPE_LABEL_EN,
  FOUNDING_YEAR,
  FOUNDER_INDIE_HACKERS_URL,
  FOUNDER_NAME_EN,
  FOUNDER_NAME_KO,
  HEADQUARTERS_REGION,
  HEADQUARTERS_REGION_EN,
  OFFICIAL_EXTERNAL_PROFILES,
  OFFICIAL_FACT_DESCRIPTION,
  OFFICIAL_FACT_DESCRIPTION_EN,
  PRIMARY_SERVICES_LABEL,
  PRIMARY_SERVICES_LABEL_EN,
  SITE_ORIGIN,
  SUPPORTING_PUBLIC_NOTES,
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
    title: AI_PROFILE_META_TITLE,
    description: AI_PROFILE_META_DESCRIPTION,
    type: "website",
    url: AI_PROFILE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: AI_PROFILE_META_TITLE,
    description: AI_PROFILE_META_DESCRIPTION,
  },
};

const profilePageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: AI_PROFILE_META_TITLE,
  url: AI_PROFILE_URL,
  description: AI_PROFILE_META_DESCRIPTION,
  inLanguage: ["ko", "en"],
  isPartOf: {
    "@id": SITE_ORIGIN,
  },
  about: {
    "@id": SITE_ORIGIN,
  },
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
        text: `${ENTITY_LABEL}는 ${OFFICIAL_FACT_DESCRIPTION}입니다. It is an ${OFFICIAL_FACT_DESCRIPTION_EN}.`,
      },
    },
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}는 무엇을 진단하나요? What does ${ENTITY_LABEL} diagnose?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "웹사이트 구조 검증(린트)과 ChatGPT·Perplexity·Gemini의 실제 AI 전달 확인을 함께 수행합니다. It checks both structural lint and real AI delivery across ChatGPT, Gemini, and Perplexity.",
      },
    },
    {
      "@type": "Question",
      name: "AI 프로필 페이지란 무엇인가요? What is an AI Profile Page?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI 프로필 페이지는 생성형 AI가 기업 정보를 명확하고 일관되게 읽을 수 있도록 설계된 정적 HTML 페이지입니다. It uses semantic HTML, JSON-LD, FAQ, and concise company facts as an official source hub.",
      },
    },
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}는 무료인가요? Is ${ENTITY_LABEL} free?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "기본 진단은 무료입니다. Basic diagnosis is free. AI 프로필 페이지 제작과 설치는 별도 서비스로 제공합니다.",
      },
    },
    {
      "@type": "Question",
      name: `${ENTITY_LABEL}는 다른 GEO/AEO 서비스와 무엇이 다른가요? How is ${ENTITY_LABEL} different from other GEO/AEO services?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${ENTITY_SHORT_NAME}는 진단에서 멈추지 않고 실제 AI 프로필 페이지를 설계·제작하는 실행형 솔루션을 제공합니다. It combines diagnosis with execution.`,
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
  dl: {
    margin: "0 0 18px",
    padding: 0,
  },
  factRow: {
    margin: 0,
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  factTerm: {
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#4b5563",
    marginBottom: "4px",
  },
  factDesc: {
    margin: 0,
    color: "#111827",
    lineHeight: 1.7,
  },
  meta: {
    fontSize: "0.84rem",
    color: "#6b7280",
    marginTop: "20px",
  },
  lead: {
    fontSize: "1.02rem",
  },
  sectionLead: {
    fontSize: "0.95rem",
    color: "#4b5563",
    margin: "0 0 12px",
  },
};

export default function AiProfilePage() {
  const bilingualFacts = [
    { label: "서비스명 / Service", value: ENTITY_LABEL },
    {
      label: "설명 / Description",
      value: `${OFFICIAL_FACT_DESCRIPTION} / ${OFFICIAL_FACT_DESCRIPTION_EN}`,
    },
    {
      label: "업종 / Industry",
      value: `${ENTITY_TYPE_LABEL} / ${ENTITY_TYPE_LABEL_EN}`,
    },
    { label: "설립연도 / Founded", value: FOUNDING_YEAR },
    {
      label: "본사 / Headquarters",
      value: `${HEADQUARTERS_REGION} / ${HEADQUARTERS_REGION_EN}`,
    },
    {
      label: "대표이사 / Founder",
      value: `${FOUNDER_NAME_KO} (${FOUNDER_NAME_EN})`,
    },
    {
      label: "주요 서비스 / Key services",
      value: `${PRIMARY_SERVICES_LABEL} / ${PRIMARY_SERVICES_LABEL_EN}`,
    },
  ];

  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <h1 style={styles.h1}>{ENTITY_LABEL}</h1>

      <p style={{ ...styles.p, ...styles.lead }}>
        <strong>{ENTITY_LABEL}</strong>는 {OFFICIAL_FACT_DESCRIPTION}입니다. {ENTITY_LABEL} is an{" "}
        {OFFICIAL_FACT_DESCRIPTION_EN}. 구조 검증, AI 전달 진단, AI 프로필 페이지 제작을 통해 공식 웹사이트를 AI의
        1차 출처로 정리합니다.
      </p>

      <h2 style={styles.h2}>핵심 사실 요약 / Key Facts</h2>
      <p style={styles.sectionLead}>
        이 페이지는 {ENTITY_LABEL}의 회사 레벨 공식 출처 허브입니다. The same facts are declared here in one bilingual layer so AI systems can read a single canonical source.
      </p>
      <dl style={styles.dl}>
        {bilingualFacts.map((item) => (
          <div key={item.label} style={styles.factRow}>
            <dt style={styles.factTerm}>{item.label}</dt>
            <dd style={styles.factDesc}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <h2 style={styles.h2}>공식 출처 정책 / Official Source Policy</h2>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>선호 표기 / Preferred name:</strong> {ENTITY_LABEL}</li>
        <li style={styles.li}><strong>공식 도메인 / Canonical site:</strong> {SITE_ORIGIN}</li>
        <li style={styles.li}><strong>공식 AI Profile Page / Official AI Profile:</strong> {AI_PROFILE_URL}</li>
        <li style={styles.li}><strong>공식 문의 / Contact:</strong> {CONTACT_EMAIL}</li>
        <li style={styles.li}>
          <strong>검증된 외부 프로필 / Verified external profiles:</strong>{" "}
          {OFFICIAL_EXTERNAL_PROFILES.map((profile, index) => (
            <span key={profile.url}>
              {index > 0 ? " · " : ""}
              <a href={profile.url} style={{ color: "#2563eb" }}>{profile.label}</a>
            </span>
          ))}
        </li>
        <li style={styles.li}>
          <strong>창업자 프로필 / Founder profile:</strong>{" "}
          <a href={FOUNDER_INDIE_HACKERS_URL} style={{ color: "#2563eb" }}>Indie Hackers</a>
        </li>
        <li style={styles.li}>
          <strong>보조 공개 노트 / Supporting public notes:</strong>{" "}
          {SUPPORTING_PUBLIC_NOTES.map((note, index) => (
            <span key={note.url}>
              {index > 0 ? " · " : ""}
              <a href={note.url} style={{ color: "#2563eb" }}>{note.label}</a>
            </span>
          ))}
        </li>
      </ul>

      <h2 style={styles.h2}>주요 페이지 / Key Pages</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <a href="/diagnose" style={{ color: "#2563eb" }}><strong>AAO 무료 진단 / AI Delivery Diagnosis</strong></a> — Run structural lint and AI delivery checks on a company website.
        </li>
        <li style={styles.li}>
          <a href="/products" style={{ color: "#2563eb" }}><strong>제품 페이지 / Product Pages</strong></a> — Product-level source pages for AI Delivery Diagnosis, Structural Lint Reports, and AI Profile Page.
        </li>
        <li style={styles.li}>
          <a href="/insights" style={{ color: "#2563eb" }}><strong>인사이트 / Insights</strong></a> — English-first notes on AI search optimization, official-source structure, and machine-readable company facts.
        </li>
        <li style={styles.li}>
          <a href="/ai-profile/request" style={{ color: "#2563eb" }}><strong>AI 프로필 페이지 제작 요청 / Request</strong></a> — Request AI Profile Page design and deployment based on diagnosis results.
        </li>
        <li style={styles.li}>
          <a href="/ai-profile" style={{ color: "#2563eb" }}><strong>공식 AI Profile Page / Official source page</strong></a> — This page is the canonical company-level source hub for {ENTITY_LABEL}.
        </li>
      </ul>

      <h2 style={styles.h2}>{ENTITY_LABEL}이 해결하는 문제 / Problem</h2>
      <p style={styles.p}>
        생성형 AI는 기업 정보를 항상 공식 웹사이트에서 읽지 않습니다. Generative AI systems do not always use the official
        website as the primary source.
      </p>
      <p style={styles.p}>
        메인과 서브페이지에 정보가 분산되면 AI는 외부 기사·블로그·커뮤니티를 더 쉽게 참조할 수 있습니다. {ENTITY_LABEL}은
        이 구조적 격차를 진단하고 공식 facts layer로 다시 정리합니다.
      </p>

      <h2 style={styles.h2}>{ENTITY_LABEL}의 방식 / Solution</h2>
      <h3 style={styles.h3}>1. AI 전달 진단 / AI Delivery Check</h3>
      <p style={styles.p}>
        ChatGPT, Perplexity, Gemini가 현재 기업을 어떻게 설명하는지 실제 답변을 확인합니다.
      </p>
      <h3 style={styles.h3}>2. 구조 검증 / Structural Lint</h3>
      <p style={styles.p}>
        엔티티 정의, facts block, JSON-LD, 렌더링 접근성, 서브페이지 허브 구조를 정적으로 검사합니다.
      </p>
      <h3 style={styles.h3}>3. AI 프로필 페이지 설계 및 제작 / AI Profile Page</h3>
      <p style={styles.p}>
        메인 페이지에 없는 정보를 정적 HTML 기반 AI 프로필 페이지로 재구성하여 공식 출처 허브를 만듭니다.
      </p>

      <h2 style={styles.h2}>자주 묻는 질문 / FAQ</h2>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}이 무엇인가요? / What is {ENTITY_LABEL}?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL}는 {OFFICIAL_FACT_DESCRIPTION}입니다. It is an {OFFICIAL_FACT_DESCRIPTION_EN}.
      </p>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}는 무엇을 진단하나요? / What does {ENTITY_LABEL} diagnose?</h3>
      <p style={styles.p}>
        A. 웹사이트 구조 검증(린트)과 ChatGPT·Perplexity·Gemini의 실제 AI 전달 확인을 함께 수행합니다. It checks both structural lint and real AI delivery.
      </p>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}는 무료인가요? / Is {ENTITY_LABEL} free?</h3>
      <p style={styles.p}>
        A. 기본 진단은 무료입니다. Basic diagnosis is free. AI 프로필 페이지 제작과 설치는 별도 서비스로 제공합니다.
      </p>

      <h3 style={styles.h3}>Q. AI 프로필 페이지란 무엇인가요? / What is an AI Profile Page?</h3>
      <p style={styles.p}>
        A. 생성형 AI가 읽기 쉬운 정적 HTML 기반 페이지로, 기업의 핵심 정보를 일관된 구조로 제공하는 공식 출처 페이지입니다. It uses semantic HTML, JSON-LD, FAQ, and concise company facts.
      </p>

      <h3 style={styles.h3}>Q. {ENTITY_LABEL}는 다른 GEO/AEO 서비스와 무엇이 다른가요? / How is it different?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL}는 진단에서 멈추지 않고, 실제 AI 프로필 페이지를 설계·제작하는 실행형 솔루션을 제공합니다. It combines diagnosis with execution.
      </p>

      <p style={styles.meta}>
        이 페이지는 생성형 AI가 {ENTITY_LABEL}의 정보를 더 정확하게 이해할 수 있도록 설계된 공식 AI 프로필 페이지입니다. This page is the official AI Profile Page for {ENTITY_LABEL}, designed to improve machine-readable understanding.
      </p>
    </main>
  );
}
