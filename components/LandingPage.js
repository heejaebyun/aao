"use client";

import { INSIGHTS } from "@/lib/insights";
import { PRODUCTS } from "@/lib/products";
import {
  AI_PROFILE_PATH,
  AI_PROFILE_URL,
  ENTITY_LABEL,
  FOUNDING_YEAR,
  HEADQUARTERS_REGION,
  ENTITY_TYPE_LABEL,
  FOUNDER_NAME_KO,
  SITE_ORIGIN,
} from "@/lib/site-identity";

const OFFICIAL_DISCOVERY_LINKS = [
  {
    label: "공식 AI 프로필",
    href: AI_PROFILE_PATH,
    url: AI_PROFILE_URL,
    description: "AI가 읽는 공식 회사 사실 허브",
  },
  {
    label: "llms.txt",
    href: "/llms.txt",
    url: `${SITE_ORIGIN}/llms.txt`,
    description: "LLM용 공개 탐색 경로",
  },
  {
    label: "sitemap.xml",
    href: "/sitemap.xml",
    url: `${SITE_ORIGIN}/sitemap.xml`,
    description: "공식 URL 인덱스",
  },
];

const OFFICIAL_MAIN_FACTS = [
  { label: "서비스", value: ENTITY_LABEL },
  { label: "설명", value: "기업 공식 웹사이트를 AI의 1차 출처로 만드는 AI 검색 최적화 SaaS" },
  { label: "설립", value: FOUNDING_YEAR },
  { label: "대표", value: FOUNDER_NAME_KO },
  { label: "거점", value: HEADQUARTERS_REGION },
  { label: "공식 사실 허브", value: AI_PROFILE_URL },
];

const PRODUCT_PREVIEW_COPY = {
  "ai-delivery-diagnosis": {
    category: "AI 전달 측정",
    name: "AI 전달 진단",
    tagline: "AI가 공식 회사 사실을 실제로 어떻게 설명하는지 측정합니다.",
    output: "엔진별 전달 결과와 누락 필드, 인용 상태를 리포트로 보여줍니다.",
  },
  "structural-lint-reports": {
    category: "웹사이트 구조 분석",
    name: "구조 검증 리포트",
    tagline: "공식 출처 레이어가 AI 검색에 맞게 준비됐는지 점검합니다.",
    output: "구조적 문제와 누락된 공식 출처 요소를 우선순위 리포트로 정리합니다.",
  },
  "ai-profile-page": {
    category: "공식 출처 허브",
    name: "AI 프로필 페이지",
    tagline: "AI가 읽기 쉬운 공식 회사 사실 허브를 만듭니다.",
    output: "공식 사실, JSON-LD, FAQ를 모은 전용 공식 출처 페이지를 제공합니다.",
  },
};

const INSIGHT_PREVIEW_COPY = {
  "why-ai-search-engines-miss-official-company-facts": {
    title: "왜 AI는 공식 회사 사실을 놓칠까",
    description:
      "AI 답변에서 공식 회사 사실이 빠지는 이유와, 한 개의 눈에 보이는 공식 출처 허브가 왜 중요한지 설명합니다.",
    readingTime: "3분 읽기",
  },
  "why-json-ld-alone-is-not-enough-for-ai-citation": {
    title: "왜 JSON-LD만으로는 AI 인용이 부족할까",
    description:
      "구조화 데이터만으로는 부족하고, 눈에 보이는 공식 사실과 공식 출처 구조가 함께 있어야 하는 이유를 정리합니다.",
    readingTime: "3분 읽기",
  },
};

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#07070d", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      <header style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #1a1a2e", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1, background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AAO</span>
          <span style={{ fontSize: 11, background: "#6c63ff22", color: "#a78bfa", border: "1px solid #6c63ff44", borderRadius: 4, padding: "2px 7px", fontWeight: 700, letterSpacing: 1 }}>베타</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <a href={AI_PROFILE_PATH} style={navLinkStyle()}>공식 AI 프로필</a>
          <a href="/products" style={navLinkStyle()}>모듈 소개</a>
          <a href="/insights" style={navLinkStyle()}>인사이트 노트</a>
          <a href="/diagnose" style={navLinkStyle()}>무료 진단</a>
        </nav>
      </header>

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#6c63ff18", border: "1px solid #6c63ff44", borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#a78bfa", marginBottom: 28, fontWeight: 500 }}>
          {ENTITY_LABEL} · 구조 검증(린트) + AI 전달 확인
        </div>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: -1.5 }}>
          AI가 당신의 회사를<br />
          <span style={{ background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>정확히 알고 있을까요?</span>
        </h1>
        <p style={{ fontSize: "clamp(15px, 2.5vw, 19px)", color: "#d8d8f4", lineHeight: 1.7, margin: "0 0 14px", fontWeight: 500 }}>
          {ENTITY_LABEL}는 AI 검색 최적화 SaaS입니다.
        </p>
        <p style={{ fontSize: 16, color: "#9999bb", lineHeight: 1.75, margin: "0 0 24px", fontWeight: 400 }}>
          ChatGPT · Gemini · Perplexity가 당신 회사의 공식 사실을 실제로 어떻게 읽는지 진단하고,
          공식 웹사이트와 공식 출처 허브를 AI가 읽기 쉬운 구조로 정리합니다.
        </p>
        <p style={{ fontSize: 14, color: "#7f7fa6", lineHeight: 1.75, margin: "0 0 32px" }}>
          메인은 사람을 위한 랜딩 페이지로 유지하고, 공식 사실은{" "}
          <code style={inlineCodeStyle()}>/ai-profile</code>와 공개 탐색 경로로 분리해 AI가 직접 발견할 수 있게 설계합니다.
        </p>

        <p style={{ fontSize: 14, color: "#b3b0d8", lineHeight: 1.85, margin: "0 0 28px", textAlign: "left", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          {ENTITY_LABEL}는 {FOUNDING_YEAR}년 {HEADQUARTERS_REGION}에서 {FOUNDER_NAME_KO}가 설립한 {ENTITY_TYPE_LABEL}입니다.
          AI 전달 진단, 구조 검증 리포트, AI 프로필 페이지 제작을 통해 공식 웹사이트가 AI 답변의 1차 출처가 되도록 돕습니다.
        </p>

        <div
          style={{
            maxWidth: 760,
            margin: "0 auto 32px",
            padding: "16px 20px",
            textAlign: "left",
            background: "rgba(14,14,30,0.88)",
            border: "1px solid rgba(167,139,250,0.16)",
            borderLeft: "3px solid #6c63ff",
            borderRadius: 18,
            boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "#d4d1f6", lineHeight: 1.8 }}>
            아래 공개 경로는 메인을 거치지 않아도 직접 발견할 수 있는 공식 출처 경로입니다. 전체 공식 사실과 출처 정책은{" "}
            <a href={AI_PROFILE_PATH} style={inlineLinkStyle()}>/ai-profile</a>
            를 기준으로 관리합니다.
          </p>
        </div>

        <section
          style={{
            maxWidth: 760,
            margin: "0 auto 28px",
            padding: "22px 20px",
            textAlign: "left",
            background: "linear-gradient(180deg, rgba(17,17,34,0.94), rgba(9,9,23,0.98))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            boxShadow: "0 18px 48px rgba(0,0,0,0.2)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "#f3f1ff" }}>공식 출처 허브</h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#9d9bc0", lineHeight: 1.75 }}>
            AI가 메인 링크를 따라오지 않아도 공식 출처를 직접 찾을 수 있도록 핵심 경로를 한 곳에 공개합니다.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 18 }}>
            {OFFICIAL_DISCOVERY_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  display: "block",
                  textDecoration: "none",
                  background: "rgba(108,99,255,0.08)",
                  border: "1px solid rgba(108,99,255,0.18)",
                  borderRadius: 14,
                  padding: "14px 14px 12px",
                  color: "#fff",
                }}
              >
                <div style={{ fontSize: 12, color: "#a9a6d9", marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f4ff", lineHeight: 1.6, wordBreak: "break-all" }}>{item.url}</div>
                <div style={{ fontSize: 12, color: "#8f8cb6", marginTop: 6, lineHeight: 1.6 }}>{item.description}</div>
              </a>
            ))}
          </div>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {OFFICIAL_MAIN_FACTS.map((fact) => (
              <div
                key={fact.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <dt style={{ fontSize: 12, color: "#8f8cb6", marginBottom: 4 }}>{fact.label}</dt>
                <dd style={{ margin: 0, fontSize: 14, color: "#efeefe", lineHeight: 1.7, wordBreak: "break-word" }}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div id="diagnose-start" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto", alignItems: "center" }}>
          <a
            href="/diagnose"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 240,
              padding: "18px 40px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 18,
              fontFamily: "'Outfit', sans-serif",
              whiteSpace: "nowrap",
              textDecoration: "none",
              boxShadow: "0 18px 40px rgba(108,99,255,0.24)",
            }}
          >
            진단하러 가기
          </a>
          <div style={{ fontSize: 12, color: "#555577", textAlign: "center" }}>무료 · 회원가입 불필요 · 구조 검증과 AI 전달 확인 동시 실행</div>
          <div style={{ fontSize: 12, color: "#7f7fa6", textAlign: "center" }}>
            공식 사실 허브는 <a href={AI_PROFILE_PATH} style={inlineLinkStyle()}>AI 프로필 페이지</a>에서, 공개 탐색 경로는 <a href="/llms.txt" style={inlineLinkStyle()}>llms.txt</a>와 <a href="/sitemap.xml" style={inlineLinkStyle()}>sitemap.xml</a>에서 확인할 수 있습니다.
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 720, margin: "0 auto 64px", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, textAlign: "center" }}>
          {[
            { num: "3개", label: "AI 엔진 동시 검증" },
            { num: "6개", label: "공식 facts 선언" },
            { num: "/ai-profile", label: "공식 허브 경로" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#0f0f1e", border: "1px solid #1a1a2e", borderRadius: 12, padding: "24px 12px" }}>
              <div style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{item.num}</div>
              <div style={{ fontSize: 13, color: "#666688", marginTop: 6 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 860, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, marginBottom: 18, color: "#f3f1ff" }}>공식 모듈</h2>
        <p style={{ textAlign: "center", fontSize: 14, color: "#7f7fa6", lineHeight: 1.75, margin: "0 auto 32px", maxWidth: 640 }}>
          AAO는 하나의 회사 사실 허브를 넘어, 제품 단위 공식 출처 페이지와 재사용 가능한 AI 판독용 모듈로 확장하고 있습니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {PRODUCTS.map((product) => (
            (() => {
              const preview = PRODUCT_PREVIEW_COPY[product.slug] ?? {
                category: product.category,
                name: product.name,
                tagline: product.tagline,
                output: product.output,
              };

              return (
            <a
              key={product.slug}
              href={product.officialPath}
              style={{
                display: "block",
                textDecoration: "none",
                background: "linear-gradient(180deg, rgba(17,17,34,0.92), rgba(10,10,24,0.98))",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: "22px 20px",
                color: "#fff",
                boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
              }}
            >
              <div style={{ fontSize: 11, color: "#8f8fb5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                {preview.category}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3, marginBottom: 10, color: "#f3f1ff" }}>
                {preview.name}
              </div>
              <div style={{ fontSize: 14, color: "#b3b0d8", lineHeight: 1.7, marginBottom: 14 }}>
                {preview.tagline}
              </div>
              <div style={{ fontSize: 12, color: "#7f7fa6", lineHeight: 1.7 }}>
                {preview.output}
              </div>
            </a>
              );
            })()
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 860, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, marginBottom: 18, color: "#f3f1ff" }}>자체 인사이트 노트</h2>
        <p style={{ textAlign: "center", fontSize: 14, color: "#7f7fa6", lineHeight: 1.75, margin: "0 auto 32px", maxWidth: 680 }}>
          AAO가 AI가 읽기 쉬운 출처 구조, 인용 동작, 공식 출처 발견성에 대해 실험하며 배운 내용을 정리합니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {INSIGHTS.slice(0, 2).map((insight) => (
            (() => {
              const preview = INSIGHT_PREVIEW_COPY[insight.slug] ?? {
                title: insight.title,
                description: insight.description,
                readingTime: insight.readingTime,
              };

              return (
            <a
              key={insight.slug}
              href={`/insights/${insight.slug}`}
              style={{
                display: "block",
                textDecoration: "none",
                background: "#0f0f1e",
                border: "1px solid #1a1a2e",
                borderRadius: 18,
                padding: "22px 20px",
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 11, color: "#8f8fb5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                {insight.publishedAt} · {preview.readingTime}
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35, marginBottom: 10, color: "#f3f1ff" }}>
                {preview.title}
              </div>
              <div style={{ fontSize: 14, color: "#b3b0d8", lineHeight: 1.7 }}>
                {preview.description}
              </div>
            </a>
              );
            })()
          ))}
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #1a1a2e", color: "#4f4f72", fontSize: 12 }}>
        <div style={{ marginBottom: 8 }}>{ENTITY_LABEL} · 구조 검증(린트) + AI 전달 확인 리포트</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <a href="/" style={footerLinkStyle()}>홈</a>
          <a href={AI_PROFILE_PATH} style={footerLinkStyle()}>AI 프로필</a>
          <a href="/products" style={footerLinkStyle()}>모듈 소개</a>
          <a href="/insights" style={footerLinkStyle()}>인사이트 노트</a>
          <a href="/llms.txt" style={footerLinkStyle()}>llms.txt</a>
          <a href="/sitemap.xml" style={footerLinkStyle()}>sitemap.xml</a>
        </div>
      </footer>
    </div>
  );
}

function navLinkStyle() {
  return {
    color: "#8e8eb6",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 600,
  };
}

function inlineLinkStyle() {
  return {
    color: "#c9c7ff",
    textDecoration: "none",
    fontWeight: 600,
  };
}

function footerLinkStyle() {
  return {
    color: "#7f7fa6",
    textDecoration: "none",
    fontSize: 12,
  };
}

function inlineCodeStyle() {
  return {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    background: "#111122",
    padding: "2px 6px",
    borderRadius: 6,
    color: "#cfcdf8",
  };
}
