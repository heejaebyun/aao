import Link from "next/link";
import { INSIGHTS, INSIGHTS_COLLECTION_SCHEMA } from "@/lib/insights";
import { ENTITY_LABEL, SITE_ORIGIN } from "@/lib/site-identity";

export const metadata = {
  title: `${ENTITY_LABEL} | 인사이트 노트`,
  description: "AI 검색 최적화, 공식 출처 구조, AI가 읽기 쉬운 회사 사실에 대한 인사이트 노트입니다.",
  alternates: {
    canonical: "/insights",
  },
  openGraph: {
    title: `${ENTITY_LABEL} | 인사이트 노트`,
    description: "AI 검색 최적화와 공식 출처 구조에 대한 인사이트 노트입니다.",
    url: `${SITE_ORIGIN}/insights`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${ENTITY_LABEL} | 인사이트 노트`,
    description: "AI 검색 최적화와 공식 출처 구조에 대한 인사이트 노트입니다.",
  },
};

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: "880px",
    margin: "0 auto",
    padding: "40px 20px 72px",
    color: "#111827",
    background: "#ffffff",
  },
  hero: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "28px 28px 24px",
    marginBottom: "28px",
  },
  eyebrow: {
    display: "inline-flex",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
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
    fontSize: "1.02rem",
    color: "#4b5563",
    lineHeight: 1.8,
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
  meta: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "12px",
    color: "#6b7280",
    fontSize: "0.88rem",
  },
  title: {
    margin: "0 0 10px",
    fontSize: "1.3rem",
    lineHeight: 1.35,
  },
  summary: {
    margin: "0 0 16px",
    color: "#4b5563",
    lineHeight: 1.75,
  },
  tags: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "14px",
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
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 700,
  },
};

export default function InsightsPage() {
  return (
    <main style={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(INSIGHTS_COLLECTION_SCHEMA) }} />

      <section style={styles.hero}>
        <div style={styles.eyebrow}>INSIGHTS</div>
        <h1 style={styles.h1}>AI가 읽기 쉬운 공식 출처 인사이트 노트</h1>
        <p style={styles.lead}>
          이 노트는 AI가 회사 사실을 어떻게 읽어오는지, 왜 공식 사이트가 누락되는지, 어떤 공식 출처 구조가 전달과 인용을 개선하는지 설명합니다.
          {` `}{ENTITY_LABEL}의 공식 출처 모델을 뒷받침하는 실험과 관찰을 바탕으로 정리했습니다.
        </p>
      </section>

      <section style={styles.list}>
        {INSIGHTS.map((insight) => (
          <article key={insight.slug} style={styles.card}>
            <div style={styles.meta}>
              <span>{insight.publishedAt}</span>
              <span>{insight.readingTime}</span>
            </div>
            <h2 style={styles.title}>{insight.title}</h2>
            <p style={styles.summary}>{insight.summary}</p>
            <div style={styles.tags}>
              {insight.tags.map((tag) => (
                <span key={tag} style={styles.tag}>{tag}</span>
              ))}
            </div>
            <Link href={`/insights/${insight.slug}`} style={styles.link}>
              글 보기
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
