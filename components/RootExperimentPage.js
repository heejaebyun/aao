"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AI_PROFILE_PATH, ENTITY_LABEL } from "@/lib/site-identity";

const pageStyle = {
  minHeight: "100vh",
  background: "#07070d",
  color: "#fff",
  fontFamily: "'Outfit', sans-serif",
};

const sectionStyle = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "80px 24px 56px",
  textAlign: "center",
};

const leadStyle = {
  fontSize: 14,
  color: "#d4d1f6",
  lineHeight: 1.8,
  margin: "0 0 18px",
};

const inlineCodeStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#111122",
  padding: "2px 6px",
  borderRadius: 6,
  color: "#cfcdf8",
};

const inlineLinkStyle = {
  color: "#c9c7ff",
  textDecoration: "none",
  fontWeight: 600,
};

function ExperimentHeader({ label }) {
  return (
    <div
      style={{
        display: "inline-block",
        background: "#6c63ff18",
        border: "1px solid #6c63ff44",
        borderRadius: 20,
        padding: "6px 16px",
        fontSize: 13,
        color: "#a78bfa",
        marginBottom: 28,
        fontWeight: 500,
      }}
    >
      {label}
    </div>
  );
}

function DiagnoseInput() {
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
    </div>
  );
}

export default function RootExperimentPage({ label, intro, factLines }) {
  return (
    <div style={pageStyle}>
      <section style={sectionStyle}>
        <ExperimentHeader label={label} />
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: -1.5 }}>
          AI가 당신의 회사를<br />
          <span style={{ background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            정확히 알고 있을까요?
          </span>
        </h1>
        <p style={{ fontSize: "clamp(15px, 2.5vw, 19px)", color: "#9999bb", lineHeight: 1.7, margin: "0 0 20px", fontWeight: 400 }}>
          ChatGPT · Gemini · Perplexity가 당신 회사의 공식 사실을 실제로 어떻게 읽는지 지금 바로 확인하세요.<br />
          AI가 메인 페이지를 읽고, 놓치고, 잘못 이해하는 지점을 진단합니다.
        </p>
        <p style={{ fontSize: 14, color: "#7f7fa6", lineHeight: 1.8, margin: "0 0 28px" }}>{intro}</p>

        {factLines && factLines.length > 0 && (
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto 28px",
              padding: "18px 20px",
              textAlign: "left",
              background: "rgba(14,14,30,0.72)",
              border: "1px solid rgba(167,139,250,0.16)",
              borderRadius: 18,
            }}
          >
            {factLines.map((line) => (
              <p key={line} style={leadStyle}>
                {line}
              </p>
            ))}
          </div>
        )}

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
            전체 공식 사실과 공식 출처 정책은{" "}
            <a href={AI_PROFILE_PATH} style={inlineLinkStyle}>
              /ai-profile
            </a>
            에서 확인할 수 있습니다. <strong style={{ color: "#fff" }}>{ENTITY_LABEL}</strong>의 canonical source page는{" "}
            <code style={inlineCodeStyle}>/ai-profile</code>입니다.
          </p>
        </div>

        <DiagnoseInput />
      </section>
    </div>
  );
}
