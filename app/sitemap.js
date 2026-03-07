import { AI_PROFILE_URL, SITE_ORIGIN } from "@/lib/site-identity";

export default function sitemap() {
  return [
    {
      url: SITE_ORIGIN,
      lastModified: "2026-03-07",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: AI_PROFILE_URL,
      lastModified: "2026-03-07",
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
