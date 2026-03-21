// lib/ai-check-api.js — Engine API calls + Prompts + Payload extraction
// Extracted from ai-check.js — no business logic changes

import { extractResponseText } from "./utils.js";
import {
  normalizeEntityInput,
  extractStrongEntityHints,
  extractServiceHints,
  inferCategoryHint,
  getEntityAnchorTerms,
  getServiceDefinitionHints,
  getOfficialDomain,
  getHostname,
  isVertexGroundingUrl,
  extractHostnameCandidate,
  toCanonicalCitationUrl,
  hostnameMatchesAny,
  uniqueStrings,
  hashString,
  sanitizePromptInput,
} from "./ai-check-entity.js";

import {
  computeCitationMetrics,
  computeCitationDetails,
  computeCitationMetricsFromDetails,
  roundMetric,
} from "./ai-check-classify.js";

// ---------------------------------------------------------------------------
// Constants (shared with other modules via ai-check.js facade)
// ---------------------------------------------------------------------------

export const AI_CHECK_MODES = {
  STRICT_RECALL: "strict_recall",
  LIVE_SEARCH: "live_search",
};

export const AI_CHECK_INTENTS = {
  awareness: {
    id: "awareness",
    label: "인지",
    shortLabel: "Awareness",
    description: "브랜드가 무엇인지 묻는 기본 인식 질문입니다.",
  },
  comparison: {
    id: "comparison",
    label: "비교",
    shortLabel: "Comparison",
    description: "유사 서비스와 비교될 때 브랜드가 어떻게 설명되는지 확인합니다.",
  },
  purchase: {
    id: "purchase",
    label: "구매",
    shortLabel: "Purchase",
    description: "도입/가격/사례 같은 구매 의사결정 질문에서 보이는지 확인합니다.",
  },
};

export const DEFAULT_INTENTS = ["awareness", "comparison", "purchase"];
export const ENGINE_ORDER = ["chatgpt", "perplexity", "gemini"];

export const MODE_META = {
  [AI_CHECK_MODES.STRICT_RECALL]: {
    id: AI_CHECK_MODES.STRICT_RECALL,
    label: "기억 기반 인식",
    shortLabel: "Strict Recall",
    description: "웹 검색 없이 모델이 기존 기억만으로 회사를 설명하는지 확인합니다.",
    queryType: "entity_recall",
  },
  [AI_CHECK_MODES.LIVE_SEARCH]: {
    id: AI_CHECK_MODES.LIVE_SEARCH,
    label: "실시간 검색 인식",
    shortLabel: "Live Search",
    description: "검색 도구와 인용 출처를 포함해 지금 웹에서 회사를 찾을 수 있는지 확인합니다.",
    queryType: "entity_live_search",
  },
};

export const SUPPORTED_MODE_BY_ENGINE = {
  chatgpt: [AI_CHECK_MODES.STRICT_RECALL, AI_CHECK_MODES.LIVE_SEARCH],
  perplexity: [AI_CHECK_MODES.LIVE_SEARCH],
  gemini: [AI_CHECK_MODES.STRICT_RECALL, AI_CHECK_MODES.LIVE_SEARCH],
};

export const SEARCH_QUERY_NOISE = new Set([
  "search",
  "web_search",
  "web search",
  "web-search",
  "search_preview",
  "web_search_preview",
  "web search preview",
  "tool",
  "action",
  "tool_call",
  "tool call",
  "function_call",
  "function call",
  "browser.search",
  "browser_search",
]);

// ---------------------------------------------------------------------------
// Mode / Intent meta
// ---------------------------------------------------------------------------

export function getModeMeta(mode) {
  return MODE_META[mode] || MODE_META[AI_CHECK_MODES.LIVE_SEARCH];
}

export function getIntentMeta(intent) {
  return AI_CHECK_INTENTS[intent] || AI_CHECK_INTENTS.awareness;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

export function pickTemplate(templates, seed) {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  return templates[hashString(seed) % templates.length];
}

// ---------------------------------------------------------------------------
// Query plan
// ---------------------------------------------------------------------------

export function createQuerySlot(id, label, goal, queries) {
  const normalizedQueries = uniqueStrings(queries).slice(0, 4);
  return {
    id,
    label,
    goal,
    queries: normalizedQueries,
  };
}

export function buildQueryPlan(entityInput, mode, intent) {
  if (mode !== AI_CHECK_MODES.LIVE_SEARCH) return null;

  const entity = normalizeEntityInput(entityInput);
  const officialDomain = getOfficialDomain(entityInput);
  const rootLabel = officialDomain ? officialDomain.split(".")[0] : "";
  const anchors = uniqueStrings([
    entity.companyName,
    entity.officialTitle,
    officialDomain,
    rootLabel,
    ...entity.aliases,
  ]).slice(0, 6);
  const categoryHint = inferCategoryHint(entityInput);
  const serviceHints = extractServiceHints(entityInput).slice(0, 3);
  const displayName = entity.companyName || officialDomain || rootLabel || "이 회사";
  const categoryQuery = serviceHints.length > 0 ? serviceHints.join(" ") : categoryHint;

  const brandSlot = createQuerySlot(
    "brand",
    "브랜드 정체성",
    "정확한 회사/브랜드 엔티티를 특정합니다.",
    [
      `${displayName} 회사`,
      `${displayName} official site`,
      `${displayName} company profile`,
      anchors[1] || "",
    ]
  );

  const officialSlot = createQuerySlot(
    "official",
    "공식 출처",
    "공식 도메인과 자기소개 페이지를 우선 확인합니다.",
    [
      `${displayName} 공식 사이트`,
      officialDomain ? `site:${officialDomain} ${displayName}` : "",
      officialDomain ? `site:${officialDomain} about` : "",
      officialDomain ? officialDomain : "",
    ]
  );

  const awarenessSlots = [
    brandSlot,
    officialSlot,
    createQuerySlot(
      "category",
      "카테고리 문맥",
      "이 회사가 어떤 서비스 카테고리에 속하는지 확인합니다.",
      [
        `${displayName} ${categoryQuery}`,
        `${categoryQuery} company ${displayName}`,
        `${displayName} service`,
        `${displayName} 무엇을 하는 회사`,
      ]
    ),
    createQuerySlot(
      "trust",
      "신뢰 신호",
      "자기소개, 소개글, 외부 프로필 같은 기본 신뢰 신호를 확인합니다.",
      [
        `${displayName} about`,
        `${displayName} mission`,
        `${displayName} profile`,
        `${displayName} 소개`,
      ]
    ),
  ];

  const comparisonSlots = [
    brandSlot,
    createQuerySlot(
      "category",
      "카테고리 기준",
      "같은 문제를 푸는 서비스 묶음 안에서 위치를 봅니다.",
      [
        `${displayName} ${categoryQuery}`,
        `${categoryQuery} alternatives`,
        `${categoryQuery} competitors`,
        `${displayName} category`,
      ]
    ),
    createQuerySlot(
      "competitor",
      "경쟁 구도",
      "대안/경쟁사/비교 문맥을 찾습니다.",
      [
        `${displayName} alternatives`,
        `${displayName} competitors`,
        `${displayName} vs alternatives`,
        `${displayName} comparison`,
      ]
    ),
    createQuerySlot(
      "differentiator",
      "차별점",
      "공식 문서나 리뷰에서 차별화 포인트를 찾습니다.",
      [
        `${displayName} differentiators`,
        `${displayName} unique features`,
        `${displayName} comparison official`,
        `${displayName} why choose`,
      ]
    ),
  ];

  const purchaseSlots = [
    officialSlot,
    createQuerySlot(
      "commercial",
      "가격/플랜",
      "가격, 플랜, 견적 같은 구매 신호를 확인합니다.",
      [
        `${displayName} pricing`,
        `${displayName} plans`,
        `${displayName} quote`,
        `${displayName} 가격`,
      ]
    ),
    createQuerySlot(
      "proof",
      "도입 증거",
      "사례, 고객, 구현 예시를 찾습니다.",
      [
        `${displayName} case study`,
        `${displayName} customer story`,
        `${displayName} implementation`,
        `${displayName} 사례`,
      ]
    ),
    createQuerySlot(
      "conversion",
      "문의/전환",
      "문의 경로, 데모, 상담 CTA를 확인합니다.",
      [
        `${displayName} contact`,
        `${displayName} demo`,
        officialDomain ? `site:${officialDomain} contact` : "",
        officialDomain ? `site:${officialDomain} pricing` : "",
      ]
    ),
  ];

  const slots =
    intent === "comparison"
      ? comparisonSlots
      : intent === "purchase"
        ? purchaseSlots
        : awarenessSlots;
  const plannedQueries = uniqueStrings(slots.flatMap((slot) => slot.queries)).slice(0, 16);

  return {
    mode,
    intent,
    categoryHint,
    entityAnchors: anchors,
    slots,
    slotCount: slots.length,
    plannedQueries,
    plannedQueryCount: plannedQueries.length,
  };
}

export function renderQueryPlanPrompt(queryPlan) {
  if (!queryPlan?.slots?.length) return "";

  const lines = queryPlan.slots.map((slot) => {
    const examples = slot.queries.slice(0, 2).join(" | ");
    return `- ${slot.label}: ${examples}`;
  });

  return [
    "검색할 때는 아래 슬롯을 우선순위로 반영해줘. 질의를 그대로 복사할 필요는 없지만 각 슬롯의 의도는 충족해줘.",
    ...lines,
    "동명이인이 보이면 공식 도메인과 서비스 정의가 일치하는 엔티티만 남기고, 아니면 모른다고 답해줘.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildPromptTemplates(entityInput, mode) {
  const entity = normalizeEntityInput(entityInput);
  const name = entity.companyName;
  const categoryHint = inferCategoryHint(entity);

  if (mode === AI_CHECK_MODES.STRICT_RECALL) {
    return {
      awareness: [
        () => [
          `${name}이 뭐야?`,
          "웹 검색이나 외부 도구를 사용하지 말고, 지금 기억하는 정보만으로 설명해줘.",
          "모르면 추측하지 말고 모른다고 답해줘.",
        ].join("\n"),
        () => [
          `${name} 어떤 회사야?`,
          "기억하는 정보만으로 핵심 서비스와 성격을 설명해줘.",
          "외부 자료를 찾지 말고, 모르면 모른다고 말해줘.",
        ].join("\n"),
      ],
      comparison: [
        () => [
          `${name}를 비슷한 ${categoryHint} 서비스와 비교하면 어떤 특징이 있어?`,
          "웹 검색이나 외부 도구 없이 기억만으로 답하고, 모르면 모른다고 답해줘.",
        ].join("\n"),
        () => [
          `${name}의 차별점을 설명해줘.`,
          "비슷한 서비스와 비교하는 관점으로 말하되 외부 도구는 사용하지 말고, 모르면 추측하지 말아줘.",
        ].join("\n"),
      ],
      purchase: [
        () => [
          `${name}을 도입하려는 사람이 확인해야 할 정보는 뭐야?`,
          "기억만으로 답하고, 웹 검색은 하지 마.",
          "가격/도입/사례를 모르면 모른다고 답해줘.",
        ].join("\n"),
        () => [
          `${name}을 검토 중인 구매 담당자에게 어떤 정보를 줄 수 있어?`,
          "기억만으로 설명하고, 없는 정보는 추측하지 말아줘.",
        ].join("\n"),
      ],
    };
  }

  return {
    awareness: [
      () => [
        `${name}이 뭐야?`,
        "웹에서 확인 가능한 공식 사이트와 외부 출처를 참고해 어떤 회사인지 4~6문장으로 설명해줘.",
        "공식 사이트를 찾았으면 출처에 반영하고, 모르면 추측하지 말고 모른다고 답해줘.",
      ].join("\n"),
      () => [
        `${name} 어떤 회사야?`,
        "실시간 검색으로 공식 사이트와 신뢰할 만한 출처를 확인한 뒤, 핵심 서비스와 정체성을 요약해줘.",
      ].join("\n"),
    ],
    comparison: [
      () => [
        `${name}를 비슷한 ${categoryHint} 서비스와 비교하면 어떤 특징이 있어?`,
        "웹에서 공식 사이트나 비교 가능한 출처를 찾아 차이점과 함께 설명해줘.",
        "모르면 추측하지 말고 모른다고 답해줘.",
      ].join("\n"),
      () => [
        `${name}를 대안과 비교하려는 사람이 어떤 포인트를 봐야 해?`,
        "검색해서 공식 사이트와 비교 가능한 출처를 기준으로 설명해줘.",
      ].join("\n"),
    ],
    purchase: [
      () => [
        `${name}을 도입하려는 사람이 궁금해할 가격, 문의, 도입 방식, 사례 정보를 찾아줘.`,
        "웹에서 공식 사이트를 우선 확인하고, 없으면 없다고 답해줘.",
      ].join("\n"),
      () => [
        `${name} 구매나 도입을 검토할 때 확인할 핵심 정보를 검색해서 요약해줘.`,
        "공식 페이지, 사례, 문의 경로 중심으로 설명해줘.",
      ].join("\n"),
    ],
  };
}

export function buildCompanyPrompt(entityInput, mode, intent = "awareness", queryPlan = null) {
  const templates = buildPromptTemplates(entityInput, mode)[intent] || buildPromptTemplates(entityInput, mode).awareness;
  const template = pickTemplate(
    templates,
    `${normalizeEntityInput(entityInput).companyName}:${mode}:${intent}`
  );
  const prompt = typeof template === "function" ? template() : "";
  if (mode !== AI_CHECK_MODES.LIVE_SEARCH) return prompt;

  const queryPlanPrompt = renderQueryPlanPrompt(queryPlan);
  return queryPlanPrompt ? `${prompt}\n\n${queryPlanPrompt}` : prompt;
}

// ---------------------------------------------------------------------------
// OpenAI Responses output text extraction
// ---------------------------------------------------------------------------

export function extractOpenAiResponsesOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  let text = "";

  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && part?.text) {
        text += part.text;
      }
    }
  }

  return text.trim();
}

// ---------------------------------------------------------------------------
// Token usage
// ---------------------------------------------------------------------------

export function extractTokenUsage(payload) {
  const inputTokens = payload?.usage?.input_tokens ?? payload?.usageMetadata?.promptTokenCount ?? null;
  const outputTokens = payload?.usage?.output_tokens ?? payload?.usageMetadata?.candidatesTokenCount ?? null;
  const totalTokens = payload?.usage?.total_tokens ?? payload?.usageMetadata?.totalTokenCount ?? null;

  if (![inputTokens, outputTokens, totalTokens].some((value) => Number.isFinite(Number(value)))) {
    return null;
  }

  return {
    input: Number.isFinite(Number(inputTokens)) ? Number(inputTokens) : null,
    output: Number.isFinite(Number(outputTokens)) ? Number(outputTokens) : null,
    total: Number.isFinite(Number(totalTokens)) ? Number(totalTokens) : null,
  };
}

// ---------------------------------------------------------------------------
// Search query extraction
// ---------------------------------------------------------------------------

export function normalizeSearchQuery(value) {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > 200) return "";
  if (/^https?:\/\//i.test(normalized)) return "";
  if (SEARCH_QUERY_NOISE.has(normalized.toLowerCase())) return "";

  return normalized;
}

export function sanitizePreview(value, limit = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

export function collectSearchQueries(value, bucket, depth = 0) {
  if (depth > 6 || value == null) return;

  if (typeof value === "string") {
    const query = normalizeSearchQuery(value);
    if (query) bucket.push(query);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchQueries(item, bucket, depth + 1));
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const queryLikeKey =
      normalizedKey === "query" ||
      normalizedKey === "queries" ||
      normalizedKey === "searchquery" ||
      normalizedKey === "searchqueries" ||
      normalizedKey === "search_query" ||
      normalizedKey === "search_queries" ||
      normalizedKey === "rewritten_query" ||
      normalizedKey === "rewritten_queries" ||
      normalizedKey === "search_term" ||
      normalizedKey === "search_terms";

    if (queryLikeKey) {
      collectSearchQueries(child, bucket, depth + 1);
      continue;
    }

    if ((normalizedKey.includes("query") || normalizedKey.includes("search")) && typeof child === "string") {
      const query = normalizeSearchQuery(child);
      if (query) bucket.push(query);
      continue;
    }

    if (
      normalizedKey.includes("query") ||
      normalizedKey.includes("search") ||
      normalizedKey.includes("tool") ||
      normalizedKey.includes("action")
    ) {
      if (typeof child === "object" && child !== null) {
        collectSearchQueries(child, bucket, depth + 1);
      }
    }
  }
}

export function collectPayloadDiagnostics(value, bucket, path = "root", depth = 0, maxEntries = 16) {
  if (depth > 5 || value == null || bucket.length >= maxEntries) return;

  if (Array.isArray(value)) {
    value.slice(0, 8).forEach((item, index) => {
      collectPayloadDiagnostics(item, bucket, `${path}[${index}]`, depth + 1, maxEntries);
    });
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (bucket.length >= maxEntries) break;

    const normalizedKey = key.toLowerCase();
    const nextPath = `${path}.${key}`;
    const looksRelevant =
      normalizedKey.includes("query") ||
      normalizedKey.includes("search") ||
      normalizedKey.includes("tool") ||
      normalizedKey.includes("action");

    if (looksRelevant) {
      bucket.push({
        path: nextPath,
        type: Array.isArray(child) ? "array" : typeof child,
        preview: typeof child === "string" ? sanitizePreview(child, 80) : null,
      });
    }

    if (typeof child === "object" && child !== null) {
      collectPayloadDiagnostics(child, bucket, nextPath, depth + 1, maxEntries);
    }
  }
}

export function summarizeObjectKeys(value, limit = 12) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).slice(0, limit)
    : [];
}

export function collectExplicitQueryValues(value, bucket) {
  if (typeof value === "string") {
    const query = normalizeSearchQuery(value);
    if (query) bucket.push(query);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectExplicitQueryValues(item, bucket));
  }
}

export function extractKnownQueryFields(value) {
  const queries = [];

  [
    value?.action?.query,
    value?.action?.queries,
    value?.action?.search_query,
    value?.action?.search_queries,
    value?.action?.rewritten_query,
    value?.action?.rewritten_queries,
    value?.query,
    value?.queries,
    value?.search_query,
    value?.search_queries,
    value?.rewritten_query,
    value?.rewritten_queries,
  ].forEach((candidate) => collectExplicitQueryValues(candidate, queries));

  return uniqueStrings(queries);
}

export function extractChatGptSearchQueries(payload) {
  const searchNodes = Array.isArray(payload?.output)
    ? payload.output.filter((item) => typeof item?.type === "string" && item.type.toLowerCase().includes("search"))
    : [];
  return uniqueStrings(searchNodes.flatMap((node) => extractKnownQueryFields(node)));
}

export function countChatGptSearchToolCalls(payload) {
  return Array.isArray(payload?.output)
    ? payload.output.filter((item) => typeof item?.type === "string" && item.type.toLowerCase().includes("search")).length
    : 0;
}

export function extractPerplexitySearchQueries(payload) {
  const queries = [];
  collectSearchQueries(
    [
      payload?.search_queries,
      payload?.searchQueries,
      payload?.web_search_queries,
      payload?.webSearchQueries,
      payload?.choices?.[0]?.search_queries,
      payload?.choices?.[0]?.searchQueries,
      payload?.choices?.[0]?.message?.search_queries,
      payload?.choices?.[0]?.message?.searchQueries,
    ].filter(Boolean),
    queries
  );
  return uniqueStrings(queries);
}

export function getPerplexitySearchResultCount(payload) {
  const candidates = [
    payload?.search_results,
    payload?.searchResults,
    payload?.web_results,
    payload?.webResults,
    payload?.choices?.[0]?.search_results,
    payload?.choices?.[0]?.searchResults,
    payload?.choices?.[0]?.message?.search_results,
    payload?.choices?.[0]?.message?.searchResults,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.length;
    }
  }

  return null;
}

export function getGeminiGroundingMetadataNode(payload) {
  return (
    payload?.candidates?.[0]?.groundingMetadata ||
    payload?.candidates?.[0]?.grounding_metadata ||
    payload?.groundingMetadata ||
    payload?.grounding_metadata ||
    null
  );
}

export function getGeminiGroundingChunks(payload) {
  const metadata = getGeminiGroundingMetadataNode(payload);
  if (Array.isArray(metadata?.groundingChunks)) return metadata.groundingChunks;
  if (Array.isArray(metadata?.grounding_chunks)) return metadata.grounding_chunks;
  return [];
}

export function getGeminiGroundingSupports(payload) {
  const metadata = getGeminiGroundingMetadataNode(payload);
  if (Array.isArray(metadata?.groundingSupports)) return metadata.groundingSupports;
  if (Array.isArray(metadata?.grounding_supports)) return metadata.grounding_supports;
  return [];
}

export function extractGeminiSearchQueries(payload) {
  const metadata = getGeminiGroundingMetadataNode(payload);
  return uniqueStrings(
    Array.isArray(metadata?.webSearchQueries)
      ? metadata.webSearchQueries
      : Array.isArray(metadata?.web_search_queries)
        ? metadata.web_search_queries
        : []
  );
}

export function extractGeminiCitations(payload) {
  return uniqueStrings(
    getGeminiGroundingChunks(payload)
      .map((chunk) => {
        const rawUrl = chunk?.web?.uri || chunk?.web?.url || chunk?.uri || chunk?.source?.uri || "";
        if (!rawUrl) return "";
        if (!isVertexGroundingUrl(rawUrl)) return rawUrl;

        const hintedHostname =
          extractHostnameCandidate(chunk?.web?.title) ||
          extractHostnameCandidate(chunk?.title) ||
          extractHostnameCandidate(chunk?.source?.title) ||
          extractHostnameCandidate(chunk?.retrievedContext?.title) ||
          extractHostnameCandidate(chunk?.retrieved_context?.title);

        return toCanonicalCitationUrl(hintedHostname) || rawUrl;
      })
      .filter(Boolean)
  );
}

export function getGeminiGroundingChunkCount(payload) {
  const chunks = getGeminiGroundingChunks(payload);
  return chunks.length > 0 ? chunks.length : null;
}

export function getGeminiGroundingSupportCount(payload) {
  const supports = getGeminiGroundingSupports(payload);
  return supports.length > 0 ? supports.length : null;
}

export function buildPayloadDiagnostics({ engine, mode, payload, searchQueriesUsed, citations }) {
  if (mode !== AI_CHECK_MODES.LIVE_SEARCH) return null;

  const searchSignals = [];
  collectPayloadDiagnostics(payload, searchSignals);

  return {
    engine,
    topLevelKeys: summarizeObjectKeys(payload),
    outputTypes: Array.isArray(payload?.output)
      ? Array.from(new Set(payload.output.map((item) => item?.type).filter(Boolean))).slice(0, 10)
      : [],
    choiceKeys: summarizeObjectKeys(payload?.choices?.[0]),
    messageKeys: summarizeObjectKeys(payload?.choices?.[0]?.message),
    searchSignalCount: searchSignals.length,
    searchSignals: searchSignals.slice(0, 12),
    extractedQueries: uniqueStrings(searchQueriesUsed).slice(0, 12),
    citationCount: uniqueStrings(citations).length,
  };
}

export function maybeLogPayloadDiagnostics(config, label, diagnostics) {
  if (!config?.debugPayloads || !diagnostics) return;
  console.log(`[AAO][AI_CHECK_DEBUG] ${label} ${JSON.stringify(diagnostics)}`);
}

export function buildGroundingMetadata({ engine, mode, payload, citations, searchQueriesUsed, entityInput }) {
  if (mode !== AI_CHECK_MODES.LIVE_SEARCH) return null;

  const citMetrics = computeCitationMetrics(citations, entityInput);
  const chatgptToolCalls = engine === "chatgpt" ? countChatGptSearchToolCalls(payload) : null;
  const perplexitySearchResults = engine === "perplexity" ? getPerplexitySearchResultCount(payload) : null;
  const geminiGroundingChunks = engine === "gemini" ? getGeminiGroundingChunkCount(payload) : null;
  const geminiGroundingSupports = engine === "gemini" ? getGeminiGroundingSupportCount(payload) : null;
  const grounded =
    citMetrics.total > 0 ||
    (Array.isArray(searchQueriesUsed) && searchQueriesUsed.length > 0) ||
    (Number.isFinite(chatgptToolCalls) && chatgptToolCalls > 0) ||
    (Number.isFinite(perplexitySearchResults) && perplexitySearchResults > 0) ||
    (Number.isFinite(geminiGroundingChunks) && geminiGroundingChunks > 0) ||
    (Number.isFinite(geminiGroundingSupports) && geminiGroundingSupports > 0);

  return {
    grounded,
    searchQueryCount: Array.isArray(searchQueriesUsed) ? searchQueriesUsed.length : 0,
    toolCallCount: Number.isFinite(chatgptToolCalls) ? chatgptToolCalls : null,
    searchResultCount: Number.isFinite(perplexitySearchResults)
      ? perplexitySearchResults
      : Number.isFinite(geminiGroundingChunks)
        ? geminiGroundingChunks
        : null,
    sourceCount: citMetrics.total,
    officialCitationCount: citMetrics.official,
    officialCitationRatio: citMetrics.officialRatio,
    hasOfficialCitation: citMetrics.hasOfficialCitation,
    supportCount: Number.isFinite(geminiGroundingSupports) ? geminiGroundingSupports : null,
  };
}

// ---------------------------------------------------------------------------
// Response constructors
// ---------------------------------------------------------------------------

export function createBaseResponse(engine, mode, intent, entityInput) {
  const intentMeta = getIntentMeta(intent);
  const queryPlan = buildQueryPlan(entityInput, mode, intent);
  const query = buildCompanyPrompt(entityInput, mode, intent, queryPlan);
  return {
    engine,
    mode,
    intent,
    intentLabel: intentMeta.label,
    query,
    queryType: getModeMeta(mode).queryType,
    queryPlan,
    citations: [],
    latencyMs: null,
    tokenUsage: null,
    searchQueriesUsed: [],
    groundingMetadata: null,
    citationMetrics: null,
    citationDetails: [],
    sourceProfile: null,
    sourceMix: null,
    queryPlanCoverage: null,
    factCheck: null,
    payloadDiagnostics: null,
  };
}

export function createUnsupportedResponse(engine, mode, intent, entityInput, reason) {
  return {
    ...createBaseResponse(engine, mode, intent, entityInput),
    response: `${engine}는 현재 ${getModeMeta(mode).shortLabel} · ${getIntentMeta(intent).shortLabel} 조합을 지원하지 않습니다.`,
    status: "unsupported",
    reason,
  };
}

export function createSkippedResponse(engine, mode, intent, entityInput, reason) {
  return {
    ...createBaseResponse(engine, mode, intent, entityInput),
    response: `${engine} ${getModeMeta(mode).shortLabel} · ${getIntentMeta(intent).shortLabel} 검사는 비용 가드로 생략되었습니다.`,
    status: "skipped",
    reason,
  };
}

// ---------------------------------------------------------------------------
// Engine API calls
// ---------------------------------------------------------------------------

export async function askChatGPT(entityInput, mode, intent, config) {
  const entity = normalizeEntityInput(entityInput);
  const startedAt = Date.now();
  const request = createBaseResponse("chatgpt", mode, intent, entity);

  try {
    const body = {
      model: config.openAiModel,
      input: request.query,
    };

    if (mode === AI_CHECK_MODES.LIVE_SEARCH) {
      body.tools = [{ type: "web_search" }];
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (config?.debugPayloads) {
        const debugBody = await res.text().catch(() => "");
        console.error(`[AAO] ChatGPT API error (${mode}/${intent}): HTTP ${res.status} (debugBodyLength: ${debugBody.length})`);
      } else {
        console.error(`[AAO] ChatGPT API error (${mode}/${intent}): HTTP ${res.status}`);
      }
      return {
        ...request,
        response: `API 오류 (${res.status})`,
        status: "error",
        error: `HTTP ${res.status}`,
        latencyMs: Date.now() - startedAt,
      };
    }

    const data = await res.json();
    let text = "";
    const citations = [];
    const searchQueriesUsed = mode === AI_CHECK_MODES.LIVE_SEARCH ? extractChatGptSearchQueries(data) : [];

    for (const item of data.output || []) {
      if (item.type !== "message") continue;

      for (const part of item.content || []) {
        if (part.type !== "output_text") continue;
        text += part.text || "";

        for (const annotation of part.annotations || []) {
          if (annotation.type === "url_citation" && annotation.url) {
            citations.push(annotation.url);
          }
        }
      }
    }

    const uniqueCitations = mode === AI_CHECK_MODES.LIVE_SEARCH ? uniqueStrings(citations) : [];
    const payloadDiagnostics = config?.debugPayloads
      ? buildPayloadDiagnostics({
          engine: "chatgpt",
          mode,
          payload: data,
          searchQueriesUsed,
          citations: uniqueCitations,
        })
      : null;
    maybeLogPayloadDiagnostics(config, `chatgpt/${mode}/${intent}`, payloadDiagnostics);

    return {
      ...request,
      response: text || `${entity.companyName}에 대한 정보를 갖고 있지 않습니다.`,
      citations: uniqueCitations,
      status: "success",
      latencyMs: Date.now() - startedAt,
      tokenUsage: extractTokenUsage(data),
      searchQueriesUsed,
      groundingMetadata: buildGroundingMetadata({
        engine: "chatgpt",
        mode,
        payload: data,
        citations: uniqueCitations,
        searchQueriesUsed,
        entityInput: entity,
      }),
      citationMetrics: computeCitationMetrics(uniqueCitations, entity),
      payloadDiagnostics,
    };
  } catch (error) {
    return {
      ...request,
      response: "",
      status: "error",
      error: error.message,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function askGemini(entityInput, mode, intent, config) {
  if (!SUPPORTED_MODE_BY_ENGINE.gemini.includes(mode)) {
    return createUnsupportedResponse(
      "gemini",
      mode,
      intent,
      entityInput,
      "Gemini는 현재 이 모드를 지원하지 않습니다."
    );
  }

  const startedAt = Date.now();
  const request = createBaseResponse("gemini", mode, intent, entityInput);
  const entity = normalizeEntityInput(entityInput);
  const model =
    mode === AI_CHECK_MODES.LIVE_SEARCH
      ? config?.geminiLiveSearchModel || "gemini-3.1-flash-lite-preview"
      : config?.geminiStrictRecallModel || "gemini-3.1-flash-lite-preview";
  const body = {
    contents: [
      {
        parts: [{ text: request.query }],
      },
    ],
    generationConfig: { maxOutputTokens: 3000 },
  };

  if (mode === AI_CHECK_MODES.LIVE_SEARCH) {
    body.tools = [{ google_search: {} }];
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      if (config?.debugPayloads) {
        const debugBody = await res.text().catch(() => "");
        console.error(`[AAO] Gemini API error (${mode}/${intent}): HTTP ${res.status} (debugBodyLength: ${debugBody.length})`);
      } else {
        console.error(`[AAO] Gemini API error (${mode}/${intent}): HTTP ${res.status}`);
      }
      return {
        ...request,
        response: `API 오류 (${res.status})`,
        status: "error",
        error: `HTTP ${res.status}`,
        latencyMs: Date.now() - startedAt,
      };
    }

    const data = await res.json();
    const firstCandidate = data.candidates?.[0] || null;
    const promptFeedback = data.promptFeedback || null;
    const finishReason = firstCandidate?.finishReason || null;
    const blockReason = promptFeedback?.blockReason || null;
    const noCandidateReason =
      data.error?.message
      || (blockReason ? `blocked:${blockReason}` : "")
      || (finishReason ? `finish_reason:${finishReason}` : "")
      || (!Array.isArray(data.candidates) || data.candidates.length === 0 ? "no_candidates" : "")
      || "empty_response";
    const parts = firstCandidate?.content?.parts;
    const text = (Array.isArray(parts) ? parts.map((part) => part.text || "").join("") : "")
      || firstCandidate?.output
      || data.text
      || data.error?.message
      || "";
    const citations = mode === AI_CHECK_MODES.LIVE_SEARCH ? extractGeminiCitations(data) : [];
    const searchQueriesUsed = mode === AI_CHECK_MODES.LIVE_SEARCH ? extractGeminiSearchQueries(data) : [];
    const payloadDiagnostics = config?.debugPayloads
      ? buildPayloadDiagnostics({
          engine: "gemini",
          mode,
          payload: data,
          searchQueriesUsed,
          citations,
        })
      : null;
    maybeLogPayloadDiagnostics(config, `gemini/${mode}/${intent}`, payloadDiagnostics);

    if (!text) {
      console.error("[AAO] Gemini API error:", noCandidateReason);
      return {
        ...request,
        response: `API 오류: ${noCandidateReason}`,
        status: "error",
        error: noCandidateReason,
        latencyMs: Date.now() - startedAt,
        tokenUsage: extractTokenUsage(data),
        citations,
        searchQueriesUsed,
        groundingMetadata: buildGroundingMetadata({
          engine: "gemini",
          mode,
          payload: data,
          citations,
          searchQueriesUsed,
          entityInput: entity,
        }),
        citationMetrics: computeCitationMetrics(citations, entity),
        payloadDiagnostics,
      };
    }

    return {
      ...request,
      response: text,
      status: text ? "success" : "error",
      error: text ? null : noCandidateReason,
      latencyMs: Date.now() - startedAt,
      tokenUsage: extractTokenUsage(data),
      citations,
      searchQueriesUsed,
      groundingMetadata: buildGroundingMetadata({
        engine: "gemini",
        mode,
        payload: data,
        citations,
        searchQueriesUsed,
        entityInput: entity,
      }),
      citationMetrics: computeCitationMetrics(citations, entity),
      payloadDiagnostics,
    };
  } catch (error) {
    return {
      ...request,
      response: "",
      status: "error",
      error: error.message,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function askPerplexity(entityInput, mode, intent, config) {
  if (!SUPPORTED_MODE_BY_ENGINE.perplexity.includes(mode)) {
    return createUnsupportedResponse(
      "perplexity",
      mode,
      intent,
      entityInput,
      "Perplexity는 검색 기반 엔진이라 strict recall 측정에서는 제외합니다."
    );
  }

  const startedAt = Date.now();
  const request = createBaseResponse("perplexity", mode, intent, entityInput);

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: request.query,
          },
        ],
      }),
    });

    if (!res.ok) {
      if (config?.debugPayloads) {
        const debugBody = await res.text().catch(() => "");
        console.error(`[AAO] Perplexity API error (${mode}/${intent}): HTTP ${res.status} (debugBodyLength: ${debugBody.length})`);
      } else {
        console.error(`[AAO] Perplexity API error (${mode}/${intent}): HTTP ${res.status}`);
      }
      return {
        ...request,
        response: `API 오류 (${res.status})`,
        status: "error",
        error: `HTTP ${res.status}`,
        latencyMs: Date.now() - startedAt,
      };
    }

    const data = await res.json();
    const text = extractResponseText(data.choices?.[0]?.message?.content);
    const citations = Array.isArray(data.citations) ? data.citations.filter(Boolean) : [];
    const searchQueriesUsed = extractPerplexitySearchQueries(data);
    const payloadDiagnostics = config?.debugPayloads
      ? buildPayloadDiagnostics({
          engine: "perplexity",
          mode,
          payload: data,
          searchQueriesUsed,
          citations,
        })
      : null;
    maybeLogPayloadDiagnostics(config, `perplexity/${mode}/${intent}`, payloadDiagnostics);

    if (!text) {
      return {
        ...request,
        response: "응답이 비어있습니다",
        status: "error",
        latencyMs: Date.now() - startedAt,
        tokenUsage: extractTokenUsage(data),
        citations,
        searchQueriesUsed,
        groundingMetadata: buildGroundingMetadata({
          engine: "perplexity",
          mode,
          payload: data,
          citations,
          searchQueriesUsed,
          entityInput,
        }),
        citationMetrics: computeCitationMetrics(citations, entityInput),
        payloadDiagnostics,
      };
    }

    return {
      ...request,
      response: text,
      citations,
      status: "success",
      latencyMs: Date.now() - startedAt,
      tokenUsage: extractTokenUsage(data),
      searchQueriesUsed,
      groundingMetadata: buildGroundingMetadata({
        engine: "perplexity",
        mode,
        payload: data,
        citations,
        searchQueriesUsed,
        entityInput,
      }),
      citationMetrics: computeCitationMetrics(citations, entityInput),
      payloadDiagnostics,
    };
  } catch (error) {
    return {
      ...request,
      response: "",
      status: "error",
      error: error.message,
      latencyMs: Date.now() - startedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// URL verification prompts + askEngineWithUrl
// ---------------------------------------------------------------------------

export function buildUrlVerificationPrompt(url, groundTruth) {
  const fieldNames = groundTruth.fieldNames || [];
  const fieldList = fieldNames.map((field) => {
    const label = field.replace(/_/g, " ");
    return `- ${label}`;
  }).join("\n");

  return [
    `다음 URL의 페이지를 직접 읽고, 아래 나열된 정보 항목이 페이지에 있는지 확인해줘.`,
    ``,
    `URL: ${url}`,
    ``,
    `확인할 항목:`,
    fieldList,
    ``,
    `출력 규칙:`,
    `1. 각 항목은 "field name: 값" 형식으로만 답해줘.`,
    `2. 페이지에서 해당 정보를 찾았으면 긴 문장을 복사하지 말고 핵심값만 짧게 요약해서 적어줘.`,
    `3. 설명형 항목도 한 문장 이내로 짧게 재서술해줘.`,
    `4. 페이지에서 찾지 못했으면 "찾지 못함"이라고 적어줘.`,
    `5. 페이지 자체에 접근할 수 없었으면 그 이유를 짧게 적어줘.`,
    ``,
    `반드시 해당 URL의 페이지 내용만 기준으로 답해줘. 다른 출처의 정보를 섞지 마.`,
    `페이지 문장을 길게 그대로 인용하지 말고, 필요한 사실만 짧게 정리해줘.`,
  ].join("\n");
}

export function buildSubpageVerificationPrompt(urls) {
  return [
    `다음 URL들을 각각 직접 방문해서 접근 가능한지 확인해줘.`,
    ``,
    ...urls.map((url, i) => `${i + 1}. ${url}`),
    ``,
    `각 URL에 대해 아래 형식으로 정확히 답변해줘:`,
    ``,
    `[URL] → 결과: 접근성공 / 접근실패`,
    `제목: (페이지 제목)`,
    `요약: (한 줄 요약, 긴 문장 복사 금지)`,
    `실패사유: (접근실패인 경우만 — 차단, 404, 타임아웃 등)`,
    ``,
    `반드시 각 URL을 실제로 읽어보고, 추측하지 마.`,
    `페이지 문장을 길게 그대로 인용하지 말고 짧게 재서술해줘.`,
  ].join("\n");
}

export function normalizeSubpageUrlForComparison(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";

    for (const key of [...parsed.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.startsWith("utm_") ||
        lowerKey.startsWith("fbclid") ||
        lowerKey.startsWith("gclid") ||
        lowerKey.startsWith("hubs_") ||
        lowerKey.startsWith("mc_") ||
        lowerKey === "gad_source" ||
        lowerKey === "igshid" ||
        lowerKey === "ref" ||
        lowerKey === "ref_src"
      ) {
        parsed.searchParams.delete(key);
      }
    }

    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return String(url || "");
  }
}

export async function askEngineWithUrl(engine, prompt, config) {
  const startedAt = Date.now();

  if (engine === "chatgpt") {
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: config?.openAiModel || "gpt-4.1-mini",
          input: prompt,
          tools: [{ type: "web_search" }],
        }),
      });
      if (!res.ok) return { text: "", status: "error", error: `${res.status}`, latencyMs: Date.now() - startedAt };
      const data = await res.json();
      let text = "";
      const citations = [];
      for (const item of data.output || []) {
        if (item.type !== "message") continue;
        for (const part of item.content || []) {
          if (part.type === "output_text") text += part.text || "";
          for (const ann of part.annotations || []) {
            if (ann.type === "url_citation" && ann.url) citations.push(ann.url);
          }
        }
      }
      return { text, citations, status: text ? "success" : "error", latencyMs: Date.now() - startedAt };
    } catch (e) {
      return { text: "", status: "error", error: e.message, latencyMs: Date.now() - startedAt };
    }
  }

  if (engine === "gemini") {
    try {
      const model = config?.geminiLiveSearchModel || "gemini-3.1-flash-lite-preview";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 3000 },
            tools: [{ google_search: {} }],
          }),
        }
      );
      if (!res.ok) return { text: "", status: "error", error: `${res.status}`, latencyMs: Date.now() - startedAt };
      const data = await res.json();
      const firstCandidate = data.candidates?.[0] || null;
      const promptFeedback = data.promptFeedback || null;
      const finishReason = firstCandidate?.finishReason || null;
      const blockReason = promptFeedback?.blockReason || null;
      const parts = firstCandidate?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";
      const errorReason =
        data.error?.message
        || (blockReason ? `blocked:${blockReason}` : "")
        || (finishReason ? `finish_reason:${finishReason}` : "")
        || (!Array.isArray(data.candidates) || data.candidates.length === 0 ? "no_candidates" : "")
        || "empty_response";
      return {
        text,
        citations: [],
        status: text ? "success" : "error",
        error: text ? null : errorReason,
        latencyMs: Date.now() - startedAt,
      };
    } catch (e) {
      return { text: "", status: "error", error: e.message, latencyMs: Date.now() - startedAt };
    }
  }

  if (engine === "perplexity") {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: "sonar",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { text: "", status: "error", error: `${res.status}`, latencyMs: Date.now() - startedAt };
      const data = await res.json();
      const text = extractResponseText(data.choices?.[0]?.message?.content);
      const citations = Array.isArray(data.citations) ? data.citations.filter(Boolean) : [];
      return { text, citations, status: text ? "success" : "error", latencyMs: Date.now() - startedAt };
    } catch (e) {
      return { text: "", status: "error", error: e.message, latencyMs: Date.now() - startedAt };
    }
  }

  return { text: "", status: "error", error: "unknown engine", latencyMs: Date.now() - startedAt };
}
