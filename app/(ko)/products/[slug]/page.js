import Link from "next/link";
import { notFound } from "next/navigation";
import { AI_PROFILE_URL, SITE_ORIGIN } from "@/lib/site-identity";
import { getProductBySlug, getProductUrl, PRODUCTS } from "@/lib/products";

export const dynamicParams = false;

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {};
  }

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} | ${product.tagline}`,
      description: product.description,
      url: getProductUrl(product.slug),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${product.tagline}`,
      description: product.description,
    },
  };
}

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: "860px",
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
  h1: {
    fontSize: "2.35rem",
    lineHeight: 1.12,
    letterSpacing: "-0.04em",
    margin: "18px 0 10px",
  },
  lead: {
    margin: "0 0 22px",
    color: "#4b5563",
    lineHeight: 1.85,
    fontSize: "1.04rem",
  },
  facts: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px 18px 16px",
    marginBottom: "24px",
  },
  factsTitle: {
    margin: "0 0 14px",
    fontWeight: 800,
  },
  factsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    margin: 0,
  },
  factCard: {
    margin: 0,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px 14px",
  },
  factTerm: {
    fontSize: "0.74rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "#6b7280",
    marginBottom: "6px",
  },
  factDesc: {
    margin: 0,
    lineHeight: 1.6,
  },
  section: {
    marginBottom: "24px",
  },
  h2: {
    fontSize: "1.16rem",
    margin: "0 0 10px",
  },
  p: {
    margin: "0 0 14px",
    lineHeight: 1.85,
  },
  ul: {
    margin: 0,
    paddingLeft: "20px",
    lineHeight: 1.85,
  },
  ctaRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "28px",
  },
  primaryLink: {
    display: "inline-flex",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#2563eb",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
  },
  secondaryLink: {
    display: "inline-flex",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 700,
  },
};

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: product.name,
    description: product.description,
    serviceType: product.category,
    provider: {
      "@type": "Organization",
      "@id": SITE_ORIGIN,
    },
    areaServed: "Global",
    url: getProductUrl(product.slug),
  };

  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      <Link href="/products" style={styles.breadcrumb}>
        Back to products
      </Link>

      <h1 style={styles.h1}>{product.name}</h1>
      <p style={styles.lead}>{product.tagline}</p>

      <section style={styles.facts}>
        <p style={styles.factsTitle}>Official product facts</p>
        <dl style={styles.factsGrid}>
          {[
            { label: "Category", value: product.category },
            { label: "Best for", value: product.bestFor },
            { label: "Primary output", value: product.output },
            { label: "Official URL", value: getProductUrl(product.slug) },
          ].map((item) => (
            <div key={item.label} style={styles.factCard}>
              <dt style={styles.factTerm}>{item.label}</dt>
              <dd style={styles.factDesc}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>What it does</h2>
        <p style={styles.p}>{product.description}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>What is included</h2>
        <ul style={styles.ul}>
          {product.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Typical use cases</h2>
        <ul style={styles.ul}>
          {product.useCases.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Related official source pages</h2>
        <ul style={styles.ul}>
          <li>
            <Link href="/ai-profile" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
              {AI_PROFILE_URL}
            </Link>
          </li>
          <li>
            <Link href="/insights" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
              {SITE_ORIGIN}/insights
            </Link>
          </li>
        </ul>
      </section>

      <div style={styles.ctaRow}>
        <Link href={product.primaryCtaHref} style={styles.primaryLink}>
          {product.primaryCtaLabel}
        </Link>
        <Link href="/products" style={styles.secondaryLink}>
          View all products
        </Link>
      </div>
    </main>
  );
}
