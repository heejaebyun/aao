import { AI_PROFILE_URL, SITE_ORIGIN } from "@/lib/site-identity";

export default function sitemap() {
  const lastModified = new Date();
  return [
    {
      url: SITE_ORIGIN,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: AI_PROFILE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
