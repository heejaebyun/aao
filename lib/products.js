import { AI_PROFILE_URL, ENTITY_LABEL, SITE_ORIGIN } from "@/lib/site-identity";

export const PRODUCTS = [
  {
    slug: "ai-delivery-diagnosis",
    name: "AI Delivery Diagnosis",
    tagline: "Measure how AI systems actually describe official company facts.",
    description:
      "Checks how ChatGPT, Gemini, and Perplexity deliver official company facts from a website and shows what each engine misses, distorts, or cites.",
    category: "AI delivery measurement",
    bestFor: "Teams that want field-level evidence of what AI systems actually deliver today.",
    output: "Engine-by-engine delivery report with missed-field and citation review.",
    includes: [
      "Prompted checks across major AI engines",
      "Official fact matching against declared source data",
      "Citation visibility review",
      "Missed-field analysis with likely causes",
    ],
    useCases: [
      "Verify whether the company description is actually delivered",
      "Check whether official facts appear with citation",
      "Compare homepage delivery against source-hub delivery",
    ],
    officialPath: "/products/ai-delivery-diagnosis",
    primaryCtaHref: "/diagnose",
    primaryCtaLabel: "Run a free diagnosis",
  },
  {
    slug: "structural-lint-reports",
    name: "Structural Lint Reports",
    tagline: "Check whether the official source layer is structurally ready for AI retrieval.",
    description:
      "Reviews entity definition, visible facts, JSON-LD, FAQ structure, and source-hub readiness before or alongside delivery testing.",
    category: "Website structure analysis",
    bestFor: "Teams that want to fix source-structure issues before chasing citations.",
    output: "A prioritized report of structural blockers and missing source-layer components.",
    includes: [
      "Entity definition checks",
      "Visible facts block validation",
      "JSON-LD alignment review",
      "FAQ and source-hub structure checks",
    ],
    useCases: [
      "Spot missing official facts on the homepage",
      "See whether facts only exist in markup or only in copy",
      "Prepare a site for AI Profile implementation",
    ],
    officialPath: "/products/structural-lint-reports",
    primaryCtaHref: "/diagnose",
    primaryCtaLabel: "Inspect structure",
  },
  {
    slug: "ai-profile-page",
    name: "AI Profile Page",
    tagline: "Create one official source hub for AI-readable company facts.",
    description:
      "Builds a dedicated, static source page with visible facts, aligned JSON-LD, official-source policy, and FAQ content for more reliable AI retrieval.",
    category: "Official source hub",
    bestFor: "Companies that need one concentrated page for machine-readable company facts.",
    output: "A dedicated official source page connected to the main domain and linked as the primary facts hub.",
    includes: [
      "Visible facts block in plain text",
      "Aligned organization schema",
      "Official-source policy section",
      "FAQ and key-page links",
    ],
    useCases: [
      "Create a stable source page for company facts",
      "Concentrate founder, description, and service information",
      "Support future product-level and agent-readable expansion",
    ],
    officialPath: "/products/ai-profile-page",
    primaryCtaHref: AI_PROFILE_URL,
    primaryCtaLabel: "View the official AI Profile",
  },
];

export function getProductBySlug(slug) {
  return PRODUCTS.find((product) => product.slug === slug) ?? null;
}

export function getProductUrl(slug) {
  return `${SITE_ORIGIN}/products/${slug}`;
}

export const PRODUCTS_COLLECTION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: `${ENTITY_LABEL} Products`,
  url: `${SITE_ORIGIN}/products`,
  hasPart: PRODUCTS.map((product) => ({
    "@type": "Service",
    name: product.name,
    url: getProductUrl(product.slug),
    description: product.description,
    serviceType: product.category,
  })),
};
