import {
  AI_PROFILE_META_DESCRIPTION,
  AI_PROFILE_URL,
  ENTITY_LABEL,
  SITE_ORIGIN,
} from "@/lib/site-identity";

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
  return children;
}
