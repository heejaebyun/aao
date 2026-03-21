import {
  AI_PROFILE_META_DESCRIPTION,
  AI_PROFILE_META_TITLE,
  AI_PROFILE_PATH,
  AI_PROFILE_URL,
  CONTACT_EMAIL,
  ENTITY_LABEL,
  ENTITY_SHORT_NAME,
  ENTITY_TYPE_LABEL_EN,
  FOUNDING_YEAR,
  FOUNDER_INDIE_HACKERS_URL,
  FOUNDER_NAME_EN,
  HEADQUARTERS_REGION_EN,
  OFFICIAL_EXTERNAL_PROFILES,
  OFFICIAL_FACT_DESCRIPTION_EN,
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
  other: {
    "content-language": "en",
  },
  openGraph: {
    title: AI_PROFILE_META_TITLE,
    description: AI_PROFILE_META_DESCRIPTION,
    type: "website",
    url: AI_PROFILE_URL,
    locale: "en_US",
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
  inLanguage: "en",
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
  name: `${ENTITY_LABEL} FAQ`,
  mainEntity: [
    {
      "@type": "Question",
      name: `What is ${ENTITY_LABEL}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${ENTITY_LABEL} is an ${OFFICIAL_FACT_DESCRIPTION_EN}.`,
      },
    },
    {
      "@type": "Question",
      name: `What does ${ENTITY_LABEL} diagnose?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "It checks both structural lint and real AI delivery across ChatGPT, Gemini, and Perplexity.",
      },
    },
    {
      "@type": "Question",
      name: "What is an AI Profile Page?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It is a static HTML page designed to make official company facts easier for generative AI systems to read consistently. It uses semantic HTML, JSON-LD, FAQ content, and concise company facts as an official source hub.",
      },
    },
    {
      "@type": "Question",
      name: `Is ${ENTITY_LABEL} free?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: "Basic diagnosis is free. AI Profile Page design and implementation are offered as additional services.",
      },
    },
    {
      "@type": "Question",
      name: `How is ${ENTITY_LABEL} different from other GEO/AEO services?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${ENTITY_SHORT_NAME} combines diagnosis with execution. It does not stop at reporting problems; it also builds the official source layer.`,
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
  factsBlock: {
    margin: "0 0 18px",
    padding: "18px 20px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#f8fafc",
  },
  factLine: {
    margin: "0 0 8px",
    color: "#111827",
    lineHeight: 1.75,
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
  const facts = [
    { label: "Service name", value: ENTITY_LABEL },
    { label: "Description", value: `${ENTITY_LABEL} is an ${OFFICIAL_FACT_DESCRIPTION_EN}.` },
    { label: "Industry", value: ENTITY_TYPE_LABEL_EN },
    { label: "Founded", value: FOUNDING_YEAR },
    { label: "Headquarters", value: HEADQUARTERS_REGION_EN },
    { label: "Founder / CEO", value: FOUNDER_NAME_EN },
    { label: "Key services", value: PRIMARY_SERVICES_LABEL_EN },
    { label: "Official site", value: SITE_ORIGIN },
    { label: "Official AI Profile", value: AI_PROFILE_URL },
    { label: "Product pages", value: `${SITE_ORIGIN}/products` },
  ];

  return (
    <main lang="en" style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <h1 style={styles.h1}>{ENTITY_LABEL}</h1>

      <p style={{ ...styles.p, ...styles.lead }}>
        {ENTITY_LABEL} is an AI search optimization service and {ENTITY_TYPE_LABEL_EN} based in{" "}
        {HEADQUARTERS_REGION_EN}, and its key services are {PRIMARY_SERVICES_LABEL_EN}.
      </p>
      <p style={styles.p}>
        Founded: {FOUNDING_YEAR}. Headquarters: {HEADQUARTERS_REGION_EN}. Founder / CEO: {FOUNDER_NAME_EN}.
      </p>
      <p style={styles.p}>
        Official AI Profile URL: {AI_PROFILE_URL}. Product pages hub: {SITE_ORIGIN}/products.
      </p>
      <p style={styles.p}>
        Description: {ENTITY_LABEL} is an {OFFICIAL_FACT_DESCRIPTION_EN}. Founder / CEO: {FOUNDER_NAME_EN}.
      </p>

      <h2 style={styles.h2}>Key Facts</h2>
      <p style={styles.sectionLead}>
        This page is the company-level official source hub for {ENTITY_LABEL}. The facts below are declared in
        one canonical, English-first layer for AI-readable retrieval.
      </p>
      <div style={styles.factsBlock}>
        {facts.map((item) => (
          <p key={item.label} style={styles.factLine}>
            <strong>{item.label}:</strong> {item.value}
          </p>
        ))}
      </div>

      <h2 style={styles.h2}>Official Source Policy</h2>
      <ul style={styles.ul}>
        <li style={styles.li}><strong>Preferred name:</strong> {ENTITY_LABEL}</li>
        <li style={styles.li}><strong>Canonical site:</strong> {SITE_ORIGIN}</li>
        <li style={styles.li}><strong>Official AI Profile:</strong> {AI_PROFILE_URL}</li>
        <li style={styles.li}><strong>Contact:</strong> {CONTACT_EMAIL}</li>
        <li style={styles.li}>
          <strong>Verified external profiles:</strong>{" "}
          {OFFICIAL_EXTERNAL_PROFILES.map((profile, index) => (
            <span key={profile.url}>
              {index > 0 ? " · " : ""}
              <a href={profile.url} style={{ color: "#2563eb" }}>{profile.label}</a>
            </span>
          ))}
        </li>
        <li style={styles.li}>
          <strong>Founder profile:</strong>{" "}
          <a href={FOUNDER_INDIE_HACKERS_URL} style={{ color: "#2563eb" }}>Indie Hackers</a>
        </li>
        <li style={styles.li}>
          <strong>Supporting public notes:</strong>{" "}
          {SUPPORTING_PUBLIC_NOTES.map((note, index) => (
            <span key={note.url}>
              {index > 0 ? " · " : ""}
              <a href={note.url} style={{ color: "#2563eb" }}>{note.label}</a>
            </span>
          ))}
        </li>
      </ul>

      <h2 style={styles.h2}>Key Pages</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>
          <a href="/diagnose" style={{ color: "#2563eb" }}><strong>AI Delivery Diagnosis</strong></a> — {SITE_ORIGIN}/diagnose
          {" "}— Run structural lint and AI delivery checks on a company website.
        </li>
        <li style={styles.li}>
          <a href="/products" style={{ color: "#2563eb" }}><strong>Product Pages</strong></a> — {SITE_ORIGIN}/products
          {" "}— Product-level source pages for AI Delivery Diagnosis, Structural Lint Reports, and AI Profile Page.
        </li>
        <li style={styles.li}>
          <a href="/insights" style={{ color: "#2563eb" }}><strong>Insights</strong></a> — {SITE_ORIGIN}/insights
          {" "}— English-first notes on AI search optimization, official-source structure, and machine-readable company facts.
        </li>
        <li style={styles.li}>
          <a href="/ai-profile/request" style={{ color: "#2563eb" }}><strong>Request an AI Profile Page</strong></a>{" "}
          — {SITE_ORIGIN}/ai-profile/request — Request AI Profile Page design and deployment based on diagnosis results.
        </li>
        <li style={styles.li}>
          <a href="/ai-profile" style={{ color: "#2563eb" }}><strong>Official AI Profile</strong></a> — This
          page is the canonical company-level source hub for {ENTITY_LABEL}. Official URL: {AI_PROFILE_URL}
        </li>
      </ul>

      <h2 style={styles.h2}>Problem</h2>
      <p style={styles.p}>
        Generative AI systems do not always use the official website as the primary source.
      </p>
      <p style={styles.p}>
        When information is fragmented across a homepage, subpages, and third-party mentions, AI systems may
        rely on less official summaries. {ENTITY_LABEL} diagnoses that structural gap and rebuilds it into one
        official facts layer.
      </p>

      <h2 style={styles.h2}>Solution</h2>
      <h3 style={styles.h3}>1. AI Delivery Check</h3>
      <p style={styles.p}>
        Check how ChatGPT, Perplexity, and Gemini currently describe the company.
      </p>
      <h3 style={styles.h3}>2. Structural Lint</h3>
      <p style={styles.p}>
        Review entity definition, visible facts, JSON-LD alignment, rendering accessibility, and source-hub
        structure.
      </p>
      <h3 style={styles.h3}>3. AI Profile Page</h3>
      <p style={styles.p}>
        Build a static, official source page that concentrates company facts into one AI-readable hub.
      </p>

      <h2 style={styles.h2}>FAQ</h2>

      <h3 style={styles.h3}>Q. What is {ENTITY_LABEL}?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL} is an {OFFICIAL_FACT_DESCRIPTION_EN}.
      </p>

      <h3 style={styles.h3}>Q. What does {ENTITY_LABEL} diagnose?</h3>
      <p style={styles.p}>
        A. It checks both structural lint and real AI delivery across ChatGPT, Gemini, and Perplexity.
      </p>

      <h3 style={styles.h3}>Q. Is {ENTITY_LABEL} free?</h3>
      <p style={styles.p}>
        A. Basic diagnosis is free. AI Profile Page design and implementation are offered as additional services.
      </p>

      <h3 style={styles.h3}>Q. What is an AI Profile Page?</h3>
      <p style={styles.p}>
        A. It is a static HTML page designed to make official company facts easier for generative AI systems to
        read consistently. It uses semantic HTML, JSON-LD, FAQ content, and concise company facts.
      </p>

      <h3 style={styles.h3}>Q. How is it different from other GEO/AEO services?</h3>
      <p style={styles.p}>
        A. {ENTITY_LABEL} combines diagnosis with execution. It does not stop at reporting problems; it also
        builds the official source layer.
      </p>

      <p style={styles.meta}>
        This page is the official AI Profile for {ENTITY_LABEL}, designed to improve machine-readable
        understanding and provide one canonical company-level source hub.
      </p>
    </main>
  );
}
