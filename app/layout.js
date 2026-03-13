import { Outfit } from "next/font/google";
import {
  AI_PROFILE_URL,
  CONTACT_EMAIL,
  ENTITY_TYPE_LABEL,
  FOUNDING_YEAR,
  ENTITY_FULL_NAME,
  ENTITY_LABEL,
  ENTITY_SHORT_NAME,
  FOUNDER_NAME_EN,
  FOUNDER_NAME_KO,
  HEADQUARTERS_REGION,
  OFFICIAL_FACT_DESCRIPTION,
  PRIMARY_SERVICES_LABEL,
  ROOT_META_DESCRIPTION,
  SITE_ORIGIN,
} from "@/lib/site-identity";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: ENTITY_LABEL,
  description: ROOT_META_DESCRIPTION,
  applicationName: ENTITY_LABEL,
  openGraph: {
    title: ENTITY_LABEL,
    description: ROOT_META_DESCRIPTION,
    type: "website",
    url: SITE_ORIGIN,
    siteName: ENTITY_LABEL,
  },
  twitter: {
    card: "summary_large_image",
    title: ENTITY_LABEL,
    description: ROOT_META_DESCRIPTION,
  },
};

export default function RootLayout({ children }) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": SITE_ORIGIN,
    name: ENTITY_LABEL,
    alternateName: [ENTITY_SHORT_NAME, ENTITY_FULL_NAME, "에이에이오"],
    url: SITE_ORIGIN,
    description: OFFICIAL_FACT_DESCRIPTION,
    foundingDate: FOUNDING_YEAR,
    founder: {
      "@type": "Person",
      name: FOUNDER_NAME_KO,
      alternateName: FOUNDER_NAME_EN,
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "KR",
      addressRegion: HEADQUARTERS_REGION,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: CONTACT_EMAIL,
    },
    serviceType: ENTITY_TYPE_LABEL,
    knowsAbout: [
      ENTITY_FULL_NAME,
      "GEO (Generative Engine Optimization)",
      "AI 검색 최적화",
      "AI 프로필 페이지 제작",
      PRIMARY_SERVICES_LABEL,
    ],
  };

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_ORIGIN}#software`,
    name: ENTITY_LABEL,
    alternateName: [ENTITY_SHORT_NAME, ENTITY_FULL_NAME, "에이에이오"],
    applicationCategory: "BusinessApplication",
    description: OFFICIAL_FACT_DESCRIPTION,
    url: SITE_ORIGIN,
    operatingSystem: "Web",
    inLanguage: ["ko", "en"],
    datePublished: FOUNDING_YEAR,
    sameAs: [AI_PROFILE_URL],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KRW",
      description: "무료 진단 — 구조 검증과 AI 전달 확인 리포트를 즉시 제공",
    },
    creator: {
      "@id": SITE_ORIGIN,
      "@type": "Organization",
      name: ENTITY_LABEL,
    },
    featureList: [
      PRIMARY_SERVICES_LABEL,
      "구조 검증(린트) + AI 엔진 실제 전달 확인 2단계",
    ],
    citation: [
      {
        "@type": "ScholarlyArticle",
        name: "GEO: Generative Engine Optimization",
        publisher: "KDD 2024 (Princeton University)",
      },
      {
        "@type": "ScholarlyArticle",
        name: "WebArena: A Realistic Web Environment for Building Autonomous Agents",
        publisher: "ICLR 2024",
      },
    ],
  };

  return (
    <html lang="ko" className={outfit.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationSchema, softwareApplicationSchema]),
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "var(--font-outfit), -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
