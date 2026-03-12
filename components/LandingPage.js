"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AI_PROFILE_PATH, ENTITY_LABEL } from "@/lib/site-identity";

export default function LandingPage() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleStart() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("웹사이트 주소를 입력해주세요.");
      return;
    }
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }
    setError("");
    router.push(`/diagnose?url=${encodeURIComponent(finalUrl)}`);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") handleStart();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#07070d", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      <header style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #1a1a2e", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1, background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AAO</span>
          <span style={{ fontSize: 11, background: "#6c63ff22", color: "#a78bfa", border: "1px solid #6c63ff44", borderRadius: 4, padding: "2px 7px", fontWeight: 700, letterSpacing: 1 }}>BETA</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <a href={AI_PROFILE_PATH} style={navLinkStyle()}>공식 AI Profile</a>
          <a href="#diagnose-start" style={navLinkStyle()}>무료 진단</a>
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
        <p style={{ fontSize: "clamp(15px, 2.5vw, 19px)", color: "#9999bb", lineHeight: 1.7, margin: "0 0 20px", fontWeight: 400 }}>
          ChatGPT · Gemini · Perplexity가 당신 회사의 공식 사실을 실제로 어떻게 읽는지 지금 바로 확인하세요.<br />
          AI가 메인 페이지를 읽고, 놓치고, 잘못 이해하는 지점을 진단합니다.
        </p>
        <p style={{ fontSize: 14, color: "#7f7fa6", lineHeight: 1.75, margin: "0 0 48px" }}>
          <strong style={{ color: "#d8d8f4" }}>{ENTITY_LABEL}</strong>는 공식 웹사이트와 <code style={inlineCodeStyle()}>/ai-profile</code> 페이지를
          AI의 1차 출처로 만들기 위해, 메인 페이지 구조와 실제 AI 전달 결과를 함께 진단하는 서비스입니다.
        </p>

        <div style={{ maxWidth: 620, margin: "0 auto 28px", background: "#0f0f1e", border: "1px solid #1a1a2e", borderRadius: 14, padding: "18px 20px", textAlign: "left" }}>
          <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, marginBottom: 10 }}>공식 사실 요약</div>
          <div style={{ fontSize: 14, color: "#d8d8f4", lineHeight: 1.8 }}>
            <div><strong>서비스명:</strong> {ENTITY_LABEL}</div>
            <div><strong>설명:</strong> {ENTITY_LABEL}는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하고, 공식 웹사이트를 AI의 1차 출처로 만들기 위한 AI 검색 최적화 서비스입니다.</div>
            <div><strong>업종:</strong> AI 검색 최적화 / AI 프로필 페이지 제작 SaaS</div>
            <div><strong>설립연도:</strong> 2026</div>
            <div><strong>대표이사:</strong> 변희재 (Heejae Byun)</div>
            <div><strong>주요 서비스:</strong> AI 전달 진단, 구조 검증 리포트, AI 프로필 페이지 설계 및 제작</div>
          </div>
        </div>

        <div id="diagnose-start" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://yourcompany.com"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "14px 18px",
                borderRadius: 10,
                border: error ? "1.5px solid #ff4444" : "1.5px solid #2a2a4a",
                background: "#12122a",
                color: "#fff",
                fontSize: 15,
                fontFamily: "'Outfit', sans-serif",
                outline: "none",
              }}
            />
            <button
              onClick={handleStart}
              style={{
                padding: "14px 28px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              무료 진단 시작
            </button>
          </div>
          {error && <div style={{ color: "#ff6b6b", fontSize: 13, textAlign: "left" }}>{error}</div>}
          <div style={{ fontSize: 12, color: "#555577", textAlign: "center" }}>무료 · 회원가입 불필요 · 구조 검증과 AI 전달 확인 동시 실행</div>
          <div style={{ fontSize: 12, color: "#7f7fa6", textAlign: "center" }}>
            공식 구조 설명이 필요하면 <a href={AI_PROFILE_PATH} style={inlineLinkStyle()}>AI Profile Page</a>를 바로 확인할 수 있습니다.
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

      <section style={{ maxWidth: 720, margin: "0 auto 80px", padding: "0 24px" }}>
          <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, marginBottom: 20, color: "#ccccee" }}>{ENTITY_LABEL}가 확인하는 것</h2>
        <p style={{ textAlign: "center", fontSize: 14, color: "#7f7fa6", lineHeight: 1.75, margin: "0 auto 32px", maxWidth: 640 }}>
          메인 페이지가 선언한 사실을 AI가 실제로 전달하는지, 서브페이지까지 도달하는지, 그리고 <code style={inlineCodeStyle()}>/ai-profile</code> 허브를 추가했을 때 무엇이 개선되는지 함께 봅니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { icon: "🤖", title: "AI 전달 확인", desc: "ChatGPT · Gemini · Perplexity가 회사명, 업종, 설명, 주요 서비스 같은 공식 사실을 실제로 가져오는지 확인합니다." },
            { icon: "🧱", title: "구조 검증", desc: "첫 문장 정의, facts block, JSON-LD, FAQ, 서브페이지 허브 구조를 린트로 먼저 검사합니다." },
            { icon: "🛠", title: "AI Profile 실행", desc: "놓친 사실을 평문 facts block과 정적 AI Profile 구조로 다시 선언해 공식 출처 허브를 만듭니다." },
          ].map((feature) => (
            <div key={feature.title} style={{ background: "#0f0f1e", border: "1px solid #1a1a2e", borderRadius: 14, padding: "28px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{feature.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "#ddddff" }}>{feature.title}</div>
              <div style={{ fontSize: 13, color: "#666688", lineHeight: 1.65 }}>{feature.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ textAlign: "center", padding: "48px 24px 80px", borderTop: "1px solid #1a1a2e" }}>
        <p style={{ color: "#666688", fontSize: 15, marginBottom: 20 }}>공식 사실이 AI에 어떻게 전달되는지 지금 바로 확인해보세요.</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              const input = document.querySelector("input");
              input?.scrollIntoView({ behavior: "smooth" });
              input?.focus();
            }}
            style={{
              padding: "14px 36px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            무료 진단 시작하기
          </button>
          <a href={AI_PROFILE_PATH} style={secondaryLinkStyle()}>공식 AI Profile 보기</a>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #1a1a2e", color: "#4f4f72", fontSize: 12 }}>
        <div style={{ marginBottom: 8 }}>{ENTITY_LABEL} · 구조 검증(린트) + AI 전달 확인 리포트</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <a href="/" style={footerLinkStyle()}>홈</a>
          <a href={AI_PROFILE_PATH} style={footerLinkStyle()}>AI Profile Page</a>
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

function secondaryLinkStyle() {
  return {
    padding: "14px 20px",
    borderRadius: 10,
    border: "1px solid #2a2a4a",
    color: "#cfcdf8",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
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
