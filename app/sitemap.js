import { INSIGHTS } from "@/lib/insights";
import { PRODUCTS } from "@/lib/products";
import { AI_PROFILE_URL, SITE_ORIGIN } from "@/lib/site-identity";

export default function sitemap() {
  const lastModified = new Date();
  const staticEntries = [
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
    {
      url: `${SITE_ORIGIN}/products`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_ORIGIN}/insights`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const productEntries = PRODUCTS.map((product) => ({
    url: `${SITE_ORIGIN}${product.officialPath}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const insightEntries = INSIGHTS.map((insight) => ({
    url: `${SITE_ORIGIN}/insights/${insight.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticEntries, ...productEntries, ...insightEntries];
}
