import LandingPage from "@/components/LandingPage";
import { ROOT_META_DESCRIPTION, ROOT_META_TITLE, SITE_ORIGIN } from "@/lib/site-identity";

export const metadata = {
  title: ROOT_META_TITLE,
  description: ROOT_META_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: ROOT_META_TITLE,
    description: ROOT_META_DESCRIPTION,
    url: SITE_ORIGIN,
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: ROOT_META_TITLE,
    description: ROOT_META_DESCRIPTION,
  },
};

export default function Page() {
  return <LandingPage />;
}
