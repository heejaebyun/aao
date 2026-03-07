import { Outfit } from "next/font/google";
import {
  AI_PROFILE_URL,
  CONTACT_EMAIL,
  ENTITY_FULL_NAME,
  ENTITY_LABEL,
  ENTITY_SHORT_NAME,
  FOUNDER_NAME_EN,
  FOUNDER_NAME_KO,
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
  return (
    <html lang="ko" className={outfit.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: ENTITY_LABEL,
              alternateName: [ENTITY_SHORT_NAME, ENTITY_FULL_NAME, "에이에이오"],
              applicationCategory: "BusinessApplication",
              description: ROOT_META_DESCRIPTION,
              url: SITE_ORIGIN,
              operatingSystem: "Web",
              inLanguage: ["ko", "en"],
              datePublished: "2026",
              sameAs: [AI_PROFILE_URL],
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "KRW",
                description: "무료 진단 — AI 가시성 3축 점수 + 개선 리포트 즉시 제공",
              },
              creator: {
                "@type": "Organization",
                name: ENTITY_LABEL,
                alternateName: [ENTITY_SHORT_NAME, ENTITY_FULL_NAME],
                url: SITE_ORIGIN,
                email: CONTACT_EMAIL,
                description:
                  "AI Answer Optimization. AI 검색 최적화 전문 서비스. AI Profile Page 설치 시 AI 가시성 +40~60점 향상.",
                founder: {
                  "@type": "Person",
                  name: FOUNDER_NAME_KO,
                  alternateName: FOUNDER_NAME_EN,
                },
                foundingDate: "2026",
                knowsAbout: [
                  ENTITY_FULL_NAME,
                  "GEO (Generative Engine Optimization)",
                  "AI 검색 최적화",
                  "Princeton GEO Research",
                  "LLM 가시성 진단",
                ],
              },
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
            }),
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "var(--font-outfit), -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
