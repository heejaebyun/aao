"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      finalUrl = "https://" + finalUrl;
    }
    setError("");
    router.push(`/diagnose?url=${encodeURIComponent(finalUrl)}`);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleStart();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#07070d", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <header style={{ padding: "20px 32px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1a2e" }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1, background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AAO</span>
        <span style={{ fontSize: 11, background: "#6c63ff22", color: "#a78bfa", border: "1px solid #6c63ff44", borderRadius: 4, padding: "2px 7px", fontWeight: 700, letterSpacing: 1 }}>BETA</span>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 48px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#6c63ff18", border: "1px solid #6c63ff44", borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#a78bfa", marginBottom: 28, fontWeight: 500 }}>
          Princeton GEO Research 기반 AI 가시성 진단
        </div>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: -1.5 }}>
          AI가 당신의 회사를<br />
          <span style={{ background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>정확히 알고 있을까요?</span>
        </h1>
        <p style={{ fontSize: "clamp(15px, 2.5vw, 19px)", color: "#9999bb", lineHeight: 1.7, margin: "0 0 48px", fontWeight: 400 }}>
          ChatGPT · Gemini · Perplexity가 귀사를 어떻게 소개하는지 지금 바로 확인하세요.<br />
          AI 검색 시대, 보이지 않으면 존재하지 않는 것입니다.
        </p>

        {/* URL Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(""); }}
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
          <div style={{ fontSize: 12, color: "#555577", textAlign: "center" }}>무료 · 회원가입 불필요 · 30초 소요</div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ maxWidth: 720, margin: "0 auto 64px", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, textAlign: "center" }}>
          {[
            { num: "3개", label: "AI 엔진 동시 검증" },
            { num: "100점", label: "GEO 진단 점수" },
            { num: "30초", label: "진단 소요 시간" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0f0f1e", border: "1px solid #1a1a2e", borderRadius: 12, padding: "24px 12px" }}>
              <div style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.num}</div>
              <div style={{ fontSize: 13, color: "#666688", marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 720, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, marginBottom: 32, color: "#ccccee" }}>AAO가 진단하는 것</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { icon: "🤖", title: "AI 답변 확인", desc: "ChatGPT · Gemini · Perplexity가 귀사를 실제로 어떻게 소개하는지 직접 확인합니다." },
            { icon: "📊", title: "3축 GEO 진단", desc: "Princeton 연구 기반 PACP · SEP · SPF 3개 축으로 AI 가시성을 정밀 측정합니다." },
            { icon: "🔧", title: "개선 리포트", desc: "점수를 높이기 위한 구체적인 액션 아이템을 우선순위와 함께 제공합니다." },
          ].map(f => (
            <div key={f.title} style={{ background: "#0f0f1e", border: "1px solid #1a1a2e", borderRadius: 14, padding: "28px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: "#ddddff" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#666688", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ textAlign: "center", padding: "48px 24px 80px", borderTop: "1px solid #1a1a2e" }}>
        <p style={{ color: "#666688", fontSize: 15, marginBottom: 20 }}>AI 시대에 뒤처지지 마세요. 지금 바로 무료로 진단해보세요.</p>
        <button
          onClick={() => { const el = document.querySelector("input"); el?.scrollIntoView({ behavior: "smooth" }); el?.focus(); }}
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
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #1a1a2e", color: "#333355", fontSize: 12 }}>
        AAO — AI Answer Optimization · Based on Princeton GEO Research (KDD 2024)
      </footer>
    </div>
  );
}
