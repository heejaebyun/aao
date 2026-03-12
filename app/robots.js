import { SITE_ORIGIN } from "@/lib/site-identity";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ai-profile", "/llms.txt"],
        disallow: ["/api/", "/diagnose", "/ai-profile/request", "/ai-profile/ops/", "/ai-profile/cases/"],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
