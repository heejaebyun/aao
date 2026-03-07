// components/Dashboard.js
"use client";
import { useState, useEffect } from "react";
import { deriveGateSummary } from "@/lib/gate-analysis";
import {
  PROFILE_REQUEST_SNAPSHOT_KEY,
  buildDiagnosticSnapshot,
  buildProfileRequestHref,
} from "@/lib/intake";
import { ENTITY_LABEL } from "@/lib/site-identity";

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

const AI_MODES = [
  {
    id: "strict_recall",
    ko: "기억 기반 인식",
    en: "Strict Recall",
    description: "웹 검색 없이 모델이 기존 기억만으로 회사를 설명하는지 확인합니다.",
  },
  {
    id: "live_search",
    ko: "실시간 검색 인식",
    en: "Live Search",
    description: "검색 도구와 인용 출처를 포함해 지금 웹에서 회사를 찾을 수 있는지 확인합니다.",
  },
];

const AI_INTENTS = [
  {
    id: "awareness",
    label: "인지",
    shortLabel: "Awareness",
    description: "브랜드가 무엇인지 묻는 기본 인식 질문입니다.",
  },
  {
    id: "comparison",
    label: "비교",
    shortLabel: "Comparison",
    description: "유사 서비스와 비교될 때 브랜드가 어떻게 설명되는지 확인합니다.",
  },
  {
    id: "purchase",
    label: "구매",
    shortLabel: "Purchase",
    description: "도입, 가격, 사례 같은 구매 의사결정 질문에서 보이는지 확인합니다.",
  },
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

  if (matchStatus === "unsupported" || result?.status === "unsupported") {
    return {
      label: "미지원",
      color: C.textDim,
      bg: C.surface,
    };
  }

  if (matchStatus === "skipped" || result?.status === "skipped") {
    return {
      label: "생략",
      color: C.info,
      bg: C.infoBg,
    };
  }

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

function getAiModeMeta(mode) {
  return AI_MODES.find((item) => item.id === mode) || AI_MODES[1];
}

function getAiIntentMeta(intent) {
  return AI_INTENTS.find((item) => item.id === intent) || AI_INTENTS[0];
}

function formatRatioPercent(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

function getFanOutMeta(coverage) {
  if (!coverage || coverage.status === "none") {
    return { label: "fan-out 없음", color: C.textDim, bg: C.surface };
  }

  if (coverage.status === "strong") {
    return { label: "fan-out 충분", color: C.success, bg: C.successBg };
  }

  if (coverage.status === "partial") {
    return { label: "fan-out 일부", color: C.warning, bg: C.warningBg };
  }

  if (coverage.status === "opaque") {
    return { label: "fan-out 불투명", color: C.info, bg: C.infoBg };
  }

  return { label: "fan-out 없음", color: C.textDim, bg: C.surface };
}

function getSourceMixMeta(sourceMix) {
  if (!sourceMix || sourceMix.id === "none") {
    return { label: "출처 없음", color: C.textDim, bg: C.surface };
  }

  if (sourceMix.id === "official_only") {
    return { label: "공식 위주", color: C.success, bg: C.successBg };
  }

  if (sourceMix.id === "mixed") {
    return { label: sourceMix.label || "혼합", color: C.info, bg: C.infoBg };
  }

  return { label: sourceMix.label || "제3자 위주", color: C.warning, bg: C.warningBg };
}

function getSourceAuthorityMeta(profile) {
  const tier = profile?.dominantAuthorityTier;
  if (tier === "high") return { label: "권위 높음", color: C.success, bg: C.successBg };
  if (tier === "medium") return { label: "권위 보통", color: C.info, bg: C.infoBg };
  if (tier === "low") return { label: "권위 낮음", color: C.warning, bg: C.warningBg };
  return { label: "권위 없음", color: C.textDim, bg: C.surface };
}

function getSourceFitMeta(profile) {
  const status = profile?.sourceFitStatus;
  if (status === "strong") return { label: "출처 적합도 높음", color: C.success, bg: C.successBg };
  if (status === "official_gap") return { label: "공식 출처 gap", color: C.warning, bg: C.warningBg };
  if (status === "off_pattern") return { label: "출처 패턴 이탈", color: C.danger, bg: C.dangerBg };
  if (status === "mixed") return { label: "출처 혼합", color: C.info, bg: C.infoBg };
  return { label: "출처 없음", color: C.textDim, bg: C.surface };
}

function getCitationTypeMeta(detail) {
  const typeId = detail?.sourceTypeId || "unknown";
  if (typeId === "official") return { label: "공식", color: C.success, bg: C.successBg };
  if (typeId === "news") return { label: "뉴스", color: C.info, bg: C.infoBg };
  if (typeId === "wiki") return { label: "위키", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" };
  if (typeId === "docs") return { label: "문서", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  if (typeId === "directory") return { label: "디렉터리", color: C.warning, bg: C.warningBg };
  if (typeId === "community") return { label: "커뮤니티", color: "#f97316", bg: "rgba(249,115,22,0.12)" };
  if (typeId === "social") return { label: "소셜", color: "#ec4899", bg: "rgba(236,72,153,0.12)" };
  if (typeId === "blog") return { label: "블로그", color: "#14b8a6", bg: "rgba(20,184,166,0.12)" };
  return { label: detail?.sourceTypeLabel || "미분류", color: C.textDim, bg: C.surface };
}

function getIndexabilityMeta(indexability) {
  if (!indexability || indexability.status === "unknown") {
    return { label: "미확인", color: C.textDim, bg: C.surface };
  }

  if (indexability.status === "noindex") {
    return { label: "noindex", color: C.danger, bg: C.dangerBg };
  }

  if (indexability.status === "indexable") {
    return { label: "index 가능", color: C.success, bg: C.successBg };
  }

  if (indexability.status === "likely_indexable") {
    return { label: "index 가능 추정", color: C.info, bg: C.infoBg };
  }

  return { label: indexability.status, color: C.textDim, bg: C.surface };
}

function getFactCheckMeta(factCheck) {
  const verdict = factCheck?.verdict;

  if (verdict === "aligned") {
    return { label: "fact-check 정합", color: C.success, bg: C.successBg };
  }

  if (verdict === "wrong_entity") {
    return { label: "다른 엔티티 가능", color: C.danger, bg: C.dangerBg };
  }

  if (verdict === "domain_mismatch") {
    return { label: "도메인 불일치", color: C.warning, bg: C.warningBg };
  }

  if (verdict === "service_mismatch") {
    return { label: "서비스 불일치", color: "#ff9100", bg: "rgba(255,145,0,0.12)" };
  }

  if (verdict === "weak") {
    return { label: "근거 약함", color: C.info, bg: C.infoBg };
  }

  return { label: "fact-check 없음", color: C.textDim, bg: C.surface };
}

function matchesOfficialDomain(url, officialDomain) {
  if (!officialDomain) return false;

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return hostname === officialDomain || hostname.endsWith(`.${officialDomain}`);
  } catch {
    return false;
  }
}

function normalizeAiResultsByMode(aiResults) {
  if (Array.isArray(aiResults)) {
    return {
      live_search: {
        ...getAiModeMeta("live_search"),
        label: getAiModeMeta("live_search").ko,
        shortLabel: getAiModeMeta("live_search").en,
        defaultIntent: "awareness",
        intents: AI_INTENTS,
        intentResults: {
          awareness: {
            ...getAiIntentMeta("awareness"),
            results: aiResults,
          },
        },
        queryType: "entity_live_search",
        results: aiResults,
        budget: null,
      },
    };
  }

  if (!aiResults || typeof aiResults !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(aiResults).map(([modeId, rawMode]) => {
      const modeMeta = getAiModeMeta(modeId);
      const fallbackResults = Array.isArray(rawMode?.results) ? rawMode.results : [];
      const rawIntents = Array.isArray(rawMode?.intents) && rawMode.intents.length > 0
        ? rawMode.intents
        : AI_INTENTS;
      const normalizedIntents = rawIntents.map((item) => {
        const intentId = typeof item === "string" ? item : item?.id;
        return {
          ...getAiIntentMeta(intentId),
          ...(typeof item === "object" ? item : {}),
          id: intentId || "awareness",
        };
      });
      const intentResults = {};

      normalizedIntents.forEach((intentMeta) => {
        const intentId = intentMeta.id;
        const rawIntent = rawMode?.intentResults?.[intentId];
        intentResults[intentId] = {
          ...getAiIntentMeta(intentId),
          ...(rawIntent || {}),
          id: intentId,
          results: Array.isArray(rawIntent?.results)
            ? rawIntent.results
            : intentId === "awareness"
              ? fallbackResults
              : [],
        };
      });

      if (!intentResults.awareness) {
        intentResults.awareness = {
          ...getAiIntentMeta("awareness"),
          results: fallbackResults,
        };
      }

      const intents = normalizedIntents.length > 0
        ? normalizedIntents.map((intentMeta) => intentResults[intentMeta.id]).filter(Boolean)
        : [intentResults.awareness];
      const defaultIntent = rawMode?.defaultIntent && intentResults[rawMode.defaultIntent]
        ? rawMode.defaultIntent
        : intents[0]?.id || "awareness";

      return [
        modeId,
        {
          ...modeMeta,
          ...(rawMode || {}),
          id: modeId,
          label: rawMode?.label || modeMeta.ko,
          shortLabel: rawMode?.shortLabel || modeMeta.en,
          description: rawMode?.description || modeMeta.description,
          queryType: rawMode?.queryType || modeMeta.queryType,
          defaultIntent,
          intents,
          intentResults,
          results: Array.isArray(rawMode?.results)
            ? rawMode.results
            : intentResults[defaultIntent]?.results || [],
          budget: rawMode?.budget || null,
        },
      ];
    })
  );
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

function getProvenanceMeta(source) {
  const normalized = typeof source === "string" ? source : "";

  if (normalized === "repaired" || normalized.startsWith("repaired_")) {
    return {
      label: "복구",
      color: C.warning,
      bg: C.warningBg,
      description: "원본 JSON을 그대로 쓰지 못해 복구 단계를 거친 결과입니다.",
    };
  }

  if (normalized === "model" || normalized.startsWith("model_")) {
    return {
      label: "실측",
      color: C.success,
      bg: C.successBg,
      description: "크롤링 스냅샷을 기반으로 모델이 직접 구조화한 결과입니다.",
    };
  }

  return {
    label: "추정",
    color: C.info,
    bg: C.infoBg,
    description: "fallback 규칙이나 휴리스틱으로 보완한 값입니다.",
  };
}

function ProvenanceBadge({ source, prefix = "", compact = false }) {
  if (!source) return null;

  const meta = getProvenanceMeta(source);
  const text = prefix ? `${prefix} ${meta.label}` : meta.label;

  return (
    <span
      title={meta.description}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "2px 6px" : "3px 8px",
        borderRadius: 999,
        fontSize: compact ? 9 : 10,
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function ProvenanceLegend() {
  const items = [
    { source: "model", title: "실측", description: "모델이 스냅샷에서 직접 구조화한 값" },
    { source: "repaired", title: "복구", description: "응답 JSON을 복구한 뒤 사용한 값" },
    { source: "fallback_axis", title: "추정", description: "fallback 규칙이나 휴리스틱으로 보완한 값" },
  ];

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 14, border: `1px solid ${C.border}`, marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1.2px" }}>
        Provenance
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item) => (
          <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.border}` }}>
            <ProvenanceBadge source={item.source} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{item.title}</div>
              <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5 }}>{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16 }}>{axis.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: axis.color, fontFamily: "'Outfit',sans-serif" }}>{axis.name}</span>
            <span style={{ fontSize: 10, color: C.textDim }}>{axis.nameKo}</span>
            <ProvenanceBadge source={data?.source} compact />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{sub.name}</span>
                <ProvenanceBadge source={subscores[sub.id]?.source} compact />
              </div>
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
  const [aiMode, setAiMode] = useState("live_search");
  const [aiIntent, setAiIntent] = useState("awareness");
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
    setAiMode("live_search");
    setAiIntent("awareness");

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
        setAiMode(aiData.defaultMode || "live_search");
        setAiIntent(aiData.defaultIntent || "awareness");
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
  const aiResultsByMode = normalizeAiResultsByMode(aiResults);
  const activeAiMode = aiResultsByMode[aiMode]
    ? aiMode
    : aiResultsByMode.live_search
      ? "live_search"
      : aiResultsByMode.strict_recall
        ? "strict_recall"
        : "live_search";
  const aiModeData = aiResultsByMode[activeAiMode] || null;
  const aiModeMeta = getAiModeMeta(activeAiMode);
  const aiIntents = Array.isArray(aiModeData?.intents) && aiModeData.intents.length > 0
    ? aiModeData.intents
    : AI_INTENTS;
  const activeAiIntent = aiModeData?.intentResults?.[aiIntent]
    ? aiIntent
    : aiModeData?.defaultIntent && aiModeData?.intentResults?.[aiModeData.defaultIntent]
      ? aiModeData.defaultIntent
      : aiIntents[0]?.id || "awareness";
  const aiIntentData = aiModeData?.intentResults?.[activeAiIntent] || null;
  const aiIntentMeta = getAiIntentMeta(activeAiIntent);
  const aiIntentSummary = aiIntentData?.summary || null;
  const aiModeSummary = aiModeData?.summary || null;
  const aiModeResults = aiIntentData?.results || aiModeData?.results || [];
  const aiModeBudget = aiModeData?.budget || null;
  const gateSummary = deriveGateSummary({ crawlData, diagnosis, aiResults: aiResultsByMode.live_search?.results || [] });
  const diagnosisProvenance = diagnosis?.provenance || {};
  const extendedProvenance = extendedDiagnosis?.provenance || {};
  const officialDomain = (() => {
    try {
      return new URL(url || initialUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const profileRequestSnapshot = diagnosis
    ? buildDiagnosticSnapshot({
        url: url || initialUrl,
        companyName: diagnosis.company_name,
        domain: officialDomain,
        grade: g?.grade,
        currentScore: diagnosis.overall_score,
        targetScore: diagnosis.customer_summary?.expected_score_after ?? Math.min(diagnosis.overall_score + potentialGain, 100),
        gapScore,
        pacpScore: diagnosis.pacp?.score,
        sepScore: diagnosis.sep?.score,
        spfScore: diagnosis.spf?.score,
        headline: diagnosis.customer_summary?.headline,
        detail: diagnosis.customer_summary?.detail,
        improvements: improvements.map((item) => item.issue).slice(0, 5),
        hiddenPages: hiddenPages.map((page) => {
          try {
            return new URL(page).pathname || "/";
          } catch {
            return page;
          }
        }),
      })
    : buildDiagnosticSnapshot();
  const profileRequestHref = buildProfileRequestHref(profileRequestSnapshot);

  const handleProfileRequest = () => {
    try {
      window.sessionStorage.setItem(PROFILE_REQUEST_SNAPSHOT_KEY, JSON.stringify(profileRequestSnapshot));
    } catch {
      // Ignore storage errors and fall back to query params.
    }
    window.location.href = profileRequestHref;
  };

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
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    <ProvenanceBadge source={diagnosisProvenance.overall_score} prefix="총점" />
                    <ProvenanceBadge source={diagnosis.customer_summary?.source || diagnosisProvenance.customer_summary} prefix="요약" />
                  </div>
                  <div style={{ marginTop: 16, fontSize: isMobile ? 14 : 16, fontWeight: 700, color: C.text, lineHeight: 1.6 }}>
                    {diagnosis.customer_summary.headline}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: C.textMuted, lineHeight: 1.7, maxWidth: 600, margin: "10px auto 0" }}>
                    {diagnosis.customer_summary.detail}
                  </div>
                </div>

                <ProvenanceLegend />

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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.2px" }}>Official Score</div>
                      <ProvenanceBadge source={diagnosisProvenance.overall_score} compact />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>📊 메인 페이지 기준: {diagnosis.overall_score}점/100점</div>
                    <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
                      AI가 메인 페이지에서 직접 읽을 수 있는 정보만으로 평가한 공식 진단 점수입니다.
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: g.color, fontWeight: 700 }}>{g.grade} · {g.ko}</div>
                  </div>

                  <div style={{ background: C.card, borderRadius: 14, padding: 18, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.2px" }}>Extended Discovery</div>
                      {extendedDiagnosis && <ProvenanceBadge source={extendedProvenance.overall_score} compact />}
                    </div>
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
                    <button onClick={handleProfileRequest} style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${C.g1},${C.g2})`, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>
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
                    <div style={{ marginTop: 10 }}>
                      <ProvenanceBadge source={diagnosisProvenance.overall_score} prefix="총점" />
                    </div>
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
                <div style={{ marginTop: 12 }}>
                  <ProvenanceLegend />
                </div>
              </div>
            )}

            {/* AI Check */}
            {tab === "aicheck" && (
              <div>
                {aiResults ? (
                  <>
                    <div style={{ display: "flex", gap: 3, marginBottom: 12, background: C.surface, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, overflowX: "auto" }}>
                      {AI_MODES.map((mode) => (
                        <button key={mode.id} onClick={() => setAiMode(mode.id)} style={{
                          flex: isMobile ? "0 0 auto" : 1,
                          padding: isMobile ? "8px 10px" : "8px 12px",
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                          background: activeAiMode === mode.id ? `linear-gradient(135deg,${C.g1}15,${C.g2}15)` : "transparent",
                          color: activeAiMode === mode.id ? C.text : C.textDim,
                          fontSize: isMobile ? 11 : 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}>
                          {mode.ko}
                          {!isMobile && <span style={{ display: "block", fontSize: 9, opacity: 0.55, marginTop: 1, fontFamily: "'Outfit',sans-serif" }}>{mode.en}</span>}
                        </button>
                      ))}
                    </div>

                    {aiModeData && (
                      <div style={{ background: C.card, borderRadius: 12, padding: 14, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{aiModeData.label || aiModeMeta.ko}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'Outfit',sans-serif" }}>{aiModeData.queryType || "entity_check"}</span>
                            <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'Outfit',sans-serif" }}>
                              {aiIntentData?.shortLabel || aiIntentMeta.shortLabel}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
                          {aiModeData.description || aiModeMeta.description}
                        </div>
                        <div style={{ display: "flex", gap: 3, marginTop: 12, background: C.surface, borderRadius: 10, padding: 3, border: `1px solid ${C.border}`, overflowX: "auto" }}>
                          {aiIntents.map((intent) => (
                            <button key={intent.id} onClick={() => setAiIntent(intent.id)} style={{
                              flex: isMobile ? "0 0 auto" : 1,
                              padding: isMobile ? "8px 10px" : "8px 12px",
                              borderRadius: 8,
                              border: "none",
                              cursor: "pointer",
                              background: activeAiIntent === intent.id ? `linear-gradient(135deg,${C.g1}15,${C.g2}15)` : "transparent",
                              color: activeAiIntent === intent.id ? C.text : C.textDim,
                              fontSize: isMobile ? 11 : 12,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}>
                              {intent.label}
                              {!isMobile && (
                                <span style={{ display: "block", fontSize: 9, opacity: 0.55, marginTop: 1, fontFamily: "'Outfit',sans-serif" }}>
                                  {intent.shortLabel}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7, marginTop: 10 }}>
                          {aiIntentData?.description || aiIntentMeta.description}
                        </div>
                        {aiModeBudget && (
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8, marginTop: 12 }}>
                            {[
                              { label: "실행", value: aiModeBudget.executed, color: C.text },
                              { label: "캐시", value: aiModeBudget.cached, color: C.success },
                              { label: "생략", value: aiModeBudget.skipped, color: C.info },
                              { label: "미지원", value: aiModeBudget.unsupported, color: C.textDim },
                              { label: "전역 예산", value: aiModeBudget.maxTasks, color: C.warning },
                            ].map((item) => (
                              <div key={item.label} style={{ background: C.surface, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: item.color, fontFamily: "'Outfit',sans-serif" }}>{item.value ?? 0}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {activeAiMode === "live_search" && aiIntentSummary && (
                          <div style={{ background: `${C.info}08`, borderRadius: 10, padding: 12, border: `1px solid ${C.info}20`, marginTop: 12 }}>
                            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1.2px" }}>
                              Grounding Summary
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(7, 1fr)", gap: 8, marginBottom: (aiIntentSummary.searchQueriesUsed?.length > 0 || aiIntentSummary.plannedSearchQueries?.length > 0 || aiIntentSummary.querySlotLabels?.length > 0) ? 10 : 0 }}>
                              {[
                                {
                                  label: "Grounded 엔진",
                                  value: `${aiIntentSummary.groundedCount || 0}/${aiIntentSummary.supportedCount || 0}`,
                                  tone: C.text,
                                },
                                {
                                  label: "공식 citation",
                                  value: `${aiIntentSummary.officialCitations || 0}/${aiIntentSummary.totalCitations || 0}`,
                                  tone: C.success,
                                },
                                {
                                  label: "공식 비율",
                                  value: formatRatioPercent(aiIntentSummary.officialCitationRatio),
                                  tone: C.success,
                                },
                                {
                                  label: "query 메타",
                                  value: `${aiIntentSummary.searchQueryCount || 0}개`,
                                  tone: C.info,
                                },
                                {
                                  label: "설계 slot",
                                  value: `${aiIntentSummary.querySlotCount || 0}개`,
                                  tone: C.warning,
                                },
                                {
                                  label: "fan-out 관측",
                                  value: `${aiIntentSummary.fanOutObservedCount || 0}/${aiIntentSummary.supportedCount || 0}`,
                                  tone: C.info,
                                },
                                {
                                  label: "주요 source",
                                  value: aiIntentSummary.dominantSourceTypeLabel || "—",
                                  tone: C.warning,
                                },
                              ].map((item) => (
                                <div key={item.label} style={{ background: C.surface, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}>{item.label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: item.tone, fontFamily: "'Outfit',sans-serif" }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                            {aiModeSummary && aiModeSummary !== aiIntentSummary && (
                              <div style={{ fontSize: 10, color: C.textDim, marginBottom: aiIntentSummary.searchQueriesUsed?.length > 0 ? 10 : 0 }}>
                                모드 전체 기준 공식 citation 비율: {formatRatioPercent(aiModeSummary.officialCitationRatio)} · query 메타 {aiModeSummary.searchQueryCount || 0}개 · fan-out 평균 {formatRatioPercent(aiModeSummary.fanOutCompletenessAverage)} · source mix {aiModeSummary.sourceMixDominantLabel || "—"}
                                {(aiModeSummary.factAlignedCount || aiModeSummary.factWrongEntityCount || aiModeSummary.factDomainMismatchCount || aiModeSummary.factServiceMismatchCount)
                                  ? ` · fact-check 정합 ${aiModeSummary.factAlignedCount || 0} / 다른 엔티티 ${aiModeSummary.factWrongEntityCount || 0}`
                                  : ""}
                                {aiModeSummary.dominantSourceFitLabel ? ` · source fit ${aiModeSummary.dominantSourceFitLabel}` : ""}
                              </div>
                            )}
                            {aiIntentSummary.searchQueriesUsed?.length > 0 && (
                              <>
                                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>엔진이 노출한 search query</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {aiIntentSummary.searchQueriesUsed.slice(0, 8).map((queryText) => (
                                    <span key={queryText} style={{ padding: "4px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted }}>
                                      {queryText}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                            {aiIntentSummary.querySlotLabels?.length > 0 && (
                              <div style={{ marginTop: aiIntentSummary.searchQueriesUsed?.length > 0 ? 10 : 0 }}>
                                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>설계된 query slot</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {aiIntentSummary.querySlotLabels.slice(0, 8).map((slotLabel) => (
                                    <span key={slotLabel} style={{ padding: "4px 8px", borderRadius: 999, background: `${C.warning}12`, border: `1px solid ${C.warning}25`, fontSize: 10, color: C.warning }}>
                                      {slotLabel}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {aiIntentSummary.plannedSearchQueries?.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>설계된 query angle</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {aiIntentSummary.plannedSearchQueries.slice(0, 8).map((queryText) => (
                                    <span key={queryText} style={{ padding: "4px 8px", borderRadius: 999, background: C.surface, border: `1px dashed ${C.warning}55`, fontSize: 10, color: C.textMuted }}>
                                      {queryText}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(aiIntentSummary.fanOutCompletenessAverage !== null || aiIntentSummary.sourceMixDominantLabel) && (
                              <div style={{ fontSize: 10, color: C.textDim, marginTop: 10 }}>
                                fan-out 평균 {formatRatioPercent(aiIntentSummary.fanOutCompletenessAverage)} · 관측 불투명 {aiIntentSummary.fanOutOpaqueCount || 0}개 · source mix {aiIntentSummary.sourceMixDominantLabel || "출처 없음"} · 권위도 {aiIntentSummary.dominantAuthorityLabel || "—"} · source fit {aiIntentSummary.dominantSourceFitLabel || "—"} · archetype {aiIntentSummary.dominantArchetypeLabel || "—"}
                              </div>
                            )}
                            {(aiIntentSummary.factAlignedCount || aiIntentSummary.factWrongEntityCount || aiIntentSummary.factDomainMismatchCount || aiIntentSummary.factServiceMismatchCount) ? (
                              <div style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>
                                fact-check 정합 {aiIntentSummary.factAlignedCount || 0}개 · 다른 엔티티 {aiIntentSummary.factWrongEntityCount || 0}개 · 도메인 불일치 {aiIntentSummary.factDomainMismatchCount || 0}개 · 서비스 불일치 {aiIntentSummary.factServiceMismatchCount || 0}개
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {aiModeResults.length > 0 ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                          {aiModeResults.map((r) => {
                            const eng = ENGINES.find((e) => e.id === r.engineId) || ENGINES[0];
                            const meta = getRecognitionMeta(r);
                            return (
                              <div key={`${r.engineId}-${r.intent}`} style={{ background: C.card, borderRadius: 10, padding: 12, textAlign: "center", border: `1px solid ${meta.color}25` }}>
                                <div style={{ fontSize: 18, marginBottom: 3 }}>{eng.icon}</div>
                                <div style={{ fontSize: 10, color: C.textMuted }}>{eng.name}</div>
                                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Outfit',sans-serif", color: meta.color }}>
                                  {typeof r.accuracy === "number" && Number.isFinite(r.accuracy) ? `${r.accuracy}%` : "—"}
                                </div>
                                <div style={{ fontSize: 9, color: meta.color }}>{meta.label}</div>
                              </div>
                            );
                          })}
                        </div>
                        {aiModeResults.map((r) => {
                          const eng = ENGINES.find((e) => e.id === r.engineId) || ENGINES[0];
                          const meta = getRecognitionMeta(r);
                          const fanOutMeta = getFanOutMeta(r.queryPlanCoverage);
                          const sourceMixMeta = getSourceMixMeta(r.sourceMix);
                          const sourceAuthorityMeta = getSourceAuthorityMeta(r.sourceProfile);
                          const sourceFitMeta = getSourceFitMeta(r.sourceProfile);
                          const factCheckMeta = getFactCheckMeta(r.factCheck);
                          const mp = r.mentionPosition;
                          const isRecognized = r.matchStatus === "recognized";
                          const mpLabel = mp?.bucket === "top" ? "상위 언급" : mp?.bucket === "middle" ? "중간 언급" : mp?.bucket === "bottom" ? "하위 언급" : "언급 없음";
                          const mpColor = mp?.bucket === "top" ? C.success : mp?.bucket === "middle" ? C.warning : C.danger;
                          const hasOfficialCitation = Boolean(r.citationMetrics?.hasOfficialCitation);
                          return (
                            <div key={`${r.engineId}-${r.intent}-detail`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                                <span style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: `${eng.color}18`, color: eng.color, fontWeight: 700, fontSize: 12 }}>{eng.icon}</span>
                                <span style={{ fontWeight: 600, color: C.text, fontSize: 12 }}>{eng.name}</span>
                                <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: meta.bg, color: meta.color }}>{meta.label}</span>
                                {mp?.found && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: `${mpColor}18`, color: isRecognized ? mpColor : C.textDim }}>
                                    {isRecognized ? mpLabel : `${mpLabel} (참고)`}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                  {r.intentLabel || aiIntentMeta.label}
                                </span>
                                <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                  {r.queryType || "entity_check"}
                                </span>
                                {typeof r.latencyMs === "number" && Number.isFinite(r.latencyMs) && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                    {r.latencyMs}ms
                                  </span>
                                )}
                                {r.tokenUsage?.total && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                    {r.tokenUsage.total} tokens
                                  </span>
                                )}
                                {r.citationMetrics?.total > 0 && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: r.citationMetrics?.hasOfficialCitation ? C.success : C.textDim }}>
                                    공식 citation {r.citationMetrics.official}/{r.citationMetrics.total}
                                  </span>
                                )}
                                {r.searchQueriesUsed?.length > 0 && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.info }}>
                                    search query {r.searchQueriesUsed.length}개
                                  </span>
                                )}
                                {r.queryPlan?.slotCount > 0 && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.warning }}>
                                    query slot {r.queryPlan.slotCount}개
                                  </span>
                                )}
                                {r.queryPlanCoverage?.plannedCount > 0 && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: fanOutMeta.bg, color: fanOutMeta.color }}>
                                    {fanOutMeta.label} {r.queryPlanCoverage.observedCount}/{r.queryPlanCoverage.plannedCount}
                                  </span>
                                )}
                                {r.sourceMix?.id && r.sourceMix.id !== "none" && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: sourceMixMeta.bg, color: sourceMixMeta.color }}>
                                    {sourceMixMeta.label}
                                  </span>
                                )}
                                {r.sourceProfile?.dominantAuthorityTier && r.sourceProfile.dominantAuthorityTier !== "none" && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: sourceAuthorityMeta.bg, color: sourceAuthorityMeta.color }}>
                                    {sourceAuthorityMeta.label}
                                  </span>
                                )}
                                {r.sourceProfile?.sourceFitStatus && r.sourceProfile.sourceFitStatus !== "none" && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: sourceFitMeta.bg, color: sourceFitMeta.color }}>
                                    {sourceFitMeta.label}
                                  </span>
                                )}
                                {r.factCheck?.verdict && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: factCheckMeta.bg, color: factCheckMeta.color }}>
                                    {factCheckMeta.label}
                                  </span>
                                )}
                                {r.groundingMetadata?.toolCallCount && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                    search call {r.groundingMetadata.toolCallCount}
                                  </span>
                                )}
                                {r.groundingMetadata?.searchResultCount && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                    search result {r.groundingMetadata.searchResultCount}
                                  </span>
                                )}
                                {r.groundingMetadata?.supportCount && (
                                  <span style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: C.surface, color: C.textDim }}>
                                    grounding support {r.groundingMetadata.supportCount}
                                  </span>
                                )}
                              </div>
                              {r.query && (
                                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.6 }}>
                                  질의: {r.query.split("\n")[0]}
                                </div>
                              )}
                              {r.reason && (
                                <div style={{ fontSize: 11, color: meta.color, marginBottom: 8, lineHeight: 1.6 }}>
                                  {r.reason}
                                </div>
                              )}
                              {r.factCheck?.reasons?.length > 0 && (
                                <div style={{ fontSize: 10, color: factCheckMeta.color, marginBottom: 8, lineHeight: 1.6 }}>
                                  {r.factCheck.reasons.slice(0, 2).join(" · ")}
                                </div>
                              )}
                              {r.searchQueriesUsed?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>searchQueriesUsed</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {r.searchQueriesUsed.slice(0, 6).map((queryText) => (
                                      <span key={`${r.engineId}-${queryText}`} style={{ padding: "4px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted }}>
                                        {queryText}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.queryPlan?.slots?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>
                                    query plan
                                    {r.queryPlanCoverage?.plannedCount > 0 && (
                                      <span style={{ color: fanOutMeta.color }}>
                                        {` · ${fanOutMeta.label} ${r.queryPlanCoverage.observedCount}/${r.queryPlanCoverage.plannedCount}`}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: "grid", gap: 6 }}>
                                    {r.queryPlan.slots.map((slot) => (
                                      <div key={`${r.engineId}-${slot.id}`} style={{ padding: 8, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}` }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                                          <span style={{ fontSize: 10, fontWeight: 700, color: C.warning }}>{slot.label}</span>
                                          {slot.goal && <span style={{ fontSize: 10, color: C.textDim }}>{slot.goal}</span>}
                                        </div>
                                        {slot.queries?.length > 0 && (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {slot.queries.slice(0, 4).map((queryText) => (
                                              <span key={`${slot.id}-${queryText}`} style={{ padding: "3px 7px", borderRadius: 999, background: `${C.warning}10`, border: `1px dashed ${C.warning}40`, fontSize: 10, color: C.textMuted }}>
                                                {queryText}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.sourceProfile?.total > 0 && (
                                <div style={{ marginBottom: 8, fontSize: 10, color: C.textDim }}>
                                  source profile · archetype {r.sourceProfile.archetypeLabel || "—"} · 주요 유형 {r.sourceProfile.dominantTypeLabel || "—"} · 권위 {r.sourceProfile.dominantAuthorityLabel || "—"} · source fit {r.sourceProfile.sourceFitLabel || "—"} · high-authority {formatRatioPercent(r.sourceProfile.highAuthorityRatio)}
                                </div>
                              )}
                              {r.payloadDiagnostics && (
                                <details style={{ marginBottom: 8 }}>
                                  <summary style={{ cursor: "pointer", fontSize: 10, color: C.textDim }}>
                                    payload diagnostics
                                  </summary>
                                  <pre style={{ marginTop: 6, fontSize: 10, color: C.textDim, lineHeight: 1.6, padding: 10, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'Menlo','Monaco',monospace" }}>
                                    {JSON.stringify(r.payloadDiagnostics, null, 2)}
                                  </pre>
                                </details>
                              )}
                              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, padding: 10, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, maxHeight: 400, overflow: "auto", whiteSpace: "pre-wrap" }}>
                                {r.response}
                              </div>
                              {r.citations?.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>
                                    실제 인용 출처
                                    {hasOfficialCitation && <span style={{ color: C.success, fontWeight: 700 }}> · 공식 사이트 인용 ✓</span>}
                                    {r.sourceMix?.id && r.sourceMix.id !== "none" && (
                                      <span style={{ color: sourceMixMeta.color }}>
                                        {` · ${sourceMixMeta.label}`}
                                      </span>
                                    )}
                                    {r.citationMetrics?.officialRatio !== null && (
                                      <span style={{ color: hasOfficialCitation ? C.success : C.textDim }}>
                                        {` · 공식 비율 ${formatRatioPercent(r.citationMetrics.officialRatio)}`}
                                      </span>
                                    )}
                                  </div>
                                  {(r.citationDetails?.length > 0 ? r.citationDetails : r.citations.map((citation) => ({ url: citation }))).slice(0, 5).map((detail, index) => {
                                    const citation = detail?.url || "";
                                    const isOfficial = detail?.isOfficial ?? matchesOfficialDomain(citation, officialDomain);
                                    const citationTypeMeta = getCitationTypeMeta(detail);
                                    const citationAuthorityMeta = getSourceAuthorityMeta({
                                      dominantAuthorityTier: detail?.authorityTier,
                                    });
                                    return (
                                      <div key={`${r.engineId}-${index}`} style={{ fontSize: 10, color: isOfficial ? C.success : C.textDim, padding: "3px 0", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                                        {isOfficial && <span>✓</span>}
                                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{citation}</span>
                                        {detail?.sourceTypeId && (
                                          <span style={{ padding: "2px 6px", borderRadius: 999, background: citationTypeMeta.bg, color: citationTypeMeta.color, fontSize: 9, fontWeight: 700 }}>
                                            {citationTypeMeta.label}
                                          </span>
                                        )}
                                        {detail?.authorityTier && (
                                          <span style={{ padding: "2px 6px", borderRadius: 999, background: citationAuthorityMeta.bg, color: citationAuthorityMeta.color, fontSize: 9, fontWeight: 700 }}>
                                            {detail.authorityLabel || citationAuthorityMeta.label}
                                          </span>
                                        )}
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
                        현재 선택한 모드의 AI 결과가 없습니다.
                      </div>
                    )}
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

                {improvements.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                    개선 항목을 불러오지 못했습니다. 다시 진단해 주세요.
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
                        <ProvenanceBadge source={item.source} compact />
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
                  <button onClick={handleProfileRequest} style={{ padding: "9px 24px", borderRadius: 9, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${C.g1},${C.g2})`, color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>AI 프로필 페이지 제작 문의 →</button>
                </div>
              </div>
            )}

            {/* Raw Data */}
            {tab === "rawdata" && (
              <div>
                <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>AI가 이 페이지에서 읽은 신호 요약입니다</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                    아래는 메타 정보와 본문 미리보기입니다. 보안상 전체 본문 대신 핵심 신호만 표시하며, 여기에 없는 정보는 AI가 알기 어렵습니다.
                  </div>

                  {crawlData && (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>페이지 메타 정보</div>
                        <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                          {(() => {
                            const indexability = crawlData.metadata?.indexability;
                            const indexabilityMeta = getIndexabilityMeta(indexability);
                            const canonicalMatchesUrl = crawlData.metadata?.canonicalMatchesUrl;
                            const canonicalSameOrigin = crawlData.metadata?.canonicalSameOrigin;

                            return (
                              <>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Title:</strong> <span style={{ color: C.textMuted }}>{crawlData.title || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Description:</strong> <span style={{ color: C.textMuted }}>{crawlData.description || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Canonical:</strong> <span style={{ color: crawlData.metadata?.canonicalUrl ? C.textMuted : C.textDim }}>{crawlData.metadata?.canonicalUrl || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}>
                            <strong style={{ color: C.pacp }}>Indexability:</strong>{" "}
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: indexabilityMeta.bg, color: indexabilityMeta.color, marginRight: 8 }}>
                              {indexabilityMeta.label}
                            </span>
                            <span style={{ color: C.textMuted }}>
                              {canonicalMatchesUrl === true
                                ? "self-canonical"
                                : canonicalMatchesUrl === false
                                  ? "canonical mismatch"
                                  : "canonical 미확인"}
                              {canonicalSameOrigin === false ? " · cross-origin canonical" : ""}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}>
                            <strong style={{ color: C.pacp }}>Indexability 근거:</strong>{" "}
                            <span style={{ color: C.textMuted }}>
                              {(indexability?.reasons || []).join(" · ") || "(없음)"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Meta Robots:</strong> <span style={{ color: crawlData.metadata?.robotsMeta ? C.textMuted : C.textDim }}>{crawlData.metadata?.robotsMeta || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>Googlebot Meta:</strong> <span style={{ color: crawlData.metadata?.googlebotRobotsMeta ? C.textMuted : C.textDim }}>{crawlData.metadata?.googlebotRobotsMeta || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.pacp }}>X-Robots-Tag:</strong> <span style={{ color: crawlData.metadata?.xRobotsTag ? C.textMuted : C.textDim }}>{crawlData.metadata?.xRobotsTag || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.sep }}>H1 태그:</strong> <span style={{ color: crawlData.metadata?.headingStructure?.h1Count > 0 ? C.success : C.danger }}>{crawlData.metadata?.headingStructure?.h1Count || 0}개 — {crawlData.metadata?.headingStructure?.h1Texts?.join(", ") || "(없음)"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.sep }}>H2 태그:</strong> <span style={{ color: C.textMuted }}>{crawlData.metadata?.headingStructure?.h2Count || 0}개</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>JSON-LD:</strong> <span style={{ color: crawlData.metadata?.hasJsonLd ? C.success : C.danger }}>{crawlData.metadata?.hasJsonLd ? "✅ 감지됨" : "❌ 없음"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>Open Graph:</strong> <span style={{ color: crawlData.metadata?.hasOpenGraph ? C.success : C.danger }}>{crawlData.metadata?.hasOpenGraph ? "✅ 감지됨" : "❌ 없음"}</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>이미지:</strong> <span style={{ color: C.textMuted }}>{crawlData.metadata?.imageCount || 0}개 (Alt 없음: {crawlData.metadata?.imagesWithoutAlt || 0}개)</span></div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}><strong style={{ color: C.spf }}>총 단어 수:</strong> <span style={{ color: C.textMuted }}>{crawlData.metadata?.totalWordCount || 0}</span></div>
                          <div style={{ fontSize: 12 }}><strong style={{ color: C.spf }}>긴 텍스트 블록 (&gt;512토큰):</strong> <span style={{ color: (crawlData.metadata?.longTextBlocks || 0) > 0 ? C.warning : C.success }}>{crawlData.metadata?.longTextBlocks || 0}개</span></div>
                              </>
                            );
                          })()}
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
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                              {!crawlData.discoverySignals.sitemap?.fetched
                                ? "sitemap.xml 확인 불가"
                                : crawlData.discoverySignals.sitemap.exists
                                  ? `sitemap.xml 확인 완료 · ${crawlData.discoverySignals.sitemap.format} · loc ${crawlData.discoverySignals.sitemap.locCount ?? crawlData.discoverySignals.sitemap.urlCount ?? 0}개`
                                  : "sitemap.xml 미확인"}
                              {crawlData.discoverySignals.sitemap?.exists
                                ? ` · ${crawlData.discoverySignals.sitemap.containsRequestedUrl || crawlData.discoverySignals.sitemap.containsRequestedPath ? "요청 URL/경로 포함" : "요청 URL/경로 미포함"}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>
                          크롤링 미리보기 ({crawlData.contentLength?.toLocaleString() || 0}자 중 최대 1,600자 표시)
                        </div>
                        <pre style={{ background: C.surface, borderRadius: 8, padding: 14, border: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 500, overflow: "auto", fontFamily: "'Menlo','Monaco',monospace" }}>
                          {crawlData.contentPreview || "(크롤링된 콘텐츠 미리보기 없음 — CSR 사이트일 경우 AI 크롤러가 빈 페이지만 수집합니다)"}
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
            {ENTITY_LABEL} | Princeton GEO Research Based<br />
            © 2026 AAO. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
