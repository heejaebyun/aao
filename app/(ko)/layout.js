import {
  ENTITY_LABEL,
  ROOT_META_DESCRIPTION,
  SITE_ORIGIN,
} from "@/lib/site-identity";

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
  return children;
}
