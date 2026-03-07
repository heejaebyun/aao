// components/Dashboard.js
"use client";
import { useState, useEffect } from "react";
import { deriveGateSummary } from "@/lib/gate-analysis";

const C = {
  bg: "#07070d", surface: "#0e0e18", card: "#121220",
  border: "#1e1e35", text: "#e4e4f0", textMuted: "#8585a0", textDim: "#4a4a65",
  accent: "#ff2d55", accentGlow: "rgba(255,45,85,0.12)",
  g1: "#ff2d55", g2: "#7928ca",
  success: "#00e87b", successBg: "rgba(0,232,123,0.08)",
  warning: "#ffb820", warningBg: "rgba(255,184,32,0.08)",
  danger: "#ff3b4f", dangerBg: "rgba(255,59,79,0.08)",
  info: "#38bdf8", infoBg: "rgba(56,189,248,0.08)",
  pacp: "#ff6b35", sep: "#38bdf8", spf: "#a855f7",
};

const ENGINES = [
  { id: "chatgpt", name: "ChatGPT", icon: "🤖", color: "#10a37f" },
  { id: "perplexity", name: "Perplexity", icon: "🔮", color: "#20b2aa" },
  { id: "gemini", name: "Gemini", icon: "✦", color: "#4285f4" },
];

const AXES = [
  { id: "pacp", name: "PACP", nameKo: "위치 기반 인용 확률", max: 40, color: C.pacp, icon: "📍",
    desc: "AI가 이 페이지를 1차 출처로 인용할 확률",
    subs: [
      { id: "high_trust_signals", name: "고신뢰 시그널", max: 8 },
      { id: "inverted_pyramid", name: "역피라미드 구조", max: 8 },
      { id: "citation_worthy", name: "인용 가능 문장", max: 8 },
      { id: "factual_completeness", name: "팩트 완전성", max: 8 },
      { id: "authority_signals", name: "권위 시그널", max: 8 },
    ]},
  { id: "sep", name: "SEP", nameKo: "의미론적 엔티티 정밀도", max: 30, color: C.sep, icon: "🎯",
    desc: "AI가 엔티티와 사실을 혼동 없이 이해하는 정도",
    subs: [
      { id: "entity_clarity", name: "엔티티 명확성", max: 6 },
      { id: "info_density", name: "정보 밀도", max: 6 },
      { id: "semantic_unambiguity", name: "의미 비모호성", max: 6 },
      { id: "kg_alignment", name: "지식그래프 정합성", max: 6 },
      { id: "multilingual", name: "다국어 일관성", max: 6 },
    ]},
  { id: "spf", name: "SPF", nameKo: "구조적 파싱 충실도", max: 30, color: C.spf, icon: "🏗️",
    desc: "AI 크롤러가 기술적으로 접근/파싱할 수 있는 정도",
    subs: [
      { id: "heading_hierarchy", name: "헤딩 계층", max: 6 },
      { id: "rendering_access", name: "렌더링 접근성", max: 6 },
      { id: "structured_data", name: "구조화 데이터", max: 6 },
      { id: "token_efficiency", name: "토큰 효율성", max: 6 },
      { id: "chunking_friendly", name: "청킹 친화도", max: 6 },
    ]},
];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

function getGrade(s) {
  if (s >= 90) return { grade: "A+", color: C.success, ko: "AI 1차 출처 가능" };
  if (s >= 80) return { grade: "A", color: C.success, ko: "정확한 이해 가능" };
  if (s >= 60) return { grade: "B", color: C.warning, ko: "부분적 이해" };
  if (s >= 40) return { grade: "C", color: "#ff9100", ko: "상당 부분 인식 불가" };
  return { grade: "D", color: C.danger, ko: "전면 개편 필요" };
}

function friendlyError(msg) {
  if (!msg) return "진단 중 오류가 발생했습니다. 다시 시도해주세요.";
  if (msg.includes("crawl") || msg.includes("Jina")) return "해당 URL을 분석할 수 없습니다. URL이 정확한지 확인해주세요.";
  if (msg.includes("401") || msg.includes("403") || msg.includes("API key")) return "서비스가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.";
  if (msg.includes("parse") || msg.includes("JSON")) return "진단 결과를 생성하지 못했습니다. 다시 시도해주세요.";
  if (msg.includes("OpenAI") || msg.includes("400")) return "AI 진단 중 오류가 발생했습니다. 다시 시도해주세요.";
  return msg;
}

function getRecognitionMeta(result) {
  const matchStatus = result?.matchStatus || (result?.knows ? "recognized" : "unknown");

  if (matchStatus === "recognized") {
    return {
      label: "정확히 인식",
      color: C.success,
      bg: C.successBg,
    };
  }

  if (matchStatus === "misidentified") {
    return {
      label: "오인식",
      color: C.warning,
      bg: C.warningBg,
    };
  }

  if (matchStatus === "error") {
    return {
      label: "오류",
      color: C.danger,
      bg: C.dangerBg,
    };
  }

  return {
    label: "미인식",
    color: C.danger,
    bg: C.dangerBg,
  };
}

function getGateStatusMeta(status) {
  if (status === "pass") {
    return { label: "통과", color: C.success, bg: C.successBg };
  }
  if (status === "warn") {
    return { label: "주의", color: C.warning, bg: C.warningBg };
  }
  return { label: "실패", color: C.danger, bg: C.dangerBg };
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function AnimNum({ value, dur = 1200 }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let s = 0; const step = value / (dur / 16);
    const t = setInterval(() => { s += step; if (s >= value) { setD(value); clearInterval(t); } else setD(Math.floor(s)); }, 16);
    return () => clearInterval(t);
  }, [value, dur]);
  return <>{d}</>;
}

function Ring({ score, max = 100, size = 170, color }) {
  const [a, setA] = useState(0);
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const safeMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100;
  const pct = (safeScore / safeMax) * 100;
  const r = (size - 16) / 2, ci = 2 * Math.PI * r;
  useEffect(() => { setTimeout(() => setA(pct), 150); }, [pct]);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={ci} strokeDashoffset={ci - (a / 100) * ci} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${color}50)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.26, fontWeight: 800, color, fontFamily: "'Outfit',sans-serif", letterSpacing: "-2px" }}><AnimNum value={safeScore} /></div>
        <div style={{ fontSize: size * 0.1, color: C.textDim, fontFamily: "'Outfit',sans-serif" }}>/ {safeMax}</div>
      </div>
    </div>
  );
}

function AxisCard({ axis, data, delay = 0 }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), delay); }, [delay]);
  const score = data?.score || 0;
  const subscores = data?.subscores || {};
  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: 18, border: `1px solid ${C.border}`,
      borderTop: `3px solid ${axis.color}`, opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(14px)",
      transition: "all 0.6s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 16 }}>{axis.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: axis.color, fontFamily: "'Outfit',sans-serif" }}>{axis.name}</span>
            <span style={{ fontSize: 10, color: C.textDim }}>{axis.nameKo}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textMuted }}>{axis.desc}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: axis.color, fontFamily: "'Outfit',sans-serif" }}>{score}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>/ {axis.max}</div>
        </div>
      </div>
      {axis.subs.map((sub, i) => {
        const val = subscores[sub.id]?.score ?? 0;
        const w = (val / sub.max) * 100;
        const finding = subscores[sub.id]?.finding || "";
        return (
          <div key={sub.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>{sub.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: w >= 70 ? C.success : w >= 40 ? C.warning : C.danger, fontFamily: "'Outfit',sans-serif" }}>{val}/{sub.max}</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, width: `${w}%`, background: axis.color, transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 80}ms`, opacity: 0.85 }} />
            </div>
            {finding && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, lineHeight: 1.4 }}>{finding}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ initialUrl = "" }) {
  const isMobile = useIsMobile();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [diagnosis, setDiagnosis] = useState(null);
  const [extendedDiagnosis, setExtendedDiagnosis] = useState(null);
  const [aiResults, setAiResults] = useState(null);
  const [tab, setTab] = useState("summary");
  const [error, setError] = useState(null);
  const [crawlData, setCrawlData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialUrl) scan();
  }, []);

  const scan = async () => {
    const target = url || initialUrl;
    if (!target.trim()) return;
    setLoading(true); setDiagnosis(null); setExtendedDiagnosis(null); setAiResults(null); setError(null); setCrawlData(null);

    try {
      setPhase("웹페이지 분석 중...");
      const diagRes = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });

      if (!diagRes.ok) {
        const err = await readJsonSafely(diagRes);
        throw new Error(err.error || "진단 실패");
      }

      setPhase("AI 진단 수행 중...");
      const diagData = await readJsonSafely(diagRes);
      setDiagnosis(diagData.diagnosis);
      setExtendedDiagnosis(diagData.extendedDiagnosis);
      setCrawlData(diagData.crawl);
      setPhase("AI 엔진 답변 확인 중...");

      const parsedTarget = new URL(target);
      const domain = parsedTarget.hostname.replace(/^www\./, "");
      const companyName = diagData.diagnosis?.company_name || diagData.crawl?.title || domain.split(".")[0];
      const aliases = Array.from(
        new Set([
          diagData.diagnosis?.company_name,
          diagData.crawl?.title,
          diagData.crawl?.description,
        ].filter(Boolean))
      );

      const aiRes = await fetch("/api/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          domain,
          officialTitle: diagData.crawl?.title || "",
          officialDescription: diagData.crawl?.description || "",
          aliases,
        }),
      });

      if (aiRes.ok) {
        setPhase("리포트 생성 중...");
        const aiData = await readJsonSafely(aiRes);
        setAiResults(aiData.results);
      }

      setTab("summary");
    } catch (e) {
      console.error("Scan error:", e);
      setError(friendlyError(e.message));
    } finally {
      setLoading(false);
      setPhase("");
    }
  };

  const handleShare = () => {
    if (!diagnosis) return;
    const text = `🔍 AI 검색 최적화 진단 결과\n\n${diagnosis.company_name} — ${diagnosis.grade} (${diagnosis.overall_score}/100점)\n\n📍 PACP (인용 확률): ${diagnosis.pacp?.score}/40\n🎯 SEP (엔티티 정밀도): ${diagnosis.sep?.score}/30\n🏗️ SPF (파싱 충실도): ${diagnosis.spf?.score}/30\n\n${diagnosis.customer_summary?.headline || ""}\n\n무료 진단: ${window.location.origin}/diagnose`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabs = [
    { id: "summary", ko: "진단 결과", en: "Summary" },
    { id: "aicheck", ko: "AI 답변 확인", en: "AI Reality Check" },
    { id: "improve", ko: "개선 리포트", en: "Report" },
    { id: "detail", ko: "상세 기술 진단", en: "Technical Detail" },
    { id: "rawdata", ko: "크롤링 원문", en: "Raw Data" },
  ];

  const g = diagnosis ? getGrade(diagnosis.overall_score) : null;
  const extendedGrade = extendedDiagnosis ? getGrade(extendedDiagnosis.overall_score) : null;
  const improvements = diagnosis?.improvements || [];
  const potentialGain = improvements.reduce((s, i) => s + (parseInt(i.expected_impact) || 0), 0);
  const gap = crawlData?.gap || null;
  const extras = crawlData?.extras || [];
  const gapScore = diagnosis && extendedDiagnosis ? Math.max(0, extendedDiagnosis.overall_score - diagnosis.overall_score) : 0;
  const gapActions = gap?.actions || [];
  const hiddenPages = gap?.hiddenPages || [];
  const promotedSnippets = gap?.promotedSnippets || [];
  const gateSummary = deriveGateSummary({ crawlData, diagnosis, aiResults });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Pretendard',-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, padding: "14px 20px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${C.g1},${C.g2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>A</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 15, background: `linear-gradient(135deg,${C.g1},${C.g2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AAO</span>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${C.warning}20`, color: C.warning, fontWeight: 700, letterSpacing: "0.5px" }}>BETA</span>
              {!isMobile && <span style={{ fontSize: 9, color: C.textDim, letterSpacing: "1px" }}>AI Answer Optimization</span>}
            </div>
          </a>
          <div style={{ fontSize: 9, color: C.textDim, fontFamily: "'Outfit',sans-serif" }}>{isMobile ? "Princeton GEO" : "Princeton GEO Based · PACP · SEP · SPF"}</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "16px" : "24px 20px" }}>
        {/* Hero */}
        {!diagnosis && !loading && (
          <div style={{ textAlign: "center", paddingTop: isMobile ? 24 : 44, paddingBottom: 24 }}>
            <h1 style={{ fontFamily: "'Outfit',sans-serif", fontSize: isMobile ? 24 : 36, fontWeight: 800, letterSpacing: "-2px", background: `linear-gradient(135deg,#fff,${C.textMuted})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10, lineHeight: 1.2 }}>
              AI가 당신의 회사를<br />정확히 설명할 수 있나요?
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 10 }}>프린스턴 GEO 연구 기반 3축 진단</p>
            {!isMobile && (
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 32 }}>
                {AXES.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: a.color }} />
                    <span style={{ fontSize: 10, color: C.textMuted }}>{a.name}</span>
                    <span style={{ fontSize: 9, color: C.textDim }}>{a.nameKo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* URL Input */}
        <div style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          gap: 8, background: C.surface, borderRadius: 12, padding: 4,
          border: `1px solid ${C.border}`, boxShadow: `0 8px 28px rgba(0,0,0,0.4)`,
          marginBottom: diagnosis ? 24 : 0,
        }}>
          <input type="text" placeholder="https://your-company.com" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && scan()}
            style={{ flex: 1, padding: "11px 14px", background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, fontFamily: "'Outfit',sans-serif" }} />
          <button onClick={scan} disabled={loading || !url.trim()} style={{
            padding: isMobile ? "12px" : "10px 22px", borderRadius: 9, border: "none", cursor: loading ? "wait" : "pointer",
            background: loading ? C.border : `linear-gradient(135deg,${C.g1},${C.g2})`,
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
            boxShadow: loading ? "none" : `0 4px 14px ${C.accentGlow}`, opacity: !url.trim() ? 0.4 : 1,
          }}>{loading ? "분석 중..." : "진단하기"}</button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}30`, borderRadius: 10, padding: 14, marginTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.danger, marginBottom: 4 }}>진단 실패</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{error}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 50, height: 50, margin: "0 auto 18px", borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{phase}</div>
          </div>
        )}

        {/* Toast */}
        {copied && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.success, color: "#000", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: "0 4px 20px rgba(0,232,123,0.4)" }}>
            ✅ 복사 완료!
          </div>
        )}

        {/* Results */}
        {diagnosis && (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 3, marginBottom: 20, background: C.surface, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, overflowX: "auto" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: isMobile ? "0 0 auto" : 1, padding: isMobile ? "8px 10px" : "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === t.id ? `linear-gradient(135deg,${C.g1}15,${C.g2}15)` : "transparent",
                  color: tab === t.id ? C.text : C.textDim, fontSize: isMobile ? 11 : 12, fontWeight: 600, whiteSpace: "nowrap",
                  border: tab === t.id ? `1px solid ${C.accent}25` : "1px solid transparent",
                }}>
                  {t.ko}{!isMobile && <span style={{ display: "block", fontSize: 9, opacity: 0.5, marginTop: 1, fontFamily: "'Outfit',sans-serif" }}>{t.en}</span>}
                </button>
              ))}
            </div>

            {/* Summary — 고객용 */}
            {tab === "summary" && diagnosis?.customer_summary && (
              <div>
                <div style={{ background: C.card, borderRadius: 16, padding: isMobile ? 20 : 28, border: `1px solid ${C.border}`, textAlign: "center", marginBottom: 20 }}>
                  <Ring score={diagnosis.overall_score} color={g.color} />
                  <div style={{ marginTop: 16, fontSize: 20, fontWeight: 800, color: g.color, fontFamily: "'Outfit',sans-serif" }}>{g.grade}</div>
                  {diagnosis.company_name && <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>{diagnosis.company_name}</div>}
                  <div style={{ marginTop: 16, fontSize: isMobile ? 14 : 16, fontWeight: 700, color: C.text, lineHeight: 1.6 }}>
                    {diagnosis.customer_summary.headline}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: C.textMuted, lineHeight: 1.7, maxWidth: 600, margin: "10px auto 0" }}>
                    {diagnosis.customer_summary.detail}
                  </div>
                </div>

                {gateSummary && (
                  <div style={{ background: C.card, borderRadius: 14, padding: 18, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1.2px" }}>Frontline Gates</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{gateSummary.headline}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, marginBottom: 14 }}>
                      AI가 브랜드를 선택하기 전에 거치는 앞단 레이어를 현재 진단 데이터 기준으로 요약한 결과입니다.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
                      {gateSummary.gates.map((gate) => {
                        const meta = getGateStatusMeta(gate.status);
                        return (
                          <div key={gate.id} style={{ background: C.surface, borderRadius: 10, padding: 12, border: `1px solid ${meta.color}25` }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                              <div>
                                <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'Outfit',sans-serif" }}>{gate.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{gate.title}</div>
                              </div>
                              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700, background: meta.bg, color: meta.color }}>
                                {meta.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
                              {gate.reason}
                            </div>
                            <div style={{ display: "grid", gap: 4 }}>
                              {gate.evidence.map((item) => (
                                <div key={item} style={{ fontSize: 10, color: C.textDim }}>
                                  · {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                      {gateSummary.note}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div style={{ background: C.card, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1.2px" }}>Official Score</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>📊 메인 페이지 기준: {diagnosis.overall_score}점/100점</div>
                    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
                      AI가 메인 페이지에서 직접 읽을 수 있는 정보만으로 평가한 공식 진단 점수입니다.
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: g.color, fontWeight: 700 }}>{g.grade} · {g.ko}</div>
                  </div>

                  <div style={{ background: C.card, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1.2px" }}>Extended Discovery</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                      📂 서브페이지 포함 시: {extendedDiagnosis?.overall_score ?? diagnosis.overall_score}점/100점
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
                      {extendedDiagnosis
                        ? `${hiddenPages.map((page) => new URL(page).pathname || "/").join(", ")} 등에서 추가 정보를 발견했습니다.`
                        : "현재는 메인 페이지와 서브페이지 사이에 의미 있는 정보 차이가 크지 않습니다."}
                    </div>
                    {extendedDiagnosis && (
                      <div style={{ marginTop: 10, fontSize: 11, color: extendedGrade.color, fontWeight: 700 }}>
                        {extendedGrade.grade} · 메인 대비 +{gapScore}점
                      </div>
                    )}
                  </div>
                </div>

                {gap && (
                  <div style={{ background: `linear-gradient(135deg,${C.warning}08,${C.danger}08)`, borderRadius: 14, padding: 20, border: `1px solid ${C.warning}20`, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                      ⚠️ Gap 분석: {gapScore}점 차이
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, marginBottom: 12 }}>
                      {gap.summary}
                    </div>
                    {gap.hasMeaningfulExtraContent && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                          아래 정보가 메인 페이지에 없고 서브페이지에만 존재합니다:
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {gap.newlyDiscoveredHeadings?.length > 0 ? gap.newlyDiscoveredHeadings.map((heading, i) => {
                            const sourcePage = extras.find((page) =>
                              page.metadata?.headingStructure?.h1Texts?.includes(heading) ||
                              page.metadata?.headingStructure?.h2Texts?.includes(heading)
                            );
                            const sourcePath = sourcePage ? new URL(sourcePage.url).pathname || "/" : "서브페이지";
                            return (
                              <div key={heading + i} style={{ fontSize: 12, color: C.text, background: C.surface, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                                - {heading} <span style={{ color: C.textDim }}>→ {sourcePath}에만 존재</span>
                              </div>
                            );
                          }) : (
                            hiddenPages.map((page) => (
                              <div key={page} style={{ fontSize: 12, color: C.text, background: C.surface, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                                - 추가 회사 정보 <span style={{ color: C.textDim }}>→ {new URL(page).pathname || "/"}에만 존재</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {gapActions.length > 0 && (
                      <div style={{ background: `${C.info}08`, borderRadius: 10, padding: 14, border: `1px solid ${C.info}20` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>💡 개선 방법</div>
                        {gapActions.map((action, i) => (
                          <div key={i} style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, marginBottom: i === gapActions.length - 1 ? 0 : 6 }}>
                            {action}
                          </div>
                        ))}
                      </div>
                    )}
                    {promotedSnippets.length > 0 && (
                      <div style={{ background: `${C.success}08`, borderRadius: 10, padding: 14, border: `1px solid ${C.success}20`, marginTop: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>✍️ 메인 페이지에 심을 추천 문장</div>
                        {promotedSnippets.map((snippet, i) => (
                          <div key={`${snippet.sourceUrl}-${i}`} style={{ background: C.surface, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}`, marginBottom: i === promotedSnippets.length - 1 ? 0 : 8 }}>
                            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7 }}>{snippet.text}</div>
                            <div style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>
                              출처: {snippet.sourcePath}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>왜 이런 점수가 나왔나요?</div>
                  {diagnosis.customer_summary.causes.map((cause, i) => (
                    <div key={i} style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.danger}`, marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>{cause.icon} {cause.title}</div>
                      <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>{cause.description}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: `linear-gradient(135deg,${C.success}08,${C.info}08)`, borderRadius: 14, padding: 20, border: `1px solid ${C.success}20`, marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                    ✅ 이렇게 고치면 {diagnosis.customer_summary.expected_score_after}점까지 올릴 수 있습니다
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>현재 {diagnosis.overall_score}점 → 예상 {diagnosis.customer_summary.expected_score_after}점</div>
                  {diagnosis.customer_summary.actions.map((action, i) => (
                    <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 8, paddingLeft: 4 }}>
                      <strong style={{ color: C.success }}>{i + 1}.</strong> {action}
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, borderRadius: 14, padding: 20, border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>AI 프로필 페이지가 필요하신가요?</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>귀사 도메인에 AI가 완벽하게 읽을 수 있는 페이지를 제작해 드립니다.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${C.g1},${C.g2})`, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>
                      AI 프로필 페이지 제작 문의 →
                    </button>
                    <button onClick={handleShare} style={{ padding: "10px 20px", borderRadius: 10, cursor: "pointer", background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 13, fontWeight: 600 }}>
                      📋 진단 결과 공유하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "summary" && !diagnosis?.customer_summary && (
              <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>
                고객용 요약을 생성하지 못했습니다. "상세 기술 진단" 탭을 확인해주세요.
              </div>
            )}

            {/* Detail — 기술 진단 */}
            {tab === "detail" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "190px 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: C.card, borderRadius: 14, padding: 20, border: `1px solid ${C.border}`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "'Outfit',sans-serif" }}>Total</div>
                    <Ring score={diagnosis.overall_score} color={g.color} />
                    <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800, color: g.color, fontFamily: "'Outfit',sans-serif" }}>{g.grade}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{g.ko}</div>
                    {diagnosis.company_name && <div style={{ marginTop: 10, padding: "5px 10px", borderRadius: 6, background: C.surface, border: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>{diagnosis.company_name}</div>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                    {AXES.map((axis, i) => <AxisCard key={axis.id} axis={axis} data={diagnosis[axis.id]} delay={i * 200} />)}
                  </div>
                </div>
                <div style={{ background: `linear-gradient(135deg,${C.g1}08,${C.g2}08)`, borderRadius: 10, padding: 14, border: `1px solid ${C.accent}15`, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📚</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Princeton GEO Research (KDD 2024) 기반 진단</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>10,000개 질의 벤치마크 검증 | PACP · SEP · SPF 3축 체계</div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Check */}
            {tab === "aicheck" && (
              <div>
                {aiResults ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                      {aiResults.map(r => {
                        const eng = ENGINES.find(e => e.id === r.engineId) || ENGINES[0];
                        const meta = getRecognitionMeta(r);
                        return (
                          <div key={r.engineId} style={{ background: C.card, borderRadius: 10, padding: 12, textAlign: "center", border: `1px solid ${meta.color}25` }}>
                            <div style={{ fontSize: 18, marginBottom: 3 }}>{eng.icon}</div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>{eng.name}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Outfit',sans-serif", color: meta.color }}>{r.accuracy}%</div>
                            <div style={{ fontSize: 9, color: meta.color }}>{meta.label}</div>
                          </div>
                        );
                      })}
                    </div>
                    {aiResults.map(r => {
                      const eng = ENGINES.find(e => e.id === r.engineId) || ENGINES[0];
                      const meta = getRecognitionMeta(r);
                      const mp = r.mentionPosition;
                      const isRecognized = r.matchStatus === "recognized";
                      const mpLabel = mp?.bucket === "top" ? "상위 언급" : mp?.bucket === "middle" ? "중간 언급" : mp?.bucket === "bottom" ? "하위 언급" : "언급 없음";
                      const mpColor = mp?.bucket === "top" ? C.success : mp?.bucket === "middle" ? C.warning : C.danger;
                      const officialDomain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
                      const hasOfficialCitation = r.citations?.some(c => c.includes(officialDomain));
                      return (
                        <div key={r.engineId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <span style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: `${eng.color}18`, color: eng.color, fontWeight: 700, fontSize: 12 }}>{eng.icon}</span>
                            <span style={{ fontWeight: 600, color: C.text, fontSize: 12 }}>{eng.name}</span>
                            <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: meta.bg, color: meta.color }}>{meta.label}</span>
                            {mp?.found && (
                              <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: `${mpColor}18`, color: isRecognized ? mpColor : C.textDim }}>
                                {isRecognized ? mpLabel : `${mpLabel} (참고)`}
                              </span>
                            )}
                          </div>
                          {r.reason && (
                            <div style={{ fontSize: 11, color: meta.color, marginBottom: 8, lineHeight: 1.6 }}>
                              {r.reason}
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, padding: 10, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap" }}>
                            {r.response}
                          </div>
                          {r.engineId === "perplexity" && r.citations?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>
                                실제 인용 출처 {hasOfficialCitation && <span style={{ color: C.success, fontWeight: 700 }}>· 공식 사이트 인용 ✓</span>}
                              </div>
                              {r.citations.slice(0, 5).map((c, i) => {
                                const isOfficial = officialDomain && c.includes(officialDomain);
                                return (
                                  <div key={i} style={{ fontSize: 10, color: isOfficial ? C.success : C.textDim, padding: "3px 0", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 4 }}>
                                    {isOfficial && <span>✓</span>}
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>
                    AI 답변 확인 데이터가 없습니다. API 키를 확인해주세요.
                  </div>
                )}
              </div>
            )}

            {/* Improvements */}
            {tab === "improve" && (
              <div>
                {improvements.length > 0 && (
                  <div style={{ background: `linear-gradient(135deg,${C.accent}0a,${C.g2}0a)`, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${C.accent}18`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>모든 개선사항 적용 시 예상 점수</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>현재 {diagnosis.overall_score}점 → 예상 {Math.min(diagnosis.overall_score + potentialGain, 100)}점</div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Outfit',sans-serif", background: `linear-gradient(135deg,${C.g1},${C.g2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>+{potentialGain}</div>
                  </div>
                )}

                {improvements.map((item, i) => {
                  const pc = { critical: { bg: C.dangerBg, color: C.danger, label: "CRITICAL" }, important: { bg: C.warningBg, color: C.warning, label: "IMPORTANT" }, nice: { bg: C.infoBg, color: C.info, label: "NICE" } };
                  const p = pc[item.priority] || pc.nice;
                  const axisColor = item.axis === "PACP" ? C.pacp : item.axis === "SEP" ? C.sep : C.spf;
                  return (
                    <details key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${axisColor}` }}>
                      <summary style={{ padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, listStyle: "none" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: p.bg, color: p.color }}>{p.label}</span>
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, background: axisColor + "15", color: axisColor }}>{item.axis}</span>
                        {item.source === "fallback_axis_based" && (
                          <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, background: C.infoBg, color: C.info }}>자동 생성</span>
                        )}
                        <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{item.issue}</span>
                        <span style={{ fontSize: 11, color: C.success, fontWeight: 600, fontFamily: "'Outfit',sans-serif" }}>{item.expected_impact}</span>
                      </summary>
                      <div style={{ padding: "0 12px 10px" }}>
                        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>💡 {item.action}</div>
                        {item.academic_basis && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontStyle: "italic" }}>📚 {item.academic_basis}</div>}
                      </div>
                    </details>
                  );
                })}

                <div style={{ marginTop: 18, background: C.card, borderRadius: 12, padding: 18, border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>AI 프로필 페이지가 필요하신가요?</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>토큰 효율성 95% 향상 · Schema.org 완벽 적용 · 정적 HTML</div>
                  <button style={{ padding: "9px 24px", borderRadius: 9, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${C.g1},${C.g2})`, color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>AI 프로필 페이지 제작 문의 →</button>
                </div>
              </div>
            )}

            {/* Raw Data */}
            {tab === "rawdata" && (
              <div>
                <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>AI가 이 페이지에서 읽은 전부입니다</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                    아래 내용이 AI 검색 엔진이 실제로 볼 수 있는 데이터의 전부입니다. 여기에 없는 정보는 AI가 알 수 없습니다.
                  </div>

                  {crawlData && (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>페이지 메타 정보</div>
                        <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Title:</strong> <span style={{ color: C.textMuted }}>{crawlData.title || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Description:</strong> <span style={{ color: C.textMuted }}>{crawlData.description || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.sep }}>H1 태그:</strong> <span style={{ color: crawlData.metadata?.headingStructure?.h1Count > 0 ? C.success : C.danger }}>{crawlData.metadata?.headingStructure?.h1Count || 0}개 — {crawlData.metadata?.headingStructure?.h1Texts?.join(", ") || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.sep }}>H2 태그:</strong> <span style={{ color: C.textMuted }}>{crawlData.metadata?.headingStructure?.h2Count || 0}개</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>JSON-LD:</strong> <span style={{ color: crawlData.metadata?.hasJsonLd ? C.success : C.danger }}>{crawlData.metadata?.hasJsonLd ? "✅ 감지됨" : "❌ 없음"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>Open Graph:</strong> <span style={{ color: crawlData.metadata?.hasOpenGraph ? C.success : C.danger }}>{crawlData.metadata?.hasOpenGraph ? "✅ 감지됨" : "❌ 없음"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>이미지:</strong> <span style={{ color: C.textMuted }}>{crawlData.metadata?.imageCount || 0}개 (Alt 없음: {crawlData.metadata?.imagesWithoutAlt || 0}개)</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>총 단어 수:</strong> <span style={{ color: C.textMuted }}>{crawlData.metadata?.totalWordCount || 0}</span></div>
                          <div style={{ fontSize: 12 }}><strong style={{ color: C.spf }}>긴 텍스트 블록 (&gt;512토큰):</strong> <span style={{ color: (crawlData.metadata?.longTextBlocks || 0) > 0 ? C.warning : C.success }}>{crawlData.metadata?.longTextBlocks || 0}개</span></div>
                        </div>
                      </div>

                      {crawlData.discoverySignals && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>LLM 봇 접근 신호</div>
                          <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
                              {crawlData.discoverySignals.robots?.bots && Object.entries(crawlData.discoverySignals.robots.bots).map(([bot, status]) => (
                                <div key={bot} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ color: status === "allow" ? C.success : status === "disallow" ? C.danger : C.textDim }}>
                                    {status === "allow" ? "✓" : status === "disallow" ? "✗" : "?"}
                                  </span>
                                  <span style={{ color: status === "allow" ? C.text : status === "disallow" ? C.danger : C.textDim }}>{bot}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>
                              {!crawlData.discoverySignals.robots?.fetched
                                ? "robots.txt 확인 불가"
                                : `robots.txt 확인 완료 · 허용 ${crawlData.discoverySignals.robots.summary?.allowedCount ?? "-"}/6 · 차단 ${crawlData.discoverySignals.robots.summary?.deniedCount ?? "-"}/6`}
                              {" · "}
                              {crawlData.discoverySignals.llmsTxt?.exists
                                ? <span style={{ color: C.success }}>llms.txt ✓</span>
                                : <span style={{ color: C.textDim }}>llms.txt 없음 (권고)</span>}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                          크롤링 원문 ({crawlData.contentLength?.toLocaleString() || 0}자 중 최대 10,000자 표시)
                        </div>
                        <pre style={{ background: C.surface, borderRadius: 8, padding: 14, border: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 500, overflow: "auto", fontFamily: "'Menlo','Monaco',monospace" }}>
                          {crawlData.rawContent || "(크롤링된 콘텐츠 없음 — CSR 사이트일 경우 AI 크롤러가 빈 페이지만 수집합니다)"}
                        </pre>
                      </div>
                    </>
                  )}

                  {!crawlData && <div style={{ textAlign: "center", padding: 30, color: C.textDim }}>크롤링 데이터 없음</div>}
                </div>

                <div style={{ background: `linear-gradient(135deg,${C.danger}08,${C.warning}08)`, borderRadius: 10, padding: 14, border: `1px solid ${C.danger}15` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>💡 이 데이터가 왜 중요한가요?</div>
                  <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>
                    위 내용이 AI가 볼 수 있는 전부입니다. 여기에 회사명, 서비스, 연락처가 명확히 없으면 AI는 해당 정보를 모릅니다.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 44, paddingTop: 16, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.8 }}>
            AAO — AI Answer Optimization | Princeton GEO Research Based<br />
            © 2026 AAO. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
