import Link from "next/link";
import { PRODUCTS, PRODUCTS_COLLECTION_SCHEMA } from "@/lib/products";
import { ENTITY_LABEL, SITE_ORIGIN } from "@/lib/site-identity";

export const metadata = {
  title: `${ENTITY_LABEL} | Products`,
  description: "Official product source pages for AI Delivery Diagnosis, Structural Lint Reports, and AI Profile Page.",
  alternates: {
    canonical: "/products",
  },
  openGraph: {
    title: `${ENTITY_LABEL} | Products`,
    description: "Official product source pages for the AAO source-layer workflow.",
    url: `${SITE_ORIGIN}/products`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${ENTITY_LABEL} | Products`,
    description: "Official product source pages for the AAO source-layer workflow.",
  },
};

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: "920px",
    margin: "0 auto",
    padding: "40px 20px 72px",
    color: "#111827",
    background: "#ffffff",
  },
  hero: {
    background: "#0f172a",
    color: "#f8fafc",
    borderRadius: "22px",
    padding: "30px 28px 26px",
    marginBottom: "28px",
  },
  eyebrow: {
    display: "inline-flex",
    background: "rgba(59, 130, 246, 0.14)",
    color: "#bfdbfe",
    border: "1px solid rgba(147, 197, 253, 0.3)",
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    marginBottom: "16px",
  },
  h1: {
    fontSize: "2.4rem",
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    margin: "0 0 14px",
  },
  lead: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.85,
  },
  list: {
    display: "grid",
    gap: "18px",
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "22px 22px 20px",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },
  category: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "0.88rem",
    marginBottom: "8px",
  },
  title: {
    margin: "0 0 10px",
    fontSize: "1.28rem",
  },
  desc: {
    margin: "0 0 14px",
    color: "#4b5563",
    lineHeight: 1.75,
  },
  meta: {
    margin: "0 0 14px",
    color: "#6b7280",
    lineHeight: 1.75,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 700,
  },
};

export default function ProductsPage() {
  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PRODUCTS_COLLECTION_SCHEMA) }} />

      <section style={styles.hero}>
        <div style={styles.eyebrow}>PRODUCT SOURCE PAGES</div>
        <h1 style={styles.h1}>Official product pages for the AAO source-layer workflow</h1>
        <p style={styles.lead}>
          These pages describe what each AAO product module does, who it is for, and what official output it creates.
          They are written as product-level source pages for AI-readable retrieval and agent-facing discovery.
        </p>
      </section>

      <section style={styles.list}>
        {PRODUCTS.map((product) => (
          <article key={product.slug} style={styles.card}>
            <div style={styles.category}>{product.category}</div>
            <h2 style={styles.title}>{product.name}</h2>
            <p style={styles.desc}>{product.description}</p>
            <p style={styles.meta}><strong>Best for:</strong> {product.bestFor}</p>
            <Link href={product.officialPath} style={styles.link}>
              View official product page
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
