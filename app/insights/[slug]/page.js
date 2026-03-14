import Link from "next/link";
import { notFound } from "next/navigation";
import { FOUNDER_NAME_EN, SITE_ORIGIN } from "@/lib/site-identity";
import { getInsightBySlug, getInsightUrl, INSIGHTS } from "@/lib/insights";

export const dynamicParams = false;

export function generateStaticParams() {
  return INSIGHTS.map((insight) => ({ slug: insight.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);

  if (!insight) {
    return {};
  }

  return {
    title: insight.title,
    description: insight.description,
    alternates: {
      canonical: `/insights/${insight.slug}`,
    },
    openGraph: {
      title: insight.title,
      description: insight.description,
      url: getInsightUrl(insight.slug),
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: insight.title,
      description: insight.description,
    },
  };
}

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: "820px",
    margin: "0 auto",
    padding: "40px 20px 72px",
    color: "#111827",
    background: "#ffffff",
  },
  breadcrumb: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: "0.92rem",
    fontWeight: 700,
  },
  meta: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    color: "#6b7280",
    fontSize: "0.92rem",
    margin: "18px 0 12px",
  },
  h1: {
    fontSize: "2.4rem",
    lineHeight: 1.12,
    letterSpacing: "-0.04em",
    margin: "0 0 14px",
  },
  lead: {
    margin: "0 0 18px",
    fontSize: "1.04rem",
    lineHeight: 1.85,
    color: "#4b5563",
  },
  tags: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "28px",
  },
  tag: {
    display: "inline-flex",
    border: "1px solid #d1d5db",
    color: "#374151",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 600,
  },
  section: {
    marginBottom: "24px",
  },
  h2: {
    fontSize: "1.2rem",
    margin: "0 0 10px",
  },
  p: {
    margin: "0 0 14px",
    lineHeight: 1.85,
    color: "#1f2937",
  },
  ul: {
    margin: 0,
    paddingLeft: "20px",
    lineHeight: 1.85,
    color: "#1f2937",
  },
  cta: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px 20px",
    marginTop: "30px",
  },
  ctaLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 700,
  },
};

export default async function InsightPage({ params }) {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);

  if (!insight) {
    notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: insight.title,
    description: insight.description,
    datePublished: insight.publishedAt,
    inLanguage: "en",
    url: getInsightUrl(insight.slug),
    author: {
      "@type": "Person",
      name: FOUNDER_NAME_EN,
    },
    publisher: {
      "@type": "Organization",
      "@id": SITE_ORIGIN,
    },
    mainEntityOfPage: getInsightUrl(insight.slug),
    keywords: insight.tags.join(", "),
  };

  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <Link href="/insights" style={styles.breadcrumb}>
        Back to insights
      </Link>

      <div style={styles.meta}>
        <span>{insight.publishedAt}</span>
        <span>{insight.readingTime}</span>
        <span>{FOUNDER_NAME_EN}</span>
      </div>

      <h1 style={styles.h1}>{insight.title}</h1>
      <p style={styles.lead}>{insight.description}</p>

      <div style={styles.tags}>
        {insight.tags.map((tag) => (
          <span key={tag} style={styles.tag}>{tag}</span>
        ))}
      </div>

      {insight.sections.map((section) => (
        <section key={section.heading} style={styles.section}>
          <h2 style={styles.h2}>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} style={styles.p}>{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul style={styles.ul}>
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <section style={styles.cta}>
        <p style={styles.p}>
          Want the official source layer, not just another SEO page?
        </p>
        <p style={{ ...styles.p, marginBottom: 0 }}>
          <Link href="/ai-profile" style={styles.ctaLink}>View the official AI Profile</Link>
          {" "}or{" "}
          <Link href="/products" style={styles.ctaLink}>see the product source pages</Link>.
        </p>
      </section>
    </main>
  );
}
