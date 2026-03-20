import { Outfit } from "next/font/google";
import {
  AI_PROFILE_META_DESCRIPTION,
  AI_PROFILE_URL,
  CONTACT_EMAIL,
  ENTITY_FULL_NAME,
  ENTITY_LABEL,
  ENTITY_SHORT_NAME,
  ENTITY_TYPE_LABEL_EN,
  FOUNDING_YEAR,
  FOUNDER_INDIE_HACKERS_URL,
  FOUNDER_LINKEDIN_URL,
  FOUNDER_MEDIUM_URL,
  FOUNDER_NAME_EN,
  HEADQUARTERS_REGION_EN,
  OFFICIAL_EXTERNAL_PROFILES,
  OFFICIAL_FACT_DESCRIPTION_EN,
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
  description: AI_PROFILE_META_DESCRIPTION,
  applicationName: ENTITY_LABEL,
  openGraph: {
    title: ENTITY_LABEL,
    description: AI_PROFILE_META_DESCRIPTION,
    type: "website",
    url: AI_PROFILE_URL,
    siteName: ENTITY_LABEL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: ENTITY_LABEL,
    description: AI_PROFILE_META_DESCRIPTION,
  },
};

export default function EnLayout({ children }) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": SITE_ORIGIN,
    name: ENTITY_LABEL,
    alternateName: [ENTITY_SHORT_NAME, ENTITY_FULL_NAME],
    url: SITE_ORIGIN,
    description: OFFICIAL_FACT_DESCRIPTION_EN,
    foundingDate: FOUNDING_YEAR,
    founder: {
      "@type": "Person",
      name: FOUNDER_NAME_EN,
      sameAs: [FOUNDER_LINKEDIN_URL, FOUNDER_INDIE_HACKERS_URL, FOUNDER_MEDIUM_URL],
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "KR",
      addressRegion: HEADQUARTERS_REGION_EN,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: CONTACT_EMAIL,
    },
    serviceType: ENTITY_TYPE_LABEL_EN,
    sameAs: OFFICIAL_EXTERNAL_PROFILES.map((profile) => profile.url),
    hasPart: [
      { "@type": "WebPage", name: "AI Delivery Diagnosis", url: `${SITE_ORIGIN}/diagnose` },
      { "@type": "WebPage", name: "Official AI Profile", url: `${SITE_ORIGIN}/ai-profile` },
      { "@type": "WebPage", name: "Request AI Profile Page", url: `${SITE_ORIGIN}/ai-profile/request` },
    ],
    significantLink: [
      `${SITE_ORIGIN}/diagnose`,
      `${SITE_ORIGIN}/ai-profile`,
      `${SITE_ORIGIN}/ai-profile/request`,
    ],
  };

  return (
    <html lang="en" className={outfit.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationSchema]),
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "var(--font-outfit), -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
