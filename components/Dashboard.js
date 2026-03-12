// components/Dashboard.js — AAO v5 진단 리포트 (린트 + AI 전달 확인)
"use client";
import { useState, useEffect } from "react";
import {
  PROFILE_REQUEST_SNAPSHOT_KEY,
  buildDiagnosticSnapshot,
  buildProfileRequestHref,
} from "@/lib/intake";
import { COPYRIGHT_YEAR, ENTITY_LABEL, ENTITY_SHORT_NAME } from "@/lib/site-identity";

const C = {
  bg: "#07070d", surface: "#0e0e18", card: "#121220",
  border: "#1e1e35", text: "#e4e4f0", textMuted: "#8585a0", textDim: "#4a4a65",
  accent: "#ff2d55", accentGlow: "rgba(255,45,85,0.12)",
  g1: "#ff2d55", g2: "#7928ca",
  success: "#00e87b", successBg: "rgba(0,232,123,0.08)",
  warning: "#ffb820", warningBg: "rgba(255,184,32,0.08)",
  danger: "#ff3b4f", dangerBg: "rgba(255,59,79,0.08)",
  info: "#38bdf8", infoBg: "rgba(56,189,248,0.08)",
};

const ENGINES = [
  { id: "chatgpt", name: "ChatGPT", icon: "🤖", color: "#10a37f" },
  { id: "perplexity", name: "Perplexity", icon: "🔮", color: "#20b2aa" },
  { id: "gemini", name: "Gemini", icon: "✦", color: "#4285f4" },
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

function friendlyError(msg) {
  if (!msg) return "진단 중 오류가 발생했습니다. 다시 시도해주세요.";
  if (msg.includes("crawl") || msg.includes("Jina")) return "해당 URL을 분석할 수 없습니다. URL이 정확한지 확인해주세요.";
  if (msg.includes("401") || msg.includes("403") || msg.includes("API key")) return "서비스가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.";
  if (msg.includes("parse") || msg.includes("JSON")) return "진단 결과를 생성하지 못했습니다. 다시 시도해주세요.";
  if (msg.includes("OpenAI") || msg.includes("400")) return "AI 진단 중 오류가 발생했습니다. 다시 시도해주세요.";
  return msg;
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

function getCheckStatusStyle(status) {
  if (status === "pass") return { icon: "✓", color: C.success, bg: C.successBg };
  if (status === "warn") return { icon: "⚠", color: C.warning, bg: C.warningBg };
  return { icon: "✗", color: C.danger, bg: C.dangerBg };
}

function CheckItem({ check }) {
  const style = getCheckStatusStyle(check.status);
  return (
    <div style={{
      display: "flex", gap: 10, padding: "10px 12px", borderRadius: 8,
      background: style.bg, border: `1px solid ${style.color}20`,
    }}>
      <span style={{ fontSize: 14, color: style.color, fontWeight: 700, flexShrink: 0, width: 20, textAlign: "center" }}>
        {style.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{check.title}</span>
          {check.blockageIds?.map((id) => (
            <span key={id} style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 4,
              background: C.surface, color: C.textDim, border: `1px solid ${C.border}`,
            }}>{id}</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, lineHeight: 1.5 }}>
          {check.evidence}
        </div>
        {check.status !== "pass" && check.fix && (
          <div style={{ fontSize: 11, color: style.color, marginTop: 4, lineHeight: 1.5 }}>
            → {check.fix}
          </div>
        )}
      </div>
    </div>
  );
}

function LintSection({ title, checks }) {
  if (!checks?.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, color: C.textDim, textTransform: "uppercase",
        letterSpacing: "1.5px", marginBottom: 8,
      }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {checks.map((check) => <CheckItem key={check.id} check={check} />)}
      </div>
    </div>
  );
}

function FieldDeliveryItem({ field, delivered, source, cause, fix, confidence }) {
  const style = delivered
    ? { icon: "✓", color: C.success, bg: C.successBg }
    : { icon: "✗", color: C.danger, bg: C.dangerBg };

  return (
    <div style={{
      display: "flex", gap: 8, padding: "6px 10px", borderRadius: 6,
      background: style.bg, border: `1px solid ${style.color}15`,
    }}>
      <span style={{ fontSize: 12, color: style.color, fontWeight: 700, flexShrink: 0, width: 16, textAlign: "center" }}>
        {style.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{field}</span>
          {source && (
            <span style={{ fontSize: 9, color: C.textDim, background: C.surface, padding: "1px 4px", borderRadius: 3 }}>
              {source}
            </span>
          )}
        </div>
        {!delivered && cause && (
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>
            원인: {cause}
            {confidence === "low" && (
              <span style={{
                fontSize: 8, marginLeft: 4, padding: "0 3px", borderRadius: 2,
                background: C.warningBg, color: C.warning, border: `1px solid ${C.warning}30`,
              }}>추정</span>
            )}
          </div>
        )}
        {!delivered && fix && (
          <div style={{ fontSize: 10, color: C.warning, marginTop: 1, lineHeight: 1.4 }}>
            조치: {fix}
          </div>
        )}
      </div>
    </div>
  );
}

function EngineDeliveryCard({ engineId, data }) {
  const engine = ENGINES.find((e) => e.id === engineId) || { name: engineId, icon: "?", color: C.textDim };
  const deliveredFields = data?.deliveredFields || [];
  const missedFields = data?.missedFields || [];
  const deliveryRate = data?.deliveryRate;
  const totalFields = data?.totalDeclaredFields || 0;

  const rateColor = deliveryRate === null ? C.textDim
    : deliveryRate >= 0.8 ? C.success
    : deliveryRate >= 0.5 ? C.warning
    : C.danger;

  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: 16,
      border: `1px solid ${engine.color}25`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{engine.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{engine.name}</span>
        </div>
        {deliveryRate !== null && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: rateColor,
            padding: "2px 8px", borderRadius: 999,
            background: `${rateColor}15`,
          }}>
            {Math.round(deliveryRate * 100)}% 전달
          </span>
        )}
      </div>

      {totalFields === 0 ? (
        <div style={{ fontSize: 12, color: C.textDim, padding: "8px 0" }}>
          선언된 사실이 없어 전달 확인을 수행할 수 없습니다.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {deliveredFields.map((item) => (
            <FieldDeliveryItem
              key={item.field}
              field={item.field}
              delivered
              value={item.value}
              source={item.source}
            />
          ))}
          {missedFields.map((item) => (
            <FieldDeliveryItem
              key={item.field}
              field={item.field}
              delivered={false}
              value={item.declaredValue}
              source={item.source}
              cause={item.inferredCause}
              fix={item.suggestedFix}
              confidence={item.confidence}
            />
          ))}
        </div>
      )}

      {data?.subpageResults?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
            서브페이지 도달
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            {data.subpageResults.map((sub) => {
              const subStyle = sub.reached === true
                ? { icon: "✓", color: C.success, bg: C.successBg }
                : sub.reached === "uncertain"
                ? { icon: "?", color: C.warning, bg: C.warningBg }
                : { icon: "✗", color: C.danger, bg: C.dangerBg };
              return (
                <div key={sub.url} style={{
                  display: "flex", gap: 6, padding: "4px 8px", borderRadius: 4,
                  background: subStyle.bg, border: `1px solid ${subStyle.color}15`,
                  fontSize: 11, alignItems: "center",
                }}>
                  <span style={{ color: subStyle.color, fontWeight: 700, width: 14 }}>{subStyle.icon}</span>
                  <span style={{ color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(() => { try { return new URL(sub.url).pathname; } catch { return sub.url; } })()}
                  </span>
                  {sub.evidence && (
                    <span style={{
                      fontSize: 9, padding: "0 4px", borderRadius: 3, flexShrink: 0,
                      background: sub.evidence === "citation_match" ? C.successBg
                        : sub.evidence === "structured_response" ? C.successBg
                        : sub.evidence === "content_summary" ? C.warningBg
                        : C.dangerBg,
                      color: sub.evidence === "citation_match" || sub.evidence === "structured_response"
                        ? C.success
                        : sub.evidence === "content_summary" ? C.warning
                        : C.textDim,
                    }}>
                      {sub.evidence === "citation_match" ? "출처 인용"
                        : sub.evidence === "structured_response" ? "접근 확인"
                        : sub.evidence === "content_summary" ? "내용 언급"
                        : sub.evidence === "structured_fail" ? "접근 실패"
                        : "언급 없음"}
                    </span>
                  )}
                  {!sub.reached && sub.inferredCause && (
                    <span style={{ color: C.textDim, fontSize: 10, flexShrink: 0 }}>{sub.inferredCause}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data?.citedOfficialUrl !== undefined && (
        <div style={{ marginTop: 8, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: data.citedOfficialUrl ? C.success : C.warning }}>
            {data.citedOfficialUrl ? "✓ 공식 URL 인용" : "✗ 공식 URL 미인용"}
          </span>
          {data.citationMatchLevel && data.citationMatchLevel !== "none" && (
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3,
              background: data.citationMatchLevel === "exact" ? C.successBg
                : data.citationMatchLevel === "path" ? C.warningBg
                : C.dangerBg,
              color: data.citationMatchLevel === "exact" ? C.success
                : data.citationMatchLevel === "path" ? C.warning
                : C.textDim,
              border: `1px solid ${data.citationMatchLevel === "exact" ? C.success
                : data.citationMatchLevel === "path" ? C.warning
                : C.textDim}30`,
            }}>
              {data.citationMatchLevel === "exact" ? "정확한 URL 일치"
                : data.citationMatchLevel === "path" ? "경로 부분 일치"
                : "같은 도메인만"}
            </span>
          )}
        </div>
      )}

      {data?.responsePreview && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 10, color: C.textDim, cursor: "pointer" }}>응답 미리보기</summary>
          <pre style={{
            marginTop: 6, fontSize: 10, color: C.textMuted, lineHeight: 1.5,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
            background: C.surface, padding: 10, borderRadius: 6,
            maxHeight: 200, overflow: "auto",
          }}>
            {data.responsePreview}
          </pre>
        </details>
      )}
    </div>
  );
}

function GroundTruthSummary({ groundTruth }) {
  const fields = groundTruth?.declaredFields || [];
  const faqPairs = groundTruth?.faqPairs || [];

  if (!fields.length && !faqPairs.length) {
    return (
      <div style={{
        background: C.dangerBg, borderRadius: 10, padding: 14,
        border: `1px solid ${C.danger}30`, marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.danger, marginBottom: 4 }}>
          선언된 사실 없음
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          JSON-LD, facts block, FAQ 어디에서도 명시적으로 선언된 정보를 찾지 못했습니다.
          AI가 읽을 수 있는 구조화된 사실을 페이지에 추가하세요.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: C.card, borderRadius: 10, padding: 14,
      border: `1px solid ${C.border}`, marginBottom: 16,
    }}>
      <div style={{
        fontSize: 10, color: C.textDim, textTransform: "uppercase",
        letterSpacing: "1.5px", marginBottom: 8,
      }}>선언된 사실 ({fields.length}개 필드{faqPairs.length > 0 ? ` · FAQ ${faqPairs.length}쌍` : ""})</div>
      <div style={{ display: "grid", gap: 4 }}>
        {fields.map((item) => (
          <div key={item.field} style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, color: C.text,
          }}>
            <span style={{ color: C.textDim, minWidth: 100 }}>{item.field}</span>
            <span style={{ color: C.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {Array.isArray(item.value) ? item.value.join(", ") : String(item.value || "")}
            </span>
            <span style={{
              fontSize: 9, color: C.textDim, background: C.surface,
              padding: "1px 4px", borderRadius: 3, flexShrink: 0,
            }}>{item.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ initialUrl = "" }) {
  const isMobile = useIsMobile();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState(null);
  const [crawlData, setCrawlData] = useState(null);
  const [lintReport, setLintReport] = useState(null);
  const [groundTruth, setGroundTruth] = useState(null);
  const [engines, setEngines] = useState(null);
  const [tab, setTab] = useState("lint");

  useEffect(() => {
    if (initialUrl) scan();
  }, []);

  const scan = async () => {
    const target = url || initialUrl;
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setCrawlData(null);
    setLintReport(null);
    setGroundTruth(null);
    setEngines(null);

    try {
      // Stage 1: 크롤 + 린트
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

      const diagData = await readJsonSafely(diagRes);
      setCrawlData(diagData.crawl);
      setLintReport(diagData.lintReport);
      setGroundTruth(diagData.groundTruth);
      setTab("lint");

      // Stage 2: AI 엔진 URL 직접 읽기 검증
      setPhase("AI 엔진이 페이지를 읽는 중...");
      const subpageUrls = (diagData.crawl?.extras || [])
        .map((page) => page.url)
        .filter(Boolean)
        .slice(0, 5);

      const crawlSource = Array.isArray(diagData.crawl?.crawlSource) ? diagData.crawl.crawlSource : [];
      const directSourceCount = crawlSource.filter((s) => String(s || "").startsWith("direct:")).length;
      const jinaSourceCount = crawlSource.filter((s) => String(s || "").startsWith("jina:")).length;
      const robots = diagData.crawl?.discoverySignals?.robots;
      const wordCount = (diagData.crawl?.contentPreview || "").split(/\s+/).filter(Boolean).length;

      const aiRes = await fetch("/api/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target,
          groundTruth: diagData.groundTruth,
          crawlSnapshot: {
            title: diagData.crawl?.title || "",
            description: diagData.crawl?.description || "",
            content: diagData.crawl?.contentPreview || "",
            contentPreview: diagData.crawl?.contentPreview || "",
            headingStructure: diagData.crawl?.metadata?.headingStructure || null,
            jsonLdBlocks: Array.isArray(diagData.crawl?.jsonLdBlocks) ? diagData.crawl.jsonLdBlocks : [],
          },
          subpageUrls,
          crawlSignals: {
            directSourceCount,
            jinaSourceCount,
            jsRendered: directSourceCount === 0 && jinaSourceCount > 0,
            robotsDenied: (robots?.summary?.deniedCount || 0) > 0,
            wordCount,
            factLabelCount: diagData.lintReport?.detectedSignals?.factLabelCount || 0,
            entityDefinitionOk: diagData.lintReport?.coreChecks?.some((c) => c.id === "entity-definition" && c.status === "pass") || false,
          },
        }),
      });

      if (aiRes.ok) {
        const aiData = await readJsonSafely(aiRes);
        setEngines(aiData.engines);
        if (aiData.groundTruth && (!diagData.groundTruth || !diagData.groundTruth.declaredFields?.length)) {
          setGroundTruth(aiData.groundTruth);
        }
      }
    } catch (e) {
      console.error("Scan error:", e);
      setError(friendlyError(e.message));
    } finally {
      setLoading(false);
      setPhase("");
    }
  };

  const officialDomain = (() => {
    try {
      return new URL(url || initialUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  const profileRequestSnapshot = buildDiagnosticSnapshot({
    url: url || initialUrl,
    companyName: crawlData?.title || "",
    domain: officialDomain,
  });
  const profileRequestHref = buildProfileRequestHref(profileRequestSnapshot);

  const handleProfileRequest = () => {
    try {
      window.sessionStorage.setItem(PROFILE_REQUEST_SNAPSHOT_KEY, JSON.stringify(profileRequestSnapshot));
    } catch {
      // Ignore storage errors.
    }
    window.location.href = profileRequestHref;
  };

  const hasResults = lintReport || engines;
  const lintFails = lintReport?.checks?.filter((c) => c.status === "fail") || [];
  const lintWarns = lintReport?.checks?.filter((c) => c.status === "warn") || [];

  const tabs = [
    { id: "lint", label: "구조 검증" },
    { id: "aicheck", label: "AI 전달 확인" },
    { id: "rawdata", label: "크롤링 원문" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Pretendard',-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, padding: "14px 20px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: -1, background: "linear-gradient(90deg,#6c63ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AAO</span>
              <span style={{ fontSize: 11, background: "#6c63ff22", color: "#a78bfa", border: "1px solid #6c63ff44", borderRadius: 4, padding: "2px 7px", fontWeight: 700, letterSpacing: "1px" }}>BETA</span>
              {!isMobile && <span style={{ fontSize: 9, color: C.textDim, letterSpacing: "1px" }}>AI Answer Optimization</span>}
            </div>
          </a>
          <div style={{ fontSize: 9, color: C.textDim, fontFamily: "'Outfit',sans-serif" }}>Diagnostic Report</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "16px" : "24px 20px" }}>
        {/* Hero */}
        {!hasResults && !loading && (
          <div style={{ textAlign: "center", paddingTop: isMobile ? 24 : 44, paddingBottom: 24 }}>
            <h1 style={{
              fontFamily: "'Outfit',sans-serif", fontSize: isMobile ? 24 : 36, fontWeight: 800,
              letterSpacing: "-2px", background: `linear-gradient(135deg,#fff,${C.textMuted})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 10, lineHeight: 1.2,
            }}>
              AI가 당신의 회사를<br />정확히 설명할 수 있나요?
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 32 }}>
              구조 검증 + AI 엔진 실제 전달 확인
            </p>
          </div>
        )}

        {/* URL Input */}
        <div style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          gap: 8, background: C.surface, borderRadius: 12, padding: 4,
          border: `1px solid ${C.border}`, boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
          marginBottom: hasResults ? 24 : 0,
        }}>
          <input
            type="text" placeholder="https://your-company.com"
            value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            style={{
              flex: 1, padding: "11px 14px", background: "transparent",
              border: "none", outline: "none", color: C.text, fontSize: 14,
              fontFamily: "'Outfit',sans-serif",
            }}
          />
          <button onClick={scan} disabled={loading || !url.trim()} style={{
            padding: isMobile ? "12px" : "10px 22px", borderRadius: 9, border: "none",
            cursor: loading ? "wait" : "pointer",
            background: loading ? C.border : `linear-gradient(135deg,${C.g1},${C.g2})`,
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
            boxShadow: loading ? "none" : `0 4px 14px ${C.accentGlow}`,
            opacity: !url.trim() ? 0.4 : 1,
          }}>
            {loading ? "분석 중..." : "진단하기"}
          </button>
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
            <div style={{
              width: 50, height: 50, margin: "0 auto 18px", borderRadius: "50%",
              border: `3px solid ${C.border}`, borderTopColor: C.accent,
              animation: "spin 1s linear infinite",
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{phase}</div>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <>
            {/* Summary Banner */}
            <div style={{
              background: C.card, borderRadius: 14, padding: 18,
              border: `1px solid ${C.border}`, marginBottom: 20,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>
                AAO 진단 리포트 — {crawlData?.title || officialDomain}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                {lintReport && (
                  <>
                    <span style={{ fontSize: 12, color: lintFails.length ? C.danger : C.success, fontWeight: 700 }}>
                      {lintFails.length ? `구조 문제 ${lintFails.length}건` : "구조 검증 통과"}
                    </span>
                    {lintWarns.length > 0 && (
                      <span style={{ fontSize: 12, color: C.warning, fontWeight: 700 }}>
                        주의 {lintWarns.length}건
                      </span>
                    )}
                  </>
                )}
                {engines && (
                  <span style={{ fontSize: 12, color: C.info, fontWeight: 700 }}>
                    AI 엔진 {Object.keys(engines).length}개 확인 완료
                  </span>
                )}
              </div>
              {lintReport?.readyForAiValidation === false && (
                <div style={{ fontSize: 12, color: C.danger, lineHeight: 1.6 }}>
                  구조 검증에서 실패 항목이 있습니다. AI 엔진에 사실이 정확히 전달되려면 먼저 구조 문제를 해결하세요.
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              display: "flex", gap: 3, marginBottom: 20, background: C.surface,
              borderRadius: 10, padding: 3, border: `1px solid ${C.border}`,
            }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === t.id ? `linear-gradient(135deg,${C.g1}15,${C.g2}15)` : "transparent",
                  color: tab === t.id ? C.text : C.textDim, fontSize: 12, fontWeight: 600,
                  border: tab === t.id ? `1px solid ${C.accent}25` : "1px solid transparent",
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: 구조 검증 (린트) */}
            {tab === "lint" && lintReport && (
              <div>
                <LintSection title="Core Checks — 콘텐츠 구조" checks={lintReport.coreChecks} />
                <LintSection title="Platform Checks — 기술 플랫폼" checks={lintReport.platformChecks} />

                {groundTruth && <GroundTruthSummary groundTruth={groundTruth} />}
              </div>
            )}

            {/* Tab: AI 전달 확인 */}
            {tab === "aicheck" && (
              <div>
                {!engines && (
                  <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>
                    AI 엔진 답변 확인 결과가 없습니다.
                  </div>
                )}
                {engines && (
                  <div style={{ display: "grid", gap: 12 }}>
                    {ENGINES.map((engine) => {
                      const data = engines[engine.id];
                      if (!data) return null;
                      return (
                        <EngineDeliveryCard
                          key={engine.id}
                          engineId={engine.id}
                          data={data}
                          isMobile={isMobile}
                        />
                      );
                    })}
                    {Object.keys(engines).length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: C.textDim }}>
                        AI 엔진에서 유효한 응답을 받지 못했습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab: 크롤링 원문 */}
            {tab === "rawdata" && (
              <div>
                {crawlData && (
                  <>
                    <div style={{
                      background: C.card, borderRadius: 12, padding: 16,
                      border: `1px solid ${C.border}`, marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                        메타데이터
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: C.textDim }}>제목:</span>{" "}
                          <span style={{ color: C.text }}>{crawlData.title || "—"}</span>
                        </div>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: C.textDim }}>설명:</span>{" "}
                          <span style={{ color: C.textMuted }}>{crawlData.description || "—"}</span>
                        </div>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: C.textDim }}>콘텐츠 길이:</span>{" "}
                          <span style={{ color: C.textMuted }}>{crawlData.contentLength?.toLocaleString() || 0}자</span>
                        </div>
                        {crawlData.crawlSource && (
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: C.textDim }}>크롤 소스:</span>{" "}
                            <span style={{ color: C.textMuted }}>{Array.isArray(crawlData.crawlSource) ? crawlData.crawlSource.join(", ") : crawlData.crawlSource}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {crawlData.extras?.length > 0 && (
                      <div style={{
                        background: C.card, borderRadius: 12, padding: 16,
                        border: `1px solid ${C.border}`, marginBottom: 16,
                      }}>
                        <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                          서브페이지 ({crawlData.extras.length}개)
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {crawlData.extras.map((page, i) => (
                            <div key={i} style={{ fontSize: 11, color: C.textMuted }}>
                              {page.title || page.url} — {page.contentLength?.toLocaleString() || 0}자
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {crawlData.discoverySignals?.robots && (
                      <div style={{
                        background: C.card, borderRadius: 12, padding: 16,
                        border: `1px solid ${C.border}`, marginBottom: 16,
                      }}>
                        <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                          Discovery Signals
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
                          {crawlData.discoverySignals.robots?.fetched
                            ? `robots.txt 허용 ${crawlData.discoverySignals.robots.summary?.allowedCount ?? "-"}/6 · 차단 ${crawlData.discoverySignals.robots.summary?.deniedCount ?? "-"}/6`
                            : "robots.txt 확인 불가"}
                          {" · "}
                          {crawlData.discoverySignals.sitemap?.exists
                            ? `sitemap.xml ${crawlData.discoverySignals.sitemap.format} · ${crawlData.discoverySignals.sitemap.locCount ?? 0}개 URL`
                            : "sitemap.xml 없음"}
                          {" · "}
                          {crawlData.discoverySignals.llmsTxt?.exists
                            ? "llms.txt 있음"
                            : "llms.txt 없음"}
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                        크롤링 미리보기 (최대 1,600자)
                      </div>
                      <pre style={{
                        background: C.surface, borderRadius: 8, padding: 14,
                        border: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted,
                        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
                        maxHeight: 500, overflow: "auto", fontFamily: "'Menlo','Monaco',monospace",
                      }}>
                        {crawlData.contentPreview || "(콘텐츠 없음)"}
                      </pre>
                    </div>
                  </>
                )}
                {!crawlData && (
                  <div style={{ textAlign: "center", padding: 30, color: C.textDim }}>크롤링 데이터 없음</div>
                )}
              </div>
            )}

            {/* CTA */}
            <div style={{
              marginTop: 24, background: `linear-gradient(135deg,${C.g1}08,${C.g2}08)`,
              borderRadius: 14, padding: 20, border: `1px solid ${C.accent}20`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                AI가 정확히 읽을 수 있는 프로필 페이지가 필요하신가요?
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                위 진단 결과를 기반으로 AI 프로필 페이지를 제작해드립니다.
              </div>
              <button onClick={handleProfileRequest} style={{
                padding: "10px 28px", borderRadius: 10, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg,${C.g1},${C.g2})`,
                color: "#fff", fontSize: 13, fontWeight: 700,
                boxShadow: `0 4px 14px ${C.accentGlow}`,
              }}>
                AI 프로필 페이지 요청
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 44, paddingTop: 16, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.8 }}>
            {ENTITY_LABEL} | Diagnostic Report<br />
            © {COPYRIGHT_YEAR} {ENTITY_SHORT_NAME}. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
