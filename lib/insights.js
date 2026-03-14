import { ENTITY_LABEL, FOUNDER_NAME_EN, SITE_ORIGIN } from "@/lib/site-identity";

export const INSIGHTS = [
  {
    slug: "why-ai-search-engines-miss-official-company-facts",
    title: "Why AI Search Engines Miss Official Company Facts",
    description:
      "Why official company facts go missing in AI answers, and why one visible source hub matters more than most teams expect.",
    summary:
      "AI systems often answer with fragmented or third-party descriptions because the official source is not structured for machine-readable retrieval.",
    publishedAt: "2026-03-13",
    readingTime: "3 min read",
    tags: ["AI search optimization", "official sources", "company facts"],
    sections: [
      {
        heading: "Why this problem exists",
        paragraphs: [
          "AI search engines do not always use the official website as the primary source. Even when a company has a polished homepage, the facts that matter most are often missing from the visible structure or scattered across multiple subpages.",
          "That creates a simple but costly gap: the company knows what is true, but the AI system does not reliably deliver the same facts in an answer.",
        ],
      },
      {
        heading: "Common failure patterns",
        bullets: [
          "The homepage is designed for human visitors, not for machine-readable retrieval.",
          "Key facts only exist in subpages, nav menus, or long-form marketing copy.",
          "Official descriptions are mixed with slogans, claims, and secondary messages.",
          "Third-party articles are easier for the model to summarize than the official site.",
        ],
      },
      {
        heading: "What works better",
        paragraphs: [
          "The strongest pattern is to concentrate official company facts into one source layer: visible facts in plain text, aligned JSON-LD, short FAQ answers, and one official profile page that acts as the source hub.",
          `${ENTITY_LABEL} focuses on that source-layer problem first. Before chasing distribution, the official facts have to be visible, repeatable, and easy for AI systems to retrieve.`,
        ],
      },
    ],
  },
  {
    slug: "why-json-ld-alone-is-not-enough-for-ai-citation",
    title: "Why JSON-LD Alone Is Not Enough for AI Citation",
    description:
      "Structured data helps, but it is rarely sufficient on its own if visible facts and official-source structure are weak.",
    summary:
      "Many teams assume valid JSON-LD is enough for AI citation. In practice, AI systems still miss key facts unless those facts are reinforced in visible text and connected through a clear source hub.",
    publishedAt: "2026-03-13",
    readingTime: "3 min read",
    tags: ["JSON-LD", "AI citation", "schema.org"],
    sections: [
      {
        heading: "Why JSON-LD helps but still fails",
        paragraphs: [
          "Structured data is useful because it turns company facts into explicit objects. But many AI systems do not reliably extract every important field from markup alone.",
          "When description, industry, founder, or headquarters only exist in JSON-LD, models may ignore them, paraphrase them poorly, or fall back to less official sources.",
        ],
      },
      {
        heading: "What AI systems usually prefer",
        bullets: [
          "Visible facts in plain text",
          "Aligned JSON-LD using the same values",
          "A dedicated source hub page with official links",
          "Short FAQ-style answers for repeated retrieval",
        ],
      },
      {
        heading: "What to do instead",
        paragraphs: [
          "A better approach is to declare the same official facts across multiple layers: visible facts block, aligned JSON-LD, dedicated AI Profile Page, and internal links that make the source hub discoverable.",
          `${ENTITY_LABEL} treats JSON-LD as one layer of the source system, not the final answer. Citation usually improves when the structure, visibility, and source concentration all improve together.`,
        ],
      },
    ],
  },
];

export function getInsightBySlug(slug) {
  return INSIGHTS.find((insight) => insight.slug === slug) ?? null;
}

export function getInsightUrl(slug) {
  return `${SITE_ORIGIN}/insights/${slug}`;
}

export const INSIGHTS_COLLECTION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: `${ENTITY_LABEL} Insights`,
  url: `${SITE_ORIGIN}/insights`,
  inLanguage: "en",
  hasPart: INSIGHTS.map((insight) => ({
    "@type": "BlogPosting",
    headline: insight.title,
    url: getInsightUrl(insight.slug),
    datePublished: insight.publishedAt,
    author: {
      "@type": "Person",
      name: FOUNDER_NAME_EN,
    },
    description: insight.description,
  })),
};
