// lib/ai-check.js — Intent-aware AI checks with cost guard + cache
import { extractResponseText } from "./utils.js";
import { writeFile, mkdir } from "node:fs/promises";

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

const DEFAULT_INTENTS = ["awareness", "comparison", "purchase"];
const ENGINE_ORDER = ["chatgpt", "perplexity", "gemini"];
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_TASKS = 7;
const DEFAULT_CACHE_MAX_ENTRIES = 200;
const AI_CHECK_CACHE_VERSION = "v7";
// 임계값: 너무 낮으면 노이즈 증가, 너무 높으면 재분류 기회 상실.
// 현재 0.55는 보수적 기준. 로그(aiFallback.confidence)로 실측 분포 확인 후 튜닝 가능.
const AI_RECOGNITION_FALLBACK_MIN_CONFIDENCE = 0.55;
const aiCheckCache = new Map();
const SEARCH_QUERY_NOISE = new Set([
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

const MODE_META = {
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

const SUPPORTED_MODE_BY_ENGINE = {
  chatgpt: [AI_CHECK_MODES.STRICT_RECALL, AI_CHECK_MODES.LIVE_SEARCH],
  perplexity: [AI_CHECK_MODES.LIVE_SEARCH],
  gemini: [AI_CHECK_MODES.STRICT_RECALL, AI_CHECK_MODES.LIVE_SEARCH],
};

function normalizeEntityInput(entityInput) {
  if (typeof entityInput === "string") {
    return {
      companyName: entityInput,
      domain: "",
      officialTitle: "",
      officialDescription: "",
      aliases: [],
      crawlSnapshot: normalizeCrawlSnapshot(),
    };
  }

  return {
    companyName: entityInput?.companyName || "",
    domain: entityInput?.domain || "",
    officialTitle: entityInput?.officialTitle || "",
    officialDescription: entityInput?.officialDescription || "",
    aliases: Array.isArray(entityInput?.aliases) ? entityInput.aliases.filter(Boolean) : [],
    crawlSnapshot: normalizeCrawlSnapshot(entityInput?.crawlSnapshot),
  };
}

function normalizeCrawlSnapshot(snapshot = null) {
  const h1Texts = Array.isArray(snapshot?.headingStructure?.h1Texts) ? snapshot.headingStructure.h1Texts : [];
  const h2Texts = Array.isArray(snapshot?.headingStructure?.h2Texts) ? snapshot.headingStructure.h2Texts : [];

  return {
    title: parseString(snapshot?.title),
    description: parseString(snapshot?.description),
    contentPreview: parseString(snapshot?.contentPreview).slice(0, 2000),
    headingStructure: {
      h1Texts: uniqueStrings(h1Texts).slice(0, 10),
      h2Texts: uniqueStrings(h2Texts).slice(0, 12),
    },
    jsonLdBlocks: Array.isArray(snapshot?.jsonLdBlocks)
      ? snapshot.jsonLdBlocks.map((item) => parseString(item)).filter(Boolean).slice(0, 2)
      : [],
  };
}

function getModeMeta(mode) {
  return MODE_META[mode] || MODE_META[AI_CHECK_MODES.LIVE_SEARCH];
}

function getIntentMeta(intent) {
  return AI_CHECK_INTENTS[intent] || AI_CHECK_INTENTS.awareness;
}

function parseBoolean(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
}

function parseString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseIntentList(value) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_INTENTS;

  const intents = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => AI_CHECK_INTENTS[item]);

  return intents.length > 0 ? Array.from(new Set(intents)) : DEFAULT_INTENTS;
}

function resolveAiCheckConfig() {
  const openAiModel = parseString(
    process.env.AI_CHECK_OPENAI_MODEL,
    parseString(process.env.OPENAI_MODEL, "gpt-5-mini")
  );
  const geminiModel = parseString(process.env.GEMINI_MODEL, "gemini-3.1-flash-lite-preview");
  return {
    enabledIntents: parseIntentList(process.env.AI_CHECK_INTENTS),
    cacheTtlMs: parsePositiveInt(process.env.AI_CHECK_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS),
    cacheMaxEntries: parsePositiveInt(process.env.AI_CHECK_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_ENTRIES),
    maxTasks: parsePositiveInt(process.env.AI_CHECK_MAX_TASKS, DEFAULT_MAX_TASKS),
    enableChatgptStrictRecall: parseBoolean(process.env.AI_CHECK_ENABLE_CHATGPT_STRICT_RECALL, true),
    debugPayloads: parseBoolean(process.env.AI_CHECK_DEBUG_PAYLOADS, false),
    openAiModel,
    enableAiRecognitionFallback: parseBoolean(process.env.AI_CHECK_ENABLE_AI_RECOGNITION_FALLBACK, true),
    aiRecognitionFallbackModel: parseString(process.env.AI_CHECK_RECOGNITION_MODEL, openAiModel),
    geminiStrictRecallModel: parseString(process.env.GEMINI_STRICT_RECALL_MODEL, geminiModel),
    geminiLiveSearchModel: parseString(process.env.GEMINI_LIVE_SEARCH_MODEL, geminiModel),
  };
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickTemplate(templates, seed) {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  return templates[hashString(seed) % templates.length];
}

function extractStrongEntityHints(entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const rootDomain = entity.domain.replace(/^www\./, "");
  const rootLabel = rootDomain.split(".")[0];
  const rawValues = [entity.companyName, entity.officialTitle, ...entity.aliases, rootDomain, rootLabel];

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) =>
        String(value || "")
            .toLowerCase()
            .split(/[|()\-—,:/]+/)
            .map((part) => part.trim())
        )
        .filter((part) => part && (part.length >= 6 || (rootLabel && part === rootLabel.toLowerCase())))
    )
  );
}

function extractServiceHints(entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const raw = [entity.companyName, entity.officialTitle, entity.officialDescription, ...entity.aliases]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const stopWords = new Set([
    "and", "the", "of", "for", "a", "an", "in", "is", "to", "that", "this", "with", "it", "its",
    "are", "was", "be", "at", "by", "from", "as", "or", "but", "co", "inc", "ltd",
    "이", "가", "을", "를", "의", "에", "와", "과", "한", "하는", "있는", "하여", "위한",
  ]);

  return Array.from(new Set(
    raw
      .split(/[\s,.:;()\-—\/\|]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !stopWords.has(token) && /[a-z가-힣]/.test(token))
  )).slice(0, 15);
}

function inferCategoryHint(entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const hints = extractServiceHints(entity).slice(0, 3);
  if (hints.length > 0) return hints.join(", ");
  if (entity.officialTitle) return entity.officialTitle;
  if (entity.officialDescription) return entity.officialDescription.split(/[.!?]/)[0];
  return "서비스";
}

function getEntityAnchorTerms(entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const rootDomain = entity.domain.replace(/^www\./, "").toLowerCase();
  const rootLabel = rootDomain.split(".")[0];

  return uniqueStrings([
    entity.companyName,
    entity.officialTitle,
    ...entity.aliases,
    rootDomain,
    rootLabel,
    ...extractStrongEntityHints(entity),
  ])
    .map((value) => String(value || "").toLowerCase().trim())
    .filter((value) => value.length >= 2);
}

function getServiceDefinitionHints(entityInput) {
  const entityAnchors = new Set(getEntityAnchorTerms(entityInput));
  const genericBusinessTerms = new Set([
    "company",
    "official",
    "website",
    "business",
    "brand",
    "platform",
    "service",
    "services",
    "solution",
    "solutions",
    "기업",
    "회사",
    "공식",
    "브랜드",
    "서비스",
    "솔루션",
    "플랫폼",
  ]);

  return extractServiceHints(entityInput)
    .map((hint) => hint.toLowerCase())
    .filter((hint) => !entityAnchors.has(hint) && !genericBusinessTerms.has(hint))
    .slice(0, 8);
}

function extractYears(text) {
  return uniqueStrings(String(text || "").match(/\b(?:19|20)\d{2}\b/g) || []);
}

function extractEmails(text) {
  return uniqueStrings(
    (String(text || "").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [])
      .map((email) => email.toLowerCase())
  );
}

function extractPhraseHints(values) {
  return uniqueStrings(
    (values || [])
      .flatMap((value) => String(value || "").split(/(?<=[.!?。])\s+|\n+/))
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter((value) => value.length >= 16 && value.length <= 90 && /[a-z가-힣0-9]/i.test(value))
  ).slice(0, 12);
}

function buildCrawlVerificationSnapshot(entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const snapshot = entity.crawlSnapshot || normalizeCrawlSnapshot();
  const snapshotTexts = uniqueStrings([
    entity.officialTitle,
    entity.officialDescription,
    snapshot.title,
    snapshot.description,
    ...(snapshot.headingStructure?.h1Texts || []),
    ...(snapshot.headingStructure?.h2Texts || []),
    snapshot.contentPreview,
    ...(snapshot.jsonLdBlocks || []),
  ]);
  const combinedText = snapshotTexts.join(" ");

  const serviceHints = uniqueStrings([
    ...extractServiceHints(entity),
    ...extractServiceHints({
      companyName: entity.companyName,
      domain: entity.domain,
      officialTitle: [entity.officialTitle, snapshot.title].filter(Boolean).join(" "),
      officialDescription: [entity.officialDescription, snapshot.description, ...(snapshot.headingStructure?.h1Texts || []), ...(snapshot.headingStructure?.h2Texts || [])]
        .filter(Boolean)
        .join(" "),
      aliases: entity.aliases,
      crawlSnapshot: snapshot,
    }),
  ]).slice(0, 14);

  return {
    hasData: snapshotTexts.length > 0,
    years: extractYears(combinedText),
    emails: extractEmails(combinedText),
    hostnames: uniqueStrings([entity.domain, ...extractHostnamesFromText(combinedText)].map((value) => String(value || "").replace(/^www\./, "").toLowerCase()).filter(Boolean)),
    phraseHints: extractPhraseHints([
      snapshot.description,
      ...(snapshot.headingStructure?.h1Texts || []),
      ...(snapshot.headingStructure?.h2Texts || []),
      snapshot.contentPreview,
    ]),
    serviceHints,
  };
}

function computeCrawlVerificationSignals(responseText, entityInput) {
  const verification = buildCrawlVerificationSnapshot(entityInput);
  const text = String(responseText || "");
  const lower = text.toLowerCase();
  const responseYears = extractYears(text);
  const responseEmails = extractEmails(text);
  const responseHostnames = extractHostnamesFromText(text).map((value) => value.replace(/^www\./, "").toLowerCase());
  const matchedYears = responseYears.filter((year) => verification.years.includes(year));
  const matchedEmails = responseEmails.filter((email) => verification.emails.includes(email));
  const matchedHostnames = responseHostnames.filter((hostname) => verification.hostnames.includes(hostname));
  const matchedPhraseHints = verification.phraseHints.filter((phrase) => lower.includes(phrase.toLowerCase())).slice(0, 4);
  const matchedServiceHints = verification.serviceHints.filter((hint) => lower.includes(hint.toLowerCase())).slice(0, 4);

  return {
    hasData: verification.hasData,
    foundFoundingClaim: /(설립|창립|founded)/i.test(text),
    foundContactClaim: /(문의|연락|contact|email|e-mail)/i.test(text),
    matchedYears,
    matchedEmails,
    matchedHostnames,
    matchedPhraseHints,
    matchedServiceHints,
    verifiedMatchCount:
      matchedYears.length +
      matchedEmails.length +
      matchedHostnames.length +
      matchedPhraseHints.length +
      matchedServiceHints.length,
  };
}

function extractHostnamesFromText(text) {
  const value = String(text || "");
  if (!value) return [];

  const hostnames = [];

  for (const match of value.matchAll(/https?:\/\/[^\s)"'<>\]]+/gi)) {
    const hostname = getHostname(match[0]);
    if (hostname) hostnames.push(hostname);
  }

  for (const match of value.matchAll(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi)) {
    const hostname = extractHostnameCandidate(match[0]);
    if (hostname) hostnames.push(hostname);
  }

  return uniqueStrings(hostnames);
}

function hostMatchesOfficialDomain(hostname, officialDomain) {
  if (!hostname || !officialDomain) return false;
  return hostname === officialDomain || hostname.endsWith(`.${officialDomain}`);
}

function splitFactCheckSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?。]|다\.|요\.)\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function countSentencesContainingAny(sentences, terms) {
  const normalizedTerms = uniqueStrings(terms)
    .map((term) => String(term || "").toLowerCase().trim())
    .filter((term) => term.length >= 2);
  if (normalizedTerms.length === 0) return 0;

  return sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return normalizedTerms.some((term) => lower.includes(term));
  }).length;
}

function hasComparisonCue(text) {
  return /(비교|경쟁|대안|차이|대비|vs\b|versus|alternative|alternatives|competitor|competitors|compare|comparison)/i.test(
    String(text || "")
  );
}

function buildRecognitionContext(responseText, entityInput) {
  const text = String(responseText || "").toLowerCase();
  const entity = normalizeEntityInput(entityInput);
  const strongEntityHints = extractStrongEntityHints(entity);
  const serviceHints = extractServiceHints(entity);

  const unknownSignals = [
    "정보를 찾기 어렵", "알려진 정보가 없", "확인할 수 없", "잘 모르겠",
    "구체적인 정보", "정보가 부족", "찾을 수 없", "i don't have",
    "i'm not sure", "not familiar", "no information", "couldn't find",
    "unable to find", "i don't have specific", "알 수 없", "파악되지",
    "cannot find information", "i cannot find", "can't find information",
    "cannot identify", "could not identify", "not enough information",
    "does not appear to refer to", "not clearly refer to",
    "specific company cannot be identified", "정확한 엔티티", "특정하기 어렵",
    "특정할 수 있는 회사를 찾", "직접 내용을 불러오지 못", "확실하게 말할 수 있는 것은",
    "정보는 갖고 있지 않", "세부 정보가 없", "찾기 어렵", "설명해 드리기 어렵",
    "고유한 이름이라기보다는", "개념이나 설명처럼 보", "특정 기업이나 제품", "정확한 명칭의 특정",
    "정확히 식별할 수 없다", "정확히 식별하기 어렵", "공식 정보가 없다", "공식 웹사이트를 참고",
    "해당 회사가 무엇을 하는 곳인지", "정확히 설명드리기 어렵", "모른다고 답", "추측하지 않고, 모른다고",
    "확인되지 않습니다", "확인되지 않는", "존재하지 않는 것으로", "등장하지 않습니다", "등장하지 않는",
    "검색 결과에서 확인되지", "확인되지 않고", "특정되지 않", "존재하지 않는다고",
    // Gemini-style denial-of-existence patterns
    "존재하지 않으며", "단일 회사는 존재하지", "단일 공식 기업은 존재하지",
    "회사가 아니라", "기업이 아니라", "마케팅 전략 용어", "전문 용어로",
    "브랜드명이라기보다", "고유한 브랜드명이라기보다", "특정 단일 회사",
    "특정 기업의 고유한", "회사명으로 사용하는 특정", "특정 단일",
    "is not a company", "is a marketing term", "is a strategy", "is not a specific company",
    "does not exist as a company", "no specific company",
  ];

  const exactEntitySignals = [
    entity.companyName,
    entity.domain,
    ...entity.aliases,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .filter((value) => value.length >= 6);

  const hasStrongEntityMatch =
    strongEntityHints.length > 0 &&
    strongEntityHints.some((hint) => text.includes(hint));

  const hasExactEntityMatch =
    exactEntitySignals.length > 0 &&
    exactEntitySignals.some((hint) => text.includes(hint));

  const hasServiceMatch =
    serviceHints.length > 0 &&
    serviceHints.some((hint) => text.includes(hint));

  const looksUncertain = unknownSignals.some((signal) => text.includes(signal));

  // 인식은 됐지만 확신이 약한 표현 (fallback 재검토 트리거용)
  const hedgedSignals = [
    "아마", "것 같", "것으로 보", "일 수도", "추정", "불분명", "확실하지 않",
    "다고 생각", "가능성", "정확하지 않", "확실하게 말하기 어렵",
    "probably", "likely", "might be", "i think", "i believe", "possibly",
    "not entirely sure", "not certain", "i'm not certain",
  ];
  const looksHedged = !looksUncertain && hedgedSignals.some((signal) => text.includes(signal));

  const hasSpecificClaims =
    text.length >= 120 &&
    /(서비스|제품|고객|매출|ceo|대표|설립|founded|industry|플랫폼|company|기업|브랜드|기술|솔루션|반도체|핀테크|교육|가격|도입|사례|비교|연구|행정|기록|지원서|citation|profile|monitoring|research|compound|material|materials|coating|office|records|application|admission|campus)/.test(text);

  return {
    text,
    entity,
    strongEntityHints,
    exactEntitySignals,
    serviceHints,
    hasStrongEntityMatch,
    hasExactEntityMatch,
    hasServiceMatch,
    looksUncertain,
    looksHedged,
    hasSpecificClaims,
  };
}

function buildFactCheck(response, entityInput, recognitionContext, citationMetrics) {
  const context = recognitionContext || buildRecognitionContext(response?.response || "", entityInput);
  const officialDomain = getOfficialDomain(entityInput);
  const responseHostnames = extractHostnamesFromText(response?.response || "");
  const foreignMentionedDomains = responseHostnames.filter((hostname) => !hostMatchesOfficialDomain(hostname, officialDomain));
  const mentionedOfficialDomain = responseHostnames.some((hostname) => hostMatchesOfficialDomain(hostname, officialDomain));
  const hasOfficialCitation = Boolean(citationMetrics?.hasOfficialCitation);
  const officialDomainSignal = mentionedOfficialDomain || hasOfficialCitation;
  const serviceDefinitionHints = getServiceDefinitionHints(entityInput);
  const matchedServiceHints = serviceDefinitionHints.filter((hint) => context.text.includes(hint));

  let serviceDefinitionMatch = null;
  if (serviceDefinitionHints.length > 0) {
    if (matchedServiceHints.length === 0) {
      serviceDefinitionMatch = false;
    } else if (
      serviceDefinitionHints.length <= 2 ||
      matchedServiceHints.length >= 2 ||
      matchedServiceHints.length / serviceDefinitionHints.length >= 0.5
    ) {
      serviceDefinitionMatch = true;
    }
  }

  const sentences = splitFactCheckSentences(response?.response || "");
  const highConfidenceEntityAnchorTerms = uniqueStrings([
    ...getEntityAnchorTerms(entityInput),
    officialDomain,
  ])
    .filter(Boolean)
    .filter((term) => term.includes(".") || term.length >= 6);
  const anchoredSentenceCount = countSentencesContainingAny(sentences, highConfidenceEntityAnchorTerms);
  const foreignDomainSentenceCount = countSentencesContainingAny(sentences, foreignMentionedDomains);
  const isComparisonIntent = response?.intent === "comparison";
  const comparisonCue = isComparisonIntent && hasComparisonCue(context.text);
  const highConfidenceEntityMatch =
    highConfidenceEntityAnchorTerms.some((term) => context.text.includes(term)) ||
    anchoredSentenceCount > 0;
  const anchoredEntitySignal =
    officialDomainSignal ||
    context.hasExactEntityMatch ||
    highConfidenceEntityMatch;
  const comparisonSafe = comparisonCue && anchoredEntitySignal;
  const foreignDomainDominant =
    foreignMentionedDomains.length > 0 &&
    foreignDomainSentenceCount > 0 &&
    anchoredSentenceCount === 0 &&
    !anchoredEntitySignal;
  const wrongEntityLikely =
    foreignMentionedDomains.length > 0 &&
    !anchoredEntitySignal &&
    !context.hasExactEntityMatch &&
    context.hasSpecificClaims &&
    (!comparisonSafe || foreignDomainDominant);
  const domainMismatch =
    foreignMentionedDomains.length > 0 &&
    anchoredEntitySignal &&
    !officialDomainSignal &&
    context.hasSpecificClaims &&
    !comparisonSafe;
  const serviceMismatch =
    serviceDefinitionMatch === false &&
    context.hasSpecificClaims &&
    !context.looksUncertain &&
    !wrongEntityLikely &&
    !(isComparisonIntent && comparisonCue);

  const reasons = [];
  if (wrongEntityLikely) {
    reasons.push(`응답이 공식 엔티티 대신 다른 도메인(${foreignMentionedDomains.slice(0, 2).join(", ")})을 중심으로 설명합니다.`);
  } else if (domainMismatch) {
    reasons.push(`응답이 공식 도메인 신호 없이 다른 도메인(${foreignMentionedDomains.slice(0, 2).join(", ")})을 언급합니다.`);
  } else if (comparisonSafe && foreignMentionedDomains.length > 0) {
    reasons.push(`비교 문맥에서 경쟁 도메인(${foreignMentionedDomains.slice(0, 2).join(", ")})이 언급되지만 공식 엔티티 앵커도 함께 확인됩니다.`);
  }

  if (serviceMismatch) {
    reasons.push(
      matchedServiceHints.length > 0
        ? `공식 서비스 정의 힌트가 일부만 일치합니다 (${matchedServiceHints.slice(0, 3).join(", ")}).`
        : "공식 서비스 정의 힌트가 응답에서 거의 확인되지 않습니다."
    );
  } else if (serviceDefinitionMatch === true) {
    reasons.push(`공식 서비스 정의 힌트가 일치합니다 (${matchedServiceHints.slice(0, 3).join(", ")}).`);
  }

  if (officialDomainSignal) {
    reasons.push(hasOfficialCitation ? "공식 도메인 citation이 확인됩니다." : "공식 도메인 언급이 확인됩니다.");
  } else if (context.hasExactEntityMatch || highConfidenceEntityMatch) {
    reasons.push("공식 엔티티 앵커가 응답에 포함됩니다.");
  }

  const verdict = wrongEntityLikely
    ? "wrong_entity"
    : domainMismatch
      ? "domain_mismatch"
      : serviceMismatch
        ? "service_mismatch"
        : comparisonSafe || anchoredEntitySignal || serviceDefinitionMatch === true
          ? "aligned"
          : "weak";

  return {
    verdict,
    officialDomain,
    officialDomainSignal,
    anchoredEntitySignal,
    mentionedOfficialDomain,
    hasOfficialCitation,
    responseHostnames,
    foreignMentionedDomains,
    serviceDefinitionHints,
    matchedServiceHints,
    serviceDefinitionMatch,
    isComparisonIntent,
    comparisonCue,
    comparisonSafe,
    anchoredSentenceCount,
    foreignDomainSentenceCount,
    domainMismatch,
    serviceMismatch,
    wrongEntityLikely,
    reasons,
  };
}

function createQuerySlot(id, label, goal, queries) {
  const normalizedQueries = uniqueStrings(queries).slice(0, 4);
  return {
    id,
    label,
    goal,
    queries: normalizedQueries,
  };
}

function buildQueryPlan(entityInput, mode, intent) {
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

function renderQueryPlanPrompt(queryPlan) {
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

function buildPromptTemplates(entityInput, mode) {
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

function buildCompanyPrompt(entityInput, mode, intent = "awareness", queryPlan = null) {
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

function classifyRecognition(responseText, entityInput, factCheck = null, recognitionContext = null) {
  const context = recognitionContext || buildRecognitionContext(responseText, entityInput);

  if (context.looksUncertain) {
    return {
      matchStatus: "unknown",
      reason: "정확한 엔티티를 특정하지 못했고, 모른다거나 식별이 어렵다는 표현이 포함되었습니다.",
      hasStrongEntityMatch: context.hasStrongEntityMatch,
      hasExactEntityMatch: context.hasExactEntityMatch,
      hasServiceMatch: context.hasServiceMatch,
      hasSpecificClaims: context.hasSpecificClaims,
    };
  }

  if (factCheck?.verdict === "wrong_entity") {
    return {
      matchStatus: "misidentified",
      reason: factCheck.reasons?.[0] || "응답이 공식 엔티티가 아니라 다른 회사를 설명한 것으로 보입니다.",
      hasStrongEntityMatch: context.hasStrongEntityMatch,
      hasExactEntityMatch: context.hasExactEntityMatch,
      hasServiceMatch: context.hasServiceMatch,
      hasSpecificClaims: context.hasSpecificClaims,
    };
  }

  if (factCheck?.verdict === "domain_mismatch" || factCheck?.verdict === "service_mismatch") {
    return {
      matchStatus: "misidentified",
      reason: factCheck.reasons?.[0] || "응답의 도메인 또는 서비스 정의가 공식 정보와 어긋납니다.",
      hasStrongEntityMatch: context.hasStrongEntityMatch,
      hasExactEntityMatch: context.hasExactEntityMatch,
      hasServiceMatch: context.hasServiceMatch,
      hasSpecificClaims: context.hasSpecificClaims,
    };
  }

  if (
    factCheck?.verdict === "aligned" &&
    (factCheck?.comparisonSafe || factCheck?.anchoredEntitySignal || context.hasExactEntityMatch || context.hasStrongEntityMatch)
  ) {
    return {
      matchStatus: "recognized",
      reason:
        factCheck?.comparisonSafe
          ? "비교 문맥에서도 공식 엔티티 앵커가 유지되어 같은 회사를 기준으로 설명하고 있습니다."
          : "응답이 공식 엔티티와 대체로 정합합니다.",
      hasStrongEntityMatch: context.hasStrongEntityMatch,
      hasExactEntityMatch: context.hasExactEntityMatch,
      hasServiceMatch: context.hasServiceMatch,
      hasSpecificClaims: context.hasSpecificClaims,
    };
  }

  if (
    (context.hasExactEntityMatch || context.hasStrongEntityMatch || factCheck?.officialDomainSignal) &&
    (context.hasServiceMatch || factCheck?.serviceDefinitionMatch === true)
  ) {
    return {
      matchStatus: "recognized",
      reason: "회사 엔티티 앵커와 서비스 정의가 공식 정보와 대체로 일치합니다.",
      hasStrongEntityMatch: context.hasStrongEntityMatch,
      hasExactEntityMatch: context.hasExactEntityMatch,
      hasServiceMatch: context.hasServiceMatch,
      hasSpecificClaims: context.hasSpecificClaims,
    };
  }

  if (context.hasSpecificClaims && !context.hasExactEntityMatch) {
    return {
      matchStatus: "misidentified",
      reason: "응답은 구체적이지만 공식 엔티티 앵커와 맞지 않아 다른 회사나 개념을 설명한 것으로 보입니다.",
      hasStrongEntityMatch: context.hasStrongEntityMatch,
      hasExactEntityMatch: context.hasExactEntityMatch,
      hasServiceMatch: context.hasServiceMatch,
      hasSpecificClaims: context.hasSpecificClaims,
    };
  }

  return {
    matchStatus: "unknown",
    reason:
      factCheck?.reasons?.[0] ||
      "응답은 있었지만 공식 엔티티와 서비스를 정확히 연결할 근거가 부족합니다.",
    hasStrongEntityMatch: context.hasStrongEntityMatch,
    hasExactEntityMatch: context.hasExactEntityMatch,
    hasServiceMatch: context.hasServiceMatch,
    hasSpecificClaims: context.hasSpecificClaims,
  };
}

function extractOpenAiResponsesOutputText(payload) {
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

function shouldRunAiRecognitionFallback(result, config) {
  if (!config?.enableAiRecognitionFallback) return false;
  if (!process.env.OPENAI_API_KEY) return false;
  if (!result || result.status !== "success") return false;
  if (!result.response || typeof result.response !== "string") return false;
  if (result.recognitionSource === "ai_fallback") return false;
  // 미인식 / 약한 판정
  if (result.matchStatus === "unknown") return true;
  if (result.factCheck?.verdict === "weak") return true;
  // 인식됐지만 hedging 표현 포함 → 재검토
  if (result.matchStatus === "recognized" && result.recognitionContext?.looksHedged) return true;
  return false;
}

function buildAiRecognitionFallbackPrompt(result, entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const factCheck = result?.factCheck || {};

  return [
    "You are an entity-recognition classifier.",
    "Classify whether the response correctly identifies the official entity.",
    "Output JSON only.",
    "Rules:",
    "- recognized: the response is about the same company/service as the official info.",
    "- unknown: the response says it cannot identify the entity, lacks enough information, or stays too uncertain.",
    "- misidentified: the response explains a different company, domain, or service.",
    "- Use wrong_entity when it is mainly another entity.",
    "- Use domain_mismatch when entity seems related but domains do not align.",
    "- Use service_mismatch when the entity label may match but the service definition is wrong.",
    "",
    `Target company: ${entity.companyName || "(none)"}`,
    `Official domain: ${entity.domain || "(none)"}`,
    `Official title: ${entity.officialTitle || "(none)"}`,
    `Official description: ${entity.officialDescription || "(none)"}`,
    `Aliases: ${entity.aliases.join(", ") || "(none)"}`,
    `Intent: ${result.intent || "(none)"}`,
    `Mode: ${result.mode || "(none)"}`,
    `Engine: ${result.engineId || "(none)"}`,
    `Response text:\n${String(result.response || "").trim()}`,
    `Citations: ${(result.citations || []).join(", ") || "(none)"}`,
    `Rule matchStatus: ${result.matchStatus || "unknown"}`,
    `Rule reason: ${result.reason || "(none)"}`,
    `Rule fact verdict: ${factCheck.verdict || "none"}`,
    `Rule fact reasons: ${(factCheck.reasons || []).join(" | ") || "(none)"}`,
    `Foreign mentioned domains: ${(factCheck.foreignMentionedDomains || []).join(", ") || "(none)"}`,
    `Official domain signal: ${factCheck.officialDomainSignal ? "yes" : "no"}`,
    `Service definition match: ${
      factCheck.serviceDefinitionMatch === true
        ? "yes"
        : factCheck.serviceDefinitionMatch === false
          ? "no"
          : "unknown"
    }`,
    "If the response explicitly says it does not know, cannot identify, cannot find information, or asks to avoid guessing, choose unknown.",
    "If matchStatus is recognized or unknown, set misidentifiedSubtype to none.",
  ].join("\n");
}

function parseAiRecognitionFallbackOutput(rawText) {
  try {
    const parsed = JSON.parse(String(rawText || "").trim());
    const matchStatus = parsed?.matchStatus;
    const misidentifiedSubtype = parsed?.misidentifiedSubtype || "none";
    const confidence = Number(parsed?.confidence);
    const reason = String(parsed?.reason || "").trim();

    if (!["recognized", "unknown", "misidentified"].includes(matchStatus)) return null;
    if (!["none", "wrong_entity", "domain_mismatch", "service_mismatch"].includes(misidentifiedSubtype)) return null;
    if (!Number.isFinite(confidence)) return null;

    return {
      matchStatus,
      misidentifiedSubtype,
      confidence: Math.max(0, Math.min(confidence, 1)),
      reason: reason || "AI fallback classifier가 판정했습니다.",
    };
  } catch {
    return null;
  }
}

async function applyAiRecognitionFallback(result, entityInput, config) {
  if (!shouldRunAiRecognitionFallback(result, config)) {
    return {
      ...result,
      recognitionSource: result.recognitionSource || "rules",
      aiRecognitionFallback: result.aiRecognitionFallback || null,
    };
  }

  const startedAt = Date.now();

  try {
    const body = {
      model: config.aiRecognitionFallbackModel,
      input: buildAiRecognitionFallbackPrompt(result, entityInput),
      text: {
        format: {
          type: "json_schema",
          name: "recognition_classifier",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              matchStatus: {
                type: "string",
                enum: ["recognized", "unknown", "misidentified"],
              },
              misidentifiedSubtype: {
                type: "string",
                enum: ["none", "wrong_entity", "domain_mismatch", "service_mismatch"],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: "string",
              },
            },
            required: ["matchStatus", "misidentifiedSubtype", "confidence", "reason"],
          },
        },
      },
    };

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return {
        ...result,
        recognitionSource: result.recognitionSource || "rules",
        aiRecognitionFallback: {
          status: "error",
          model: config.aiRecognitionFallbackModel,
          reason: `AI fallback API error (${res.status})`,
          error: sanitizePreview(errorBody, 180),
          latencyMs: Date.now() - startedAt,
        },
      };
    }

    const data = await res.json();
    const parsed = parseAiRecognitionFallbackOutput(extractOpenAiResponsesOutputText(data));

    if (!parsed) {
      return {
        ...result,
        recognitionSource: result.recognitionSource || "rules",
        aiRecognitionFallback: {
          status: "error",
          model: config.aiRecognitionFallbackModel,
          reason: "AI fallback JSON parse failed",
          latencyMs: Date.now() - startedAt,
        },
      };
    }

    if (parsed.confidence < AI_RECOGNITION_FALLBACK_MIN_CONFIDENCE) {
      return {
        ...result,
        recognitionSource: result.recognitionSource || "rules",
        aiRecognitionFallback: {
          status: "low_confidence",
          model: config.aiRecognitionFallbackModel,
          ...parsed,
          latencyMs: Date.now() - startedAt,
        },
      };
    }

    const aiVerdict =
      parsed.matchStatus === "recognized"
        ? "aligned"
        : parsed.matchStatus === "unknown"
          ? "weak"
          : parsed.misidentifiedSubtype === "none"
            ? "wrong_entity"
            : parsed.misidentifiedSubtype;

    const mergedFactCheck = result.factCheck
      ? {
          ...result.factCheck,
          verdict: aiVerdict,
          reasons: uniqueStrings([parsed.reason, ...(result.factCheck.reasons || [])]).slice(0, 5),
          wrongEntityLikely: aiVerdict === "wrong_entity",
          domainMismatch: aiVerdict === "domain_mismatch",
          serviceMismatch: aiVerdict === "service_mismatch",
          aiFallback: {
            status: "applied",
            model: config.aiRecognitionFallbackModel,
            ...parsed,
            latencyMs: Date.now() - startedAt,
          },
        }
      : result.factCheck;

    const nextAccuracy =
      parsed.matchStatus === "misidentified"
        ? 0
        : parsed.matchStatus === "unknown"
          ? Math.min(result.accuracy ?? 10, 10)
          : Math.max(result.accuracy ?? 20, 20);

    console.log(
      `[AAO][ai-fallback] engine=${result.engineId} intent=${result.intent} ` +
      `confidence=${parsed.confidence} threshold=${AI_RECOGNITION_FALLBACK_MIN_CONFIDENCE} ` +
      `prevStatus=${result.matchStatus} nextStatus=${parsed.matchStatus} ` +
      `trigger=${result.matchStatus === "recognized" ? "hedged" : result.matchStatus}`
    );

    return {
      ...result,
      knows: parsed.matchStatus === "recognized",
      matchStatus: parsed.matchStatus,
      reason: parsed.reason || result.reason,
      accuracy: nextAccuracy,
      factCheck: mergedFactCheck,
      recognitionSource: "ai_fallback",
      aiRecognitionFallback: {
        status: "applied",
        model: config.aiRecognitionFallbackModel,
        ...parsed,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    return {
      ...result,
      recognitionSource: result.recognitionSource || "rules",
      aiRecognitionFallback: {
        status: "error",
        model: config.aiRecognitionFallbackModel,
        reason: error.message || "AI fallback failed",
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}

function computeMentionPosition(responseText, entityInput) {
  if (!responseText) return { found: false, ratio: null, bucket: "none" };

  const entity = normalizeEntityInput(entityInput);
  const lower = responseText.toLowerCase();

  const rootDomain = entity.domain.replace(/^www\./, "").split(".")[0];
  const terms = [
    entity.companyName,
    entity.officialTitle,
    ...entity.aliases,
    rootDomain,
  ]
    .filter(Boolean)
    .map((term) => String(term).toLowerCase())
    .filter((term) => term.length >= 2);

  let firstIdx = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0 && (firstIdx < 0 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx < 0) return { found: false, ratio: null, bucket: "none" };

  const ratio = Math.round((firstIdx / responseText.length) * 100) / 100;
  const bucket = ratio <= 0.2 ? "top" : ratio <= 0.6 ? "middle" : "bottom";

  return { found: true, ratio, bucket };
}

function extractTokenUsage(payload) {
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

function roundMetric(value, digits = 4) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getOfficialDomain(entityInput) {
  return normalizeEntityInput(entityInput).domain.replace(/^www\./, "").toLowerCase();
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isVertexGroundingUrl(url) {
  const hostname = getHostname(url);
  return hostname === "vertexaisearch.cloud.google.com";
}

function extractHostnameCandidate(value) {
  if (typeof value !== "string") return "";

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";

  if (/^https?:\/\//i.test(normalized)) {
    return getHostname(normalized);
  }

  const match = normalized.match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/i);
  if (!match) return "";

  const candidate = match[1].replace(/^www\./, "");
  const labels = candidate.split(".").filter(Boolean);
  if (labels.length < 2) return "";

  const tld = labels[labels.length - 1];
  const registrable = labels[labels.length - 2];

  if (!/^[a-z]{2,24}$/i.test(tld)) return "";
  if (!/[a-z]/i.test(registrable)) return "";
  if (!/[a-z]/i.test(candidate)) return "";

  return candidate;
}

function toCanonicalCitationUrl(hostname) {
  return hostname ? `https://${hostname}` : "";
}

function hostnameMatchesAny(hostname, domains) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isOfficialCitation(url, entityInput) {
  const officialDomain = getOfficialDomain(entityInput);
  const hostname = getHostname(url);

  if (!officialDomain || !hostname) return false;
  return hostname === officialDomain || hostname.endsWith(`.${officialDomain}`);
}

const SOURCE_ARCHETYPE_RULES = {
  software_service: {
    id: "software_service",
    label: "소프트웨어/AI",
    officialPreferred: true,
    expectedSourceTypes: ["official", "docs", "directory", "news"],
    sourceTypeWeights: {
      official: 1,
      docs: 0.95,
      directory: 0.82,
      news: 0.74,
      community: 0.62,
      wiki: 0.48,
      blog: 0.44,
      social: 0.34,
      unknown: 0.46,
      default: 0.46,
    },
  },
  developer_tool: {
    id: "developer_tool",
    label: "개발자 도구",
    officialPreferred: true,
    expectedSourceTypes: ["official", "docs", "community"],
    sourceTypeWeights: {
      official: 1,
      docs: 1,
      community: 0.8,
      directory: 0.55,
      news: 0.58,
      wiki: 0.44,
      blog: 0.45,
      social: 0.28,
      unknown: 0.44,
      default: 0.44,
    },
  },
  local_business: {
    id: "local_business",
    label: "로컬 비즈니스",
    officialPreferred: false,
    expectedSourceTypes: ["official", "directory", "social"],
    sourceTypeWeights: {
      official: 0.96,
      directory: 0.96,
      social: 0.74,
      news: 0.58,
      community: 0.42,
      blog: 0.4,
      wiki: 0.26,
      docs: 0.22,
      unknown: 0.44,
      default: 0.44,
    },
  },
  creator_media: {
    id: "creator_media",
    label: "크리에이터/미디어",
    officialPreferred: false,
    expectedSourceTypes: ["official", "social", "news"],
    sourceTypeWeights: {
      official: 0.94,
      social: 1,
      news: 0.72,
      blog: 0.62,
      community: 0.46,
      wiki: 0.4,
      directory: 0.32,
      docs: 0.2,
      unknown: 0.38,
      default: 0.38,
    },
  },
  general_business: {
    id: "general_business",
    label: "일반 기업",
    officialPreferred: true,
    expectedSourceTypes: ["official", "news", "directory"],
    sourceTypeWeights: {
      official: 1,
      news: 0.82,
      directory: 0.72,
      docs: 0.62,
      wiki: 0.55,
      community: 0.45,
      blog: 0.4,
      social: 0.36,
      unknown: 0.45,
      default: 0.45,
    },
  },
};

function inferSourceArchetype(entityInput) {
  const rawText = [
    normalizeEntityInput(entityInput).companyName,
    normalizeEntityInput(entityInput).officialTitle,
    normalizeEntityInput(entityInput).officialDescription,
    ...(normalizeEntityInput(entityInput).aliases || []),
    ...extractServiceHints(entityInput),
  ]
    .join(" ")
    .toLowerCase();

  const scores = {
    creator_media: [
      "creator", "influencer", "youtuber", "youtube", "instagram", "tiktok", "podcast", "streamer",
      "newsletter", "photographer", "artist", "writer", "크리에이터", "인플루언서", "유튜버", "인스타그램",
      "틱톡", "작가", "블로거", "콘텐츠", "미디어",
    ],
    local_business: [
      "restaurant", "cafe", "salon", "clinic", "hospital", "yoga", "pilates", "studio", "bakery",
      "hotel", "shop", "store", "academy", "gym", "카페", "식당", "레스토랑", "미용실", "의원", "병원",
      "요가", "필라테스", "스튜디오", "맛집", "학원", "헬스장",
    ],
    developer_tool: [
      "developer", "developers", "api", "sdk", "cli", "github", "open source", "open-source",
      "framework", "library", "devtool", "docs", "developer tool", "개발자", "오픈소스",
    ],
    software_service: [
      "software", "saas", "platform", "automation", "analytics", "crm", "tool", "app", "solution",
      "cloud", "workflow", "assistant", "ai", "소프트웨어", "플랫폼", "솔루션", "앱", "자동화", "에이전트",
    ],
  };

  const archetypeScore = Object.fromEntries(
    Object.entries(scores).map(([archetypeId, keywords]) => [
      archetypeId,
      keywords.filter((keyword) => rawText.includes(keyword)).length,
    ])
  );

  const ranked = Object.entries(archetypeScore).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const priority = ["developer_tool", "creator_media", "local_business", "software_service"];
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  });

  const winner = ranked[0];
  if (winner && winner[1] > 0) {
    return SOURCE_ARCHETYPE_RULES[winner[0]] || SOURCE_ARCHETYPE_RULES.general_business;
  }

  return SOURCE_ARCHETYPE_RULES.general_business;
}

function getSourceFitMetaFromProfile(profile) {
  const status = profile?.sourceFitStatus || "none";

  if (status === "strong") {
    return { label: "출처 적합도 높음", shortLabel: "strong" };
  }

  if (status === "official_gap") {
    return { label: "공식 출처 gap", shortLabel: "official-gap" };
  }

  if (status === "off_pattern") {
    return { label: "출처 패턴 이탈", shortLabel: "off-pattern" };
  }

  if (status === "mixed") {
    return { label: "출처 혼합", shortLabel: "mixed" };
  }

  return { label: "출처 없음", shortLabel: "none" };
}

function classifyCitationSource(url, entityInput) {
  const hostname = getHostname(url);
  const isOfficial = isOfficialCitation(url, entityInput);

  if (!hostname) {
    return {
      url,
      hostname: "",
      isOfficial,
      sourceTypeId: "unknown",
      sourceTypeLabel: "미분류",
      authorityTier: "medium",
      authorityLabel: "보통",
      authorityScore: 0.5,
    };
  }

  if (isOfficial) {
    return {
      url,
      hostname,
      isOfficial: true,
      sourceTypeId: "official",
      sourceTypeLabel: "공식",
      authorityTier: "high",
      authorityLabel: "높음",
      authorityScore: 1,
    };
  }

  const newsDomains = [
    "reuters.com", "bloomberg.com", "forbes.com", "wsj.com", "ft.com", "nytimes.com",
    "cnbc.com", "businessinsider.com", "techcrunch.com", "theverge.com", "wired.com",
    "hankyung.com", "mk.co.kr", "chosun.com", "joongang.co.kr", "koreaherald.com",
    "zdnet.com", "zdnet.co.kr",
  ];
  const wikiDomains = ["wikipedia.org", "wikidata.org", "fandom.com", "namu.wiki"];
  const directoryDomains = [
    "crunchbase.com", "zoominfo.com", "owler.com", "g2.com", "capterra.com", "cbinsights.com",
    "pitchbook.com", "tracxn.com", "yelp.com", "tripadvisor.com", "yellowpages.com", "foursquare.com",
  ];
  const communityDomains = ["reddit.com", "quora.com", "stackoverflow.com", "stackexchange.com", "github.com"];
  const socialDomains = [
    "linkedin.com", "x.com", "twitter.com", "facebook.com", "instagram.com",
    "youtube.com", "tiktok.com", "threads.net",
  ];
  const blogDomains = ["medium.com", "substack.com", "blogspot.com", "wordpress.com", "tistory.com", "velog.io", "brunch.co.kr"];
  const docsLike =
    hostname.startsWith("docs.") ||
    hostname.startsWith("developer.") ||
    hostname.startsWith("developers.") ||
    hostname.startsWith("support.") ||
    hostname.startsWith("help.") ||
    hostname.startsWith("kb.") ||
    hostname.startsWith("knowledgebase.") ||
    hostnameMatchesAny(hostname, ["readthedocs.io"]);
  const newsLike =
    hostname.startsWith("news.") ||
    hostname.startsWith("press.") ||
    hostname.includes(".news.");

  if (docsLike) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "docs",
      sourceTypeLabel: "문서",
      authorityTier: "high",
      authorityLabel: "높음",
      authorityScore: 0.82,
    };
  }

  if (hostnameMatchesAny(hostname, wikiDomains)) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "wiki",
      sourceTypeLabel: "위키",
      authorityTier: hostnameMatchesAny(hostname, ["wikipedia.org", "wikidata.org"]) ? "high" : "medium",
      authorityLabel: hostnameMatchesAny(hostname, ["wikipedia.org", "wikidata.org"]) ? "높음" : "보통",
      authorityScore: hostnameMatchesAny(hostname, ["wikipedia.org", "wikidata.org"]) ? 0.8 : 0.62,
    };
  }

  if (newsLike || hostnameMatchesAny(hostname, newsDomains)) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "news",
      sourceTypeLabel: "뉴스",
      authorityTier: "high",
      authorityLabel: "높음",
      authorityScore: 0.86,
    };
  }

  if (hostnameMatchesAny(hostname, directoryDomains)) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "directory",
      sourceTypeLabel: "디렉터리",
      authorityTier: "medium",
      authorityLabel: "보통",
      authorityScore: 0.6,
    };
  }

  if (hostnameMatchesAny(hostname, communityDomains)) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "community",
      sourceTypeLabel: "커뮤니티",
      authorityTier: "low",
      authorityLabel: "낮음",
      authorityScore: 0.35,
    };
  }

  if (hostnameMatchesAny(hostname, socialDomains)) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "social",
      sourceTypeLabel: "소셜",
      authorityTier: "low",
      authorityLabel: "낮음",
      authorityScore: 0.28,
    };
  }

  if (hostnameMatchesAny(hostname, blogDomains) || hostname.startsWith("blog.")) {
    return {
      url,
      hostname,
      isOfficial: false,
      sourceTypeId: "blog",
      sourceTypeLabel: "블로그",
      authorityTier: "low",
      authorityLabel: "낮음",
      authorityScore: 0.42,
    };
  }

  return {
    url,
    hostname,
    isOfficial: false,
    sourceTypeId: "unknown",
    sourceTypeLabel: "미분류",
    authorityTier: "medium",
    authorityLabel: "보통",
    authorityScore: 0.5,
  };
}

function computeCitationDetails(citations, entityInput) {
  return uniqueStrings(citations).map((citation) => classifyCitationSource(citation, entityInput));
}

function computeCitationMetricsFromDetails(citationDetails) {
  const details = Array.isArray(citationDetails) ? citationDetails : [];
  const officialCitations = details.filter((detail) => detail?.isOfficial);

  return {
    total: details.length,
    official: officialCitations.length,
    unofficial: Math.max(details.length - officialCitations.length, 0),
    officialRatio: details.length > 0 ? roundMetric(officialCitations.length / details.length) : null,
    hasOfficialCitation: officialCitations.length > 0,
  };
}

function computeCitationMetrics(citations, entityInput) {
  return computeCitationMetricsFromDetails(computeCitationDetails(citations, entityInput));
}

function computeSourceProfile(citationDetails, entityInput = null) {
  const details = Array.isArray(citationDetails) ? citationDetails : [];
  const archetype = inferSourceArchetype(entityInput);
  const weights = archetype.sourceTypeWeights || SOURCE_ARCHETYPE_RULES.general_business.sourceTypeWeights;
  const typeCounts = details.reduce((acc, detail) => {
    const key = detail?.sourceTypeId || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const authorityTierCounts = details.reduce((acc, detail) => {
    const key = detail?.authorityTier || "medium";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });

  const dominantTypeId = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
  const dominantTypeLabel = details.find((detail) => detail?.sourceTypeId === dominantTypeId)?.sourceTypeLabel || "출처 없음";
  const dominantAuthorityTier =
    authorityTierCounts.high >= authorityTierCounts.medium && authorityTierCounts.high >= authorityTierCounts.low && authorityTierCounts.high > 0
      ? "high"
      : authorityTierCounts.medium >= authorityTierCounts.low && authorityTierCounts.medium > 0
        ? "medium"
        : authorityTierCounts.low > 0
          ? "low"
          : "none";
  const dominantAuthorityLabel =
    dominantAuthorityTier === "high"
      ? "높음"
      : dominantAuthorityTier === "medium"
        ? "보통"
        : dominantAuthorityTier === "low"
          ? "낮음"
          : "없음";
  const highAuthorityCount = details.filter((detail) => detail?.authorityTier === "high").length;
  const authorityScoreAverage =
    details.length > 0
      ? roundMetric(details.reduce((sum, detail) => sum + Number(detail?.authorityScore || 0), 0) / details.length)
      : null;
  const fitScores = details.map((detail) => {
    const typeId = detail?.sourceTypeId || "unknown";
    return Number(weights[typeId] ?? weights.default ?? 0.45);
  });
  const sourceFitAverage =
    fitScores.length > 0
      ? roundMetric(fitScores.reduce((sum, value) => sum + value, 0) / fitScores.length)
      : null;
  const sourceQualityAverage =
    details.length > 0
      ? roundMetric(
          details.reduce((sum, detail) => {
            const typeId = detail?.sourceTypeId || "unknown";
            const fitWeight = Number(weights[typeId] ?? weights.default ?? 0.45);
            return sum + fitWeight * Number(detail?.authorityScore || 0);
          }, 0) / details.length
        )
      : null;
  const expectedSourceCount = details.filter((detail) => Number(weights[detail?.sourceTypeId || "unknown"] ?? weights.default ?? 0.45) >= 0.7).length;
  const offPatternCount = details.filter((detail) => Number(weights[detail?.sourceTypeId || "unknown"] ?? weights.default ?? 0.45) < 0.45).length;
  const officialCount = details.filter((detail) => detail?.isOfficial).length;
  const weightedTypeScores = details.reduce((acc, detail) => {
    const key = detail?.sourceTypeId || "unknown";
    const fitWeight = Number(weights[key] ?? weights.default ?? 0.45);
    acc[key] = roundMetric((acc[key] || 0) + fitWeight, 4);
    return acc;
  }, {});
  const dominantWeightedTypeId = Object.entries(weightedTypeScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
  const dominantWeightedTypeLabel =
    details.find((detail) => detail?.sourceTypeId === dominantWeightedTypeId)?.sourceTypeLabel || "출처 없음";

  let sourceFitStatus = "none";
  if (details.length > 0) {
    if (officialCount === 0 && archetype.officialPreferred && Number(sourceFitAverage) >= 0.55) {
      sourceFitStatus = "official_gap";
    } else if (
      Number(sourceFitAverage) >= 0.72 &&
      expectedSourceCount / Math.max(details.length, 1) >= 0.5
    ) {
      sourceFitStatus = "strong";
    } else if (
      offPatternCount / Math.max(details.length, 1) >= 0.5 ||
      Number(sourceFitAverage) < 0.45
    ) {
      sourceFitStatus = "off_pattern";
    } else {
      sourceFitStatus = "mixed";
    }
  }
  const sourceFitMeta = getSourceFitMetaFromProfile({ sourceFitStatus });

  return {
    total: details.length,
    archetypeId: archetype.id,
    archetypeLabel: archetype.label,
    officialPreferred: Boolean(archetype.officialPreferred),
    expectedSourceTypes: archetype.expectedSourceTypes,
    typeCounts,
    dominantTypeId,
    dominantTypeLabel,
    weightedTypeScores,
    dominantWeightedTypeId,
    dominantWeightedTypeLabel,
    authorityTierCounts,
    dominantAuthorityTier,
    dominantAuthorityLabel,
    highAuthorityCount,
    highAuthorityRatio: details.length > 0 ? roundMetric(highAuthorityCount / details.length) : null,
    authorityScoreAverage,
    expectedSourceCount,
    expectedSourceCoverage: details.length > 0 ? roundMetric(expectedSourceCount / details.length) : null,
    offPatternCount,
    sourceFitAverage,
    sourceQualityAverage,
    sourceFitStatus,
    sourceFitLabel: sourceFitMeta.label,
    officialGap: sourceFitStatus === "official_gap",
  };
}

function computeSourceMix(citationMetrics) {
  const total = citationMetrics?.total || 0;
  const official = citationMetrics?.official || 0;
  const unofficial = citationMetrics?.unofficial || 0;

  if (total <= 0) {
    return {
      id: "none",
      label: "출처 없음",
      shortLabel: "none",
      dominant: "none",
    };
  }

  if (official > 0 && unofficial === 0) {
    return {
      id: "official_only",
      label: "공식 위주",
      shortLabel: "official",
      dominant: "official",
    };
  }

  if (official === 0 && unofficial > 0) {
    return {
      id: "third_party_only",
      label: "제3자 위주",
      shortLabel: "3rd-party",
      dominant: "third_party",
    };
  }

  return {
    id: "mixed",
    label: official >= unofficial ? "혼합(공식 우세)" : "혼합(제3자 우세)",
    shortLabel: "mixed",
    dominant: official >= unofficial ? "official" : "third_party",
  };
}

function computeQueryPlanCoverage(result) {
  const plannedCount = result?.queryPlan?.plannedQueryCount || result?.queryPlan?.plannedQueries?.length || 0;
  const observedCount = uniqueStrings(result?.searchQueriesUsed || []).length;
  const hasSearchActivity =
    Boolean(result?.groundingMetadata?.grounded) ||
    Number.isFinite(result?.groundingMetadata?.toolCallCount) ||
    Number.isFinite(result?.groundingMetadata?.searchResultCount) ||
    (result?.citationMetrics?.total || 0) > 0;

  if (!plannedCount) {
    return {
      plannedCount: 0,
      observedCount,
      ratio: null,
      status: "none",
      label: "계획 없음",
    };
  }

  if (observedCount > 0) {
    const ratio = roundMetric(Math.min(observedCount / plannedCount, 1));
    return {
      plannedCount,
      observedCount,
      ratio,
      status: ratio >= 0.6 ? "strong" : "partial",
      label: ratio >= 0.6 ? "관측 충분" : "관측 일부",
    };
  }

  if (hasSearchActivity) {
    return {
      plannedCount,
      observedCount: 0,
      ratio: 0,
      status: "opaque",
      label: "관측 불투명",
    };
  }

  return {
    plannedCount,
    observedCount: 0,
    ratio: 0,
    status: "none",
    label: "관측 없음",
  };
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > 200) return "";
  if (/^https?:\/\//i.test(normalized)) return "";
  if (SEARCH_QUERY_NOISE.has(normalized.toLowerCase())) return "";

  return normalized;
}

function sanitizePreview(value, limit = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function collectSearchQueries(value, bucket, depth = 0) {
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

function collectPayloadDiagnostics(value, bucket, path = "root", depth = 0, maxEntries = 16) {
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

function summarizeObjectKeys(value, limit = 12) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).slice(0, limit)
    : [];
}

function collectExplicitQueryValues(value, bucket) {
  if (typeof value === "string") {
    const query = normalizeSearchQuery(value);
    if (query) bucket.push(query);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectExplicitQueryValues(item, bucket));
  }
}

function extractKnownQueryFields(value) {
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

function extractChatGptSearchQueries(payload) {
  const searchNodes = Array.isArray(payload?.output)
    ? payload.output.filter((item) => typeof item?.type === "string" && item.type.toLowerCase().includes("search"))
    : [];
  return uniqueStrings(searchNodes.flatMap((node) => extractKnownQueryFields(node)));
}

function countChatGptSearchToolCalls(payload) {
  return Array.isArray(payload?.output)
    ? payload.output.filter((item) => typeof item?.type === "string" && item.type.toLowerCase().includes("search")).length
    : 0;
}

function extractPerplexitySearchQueries(payload) {
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

function getPerplexitySearchResultCount(payload) {
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

function getGeminiGroundingMetadataNode(payload) {
  return (
    payload?.candidates?.[0]?.groundingMetadata ||
    payload?.candidates?.[0]?.grounding_metadata ||
    payload?.groundingMetadata ||
    payload?.grounding_metadata ||
    null
  );
}

function getGeminiGroundingChunks(payload) {
  const metadata = getGeminiGroundingMetadataNode(payload);
  if (Array.isArray(metadata?.groundingChunks)) return metadata.groundingChunks;
  if (Array.isArray(metadata?.grounding_chunks)) return metadata.grounding_chunks;
  return [];
}

function getGeminiGroundingSupports(payload) {
  const metadata = getGeminiGroundingMetadataNode(payload);
  if (Array.isArray(metadata?.groundingSupports)) return metadata.groundingSupports;
  if (Array.isArray(metadata?.grounding_supports)) return metadata.grounding_supports;
  return [];
}

function extractGeminiSearchQueries(payload) {
  const metadata = getGeminiGroundingMetadataNode(payload);
  return uniqueStrings(
    Array.isArray(metadata?.webSearchQueries)
      ? metadata.webSearchQueries
      : Array.isArray(metadata?.web_search_queries)
        ? metadata.web_search_queries
        : []
  );
}

function extractGeminiCitations(payload) {
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

function getGeminiGroundingChunkCount(payload) {
  const chunks = getGeminiGroundingChunks(payload);
  return chunks.length > 0 ? chunks.length : null;
}

function getGeminiGroundingSupportCount(payload) {
  const supports = getGeminiGroundingSupports(payload);
  return supports.length > 0 ? supports.length : null;
}

function buildPayloadDiagnostics({ engine, mode, payload, searchQueriesUsed, citations }) {
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

function maybeLogPayloadDiagnostics(config, label, diagnostics) {
  if (!config?.debugPayloads || !diagnostics) return;
  console.log(`[AAO][AI_CHECK_DEBUG] ${label} ${JSON.stringify(diagnostics)}`);
}

function buildGroundingMetadata({ engine, mode, payload, citations, searchQueriesUsed, entityInput }) {
  if (mode !== AI_CHECK_MODES.LIVE_SEARCH) return null;

  const citationMetrics = computeCitationMetrics(citations, entityInput);
  const chatgptToolCalls = engine === "chatgpt" ? countChatGptSearchToolCalls(payload) : null;
  const perplexitySearchResults = engine === "perplexity" ? getPerplexitySearchResultCount(payload) : null;
  const geminiGroundingChunks = engine === "gemini" ? getGeminiGroundingChunkCount(payload) : null;
  const geminiGroundingSupports = engine === "gemini" ? getGeminiGroundingSupportCount(payload) : null;
  const grounded =
    citationMetrics.total > 0 ||
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
    sourceCount: citationMetrics.total,
    officialCitationCount: citationMetrics.official,
    officialCitationRatio: citationMetrics.officialRatio,
    hasOfficialCitation: citationMetrics.hasOfficialCitation,
    supportCount: Number.isFinite(geminiGroundingSupports) ? geminiGroundingSupports : null,
  };
}

function summarizeAiResults(results) {
  const items = Array.isArray(results) ? results : [];
  const supported = items.filter((result) => result?.status !== "unsupported" && result?.status !== "skipped");
  const sourceMixes = supported.map((result) => result?.sourceMix || computeSourceMix(result?.citationMetrics));
  const citationDetails = supported.flatMap((result) => (Array.isArray(result?.citationDetails) ? result.citationDetails : []));
  const sourceProfiles = supported.map((result) => result?.sourceProfile || computeSourceProfile(result?.citationDetails || []));
  const queryPlanCoverages = supported.map((result) => result?.queryPlanCoverage || computeQueryPlanCoverage(result));
  const groundedCount = supported.filter((result) => result?.groundingMetadata?.grounded).length;
  const officialEngineCount = supported.filter((result) => result?.citationMetrics?.hasOfficialCitation).length;
  const queryMetadataCount = supported.filter((result) => (result?.searchQueriesUsed || []).length > 0).length;
  const totalCitations = supported.reduce((sum, result) => sum + (result?.citationMetrics?.total || 0), 0);
  const officialCitations = supported.reduce((sum, result) => sum + (result?.citationMetrics?.official || 0), 0);
  const searchQueriesUsed = uniqueStrings(
    supported.flatMap((result) => (Array.isArray(result?.searchQueriesUsed) ? result.searchQueriesUsed : []))
  );
  const plannedSearchQueries = uniqueStrings(
    supported.flatMap((result) => (Array.isArray(result?.queryPlan?.plannedQueries) ? result.queryPlan.plannedQueries : []))
  );
  const querySlotLabels = uniqueStrings(
    supported.flatMap((result) =>
      Array.isArray(result?.queryPlan?.slots) ? result.queryPlan.slots.map((slot) => slot?.label).filter(Boolean) : []
    )
  );
  const fanOutObservedCount = queryPlanCoverages.filter((coverage) => coverage?.status === "strong" || coverage?.status === "partial").length;
  const fanOutOpaqueCount = queryPlanCoverages.filter((coverage) => coverage?.status === "opaque").length;
  const observedFanOutRatios = queryPlanCoverages
    .map((coverage) => coverage?.ratio)
    .filter((ratio) => Number.isFinite(Number(ratio)) && Number(ratio) > 0);
  const sourceMixCounts = sourceMixes.reduce(
    (acc, mix) => {
      const key = mix?.id || "none";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { official_only: 0, mixed: 0, third_party_only: 0, none: 0 }
  );
  const sourceMixDominantId =
    sourceMixCounts.official_only >= sourceMixCounts.mixed &&
    sourceMixCounts.official_only >= sourceMixCounts.third_party_only &&
    sourceMixCounts.official_only > 0
      ? "official_only"
      : sourceMixCounts.mixed >= sourceMixCounts.third_party_only && sourceMixCounts.mixed > 0
        ? "mixed"
        : sourceMixCounts.third_party_only > 0
          ? "third_party_only"
          : "none";
  const sourceMixDominantLabel =
    sourceMixDominantId === "official_only"
      ? "공식 위주"
      : sourceMixDominantId === "mixed"
        ? "혼합"
        : sourceMixDominantId === "third_party_only"
          ? "제3자 위주"
          : "출처 없음";
  const aggregateSourceProfile = computeSourceProfile(citationDetails);
  const sourceAuthorityAverage =
    sourceProfiles.length > 0
      ? roundMetric(
          sourceProfiles
            .map((profile) => profile?.authorityScoreAverage)
            .filter((value) => Number.isFinite(Number(value)))
            .reduce((sum, value, _, arr) => sum + Number(value) / arr.length, 0)
        )
      : null;
  const sourceFitCounts = sourceProfiles.reduce(
    (acc, profile) => {
      const key = profile?.sourceFitStatus || "none";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { strong: 0, mixed: 0, official_gap: 0, off_pattern: 0, none: 0 }
  );
  const dominantSourceFitStatus =
    sourceFitCounts.strong >= sourceFitCounts.mixed &&
    sourceFitCounts.strong >= sourceFitCounts.official_gap &&
    sourceFitCounts.strong >= sourceFitCounts.off_pattern &&
    sourceFitCounts.strong > 0
      ? "strong"
      : sourceFitCounts.official_gap >= sourceFitCounts.mixed &&
        sourceFitCounts.official_gap >= sourceFitCounts.off_pattern &&
        sourceFitCounts.official_gap > 0
        ? "official_gap"
        : sourceFitCounts.off_pattern >= sourceFitCounts.mixed && sourceFitCounts.off_pattern > 0
          ? "off_pattern"
          : sourceFitCounts.mixed > 0
            ? "mixed"
            : "none";
  const dominantSourceFitLabel = getSourceFitMetaFromProfile({ sourceFitStatus: dominantSourceFitStatus }).label;
  const observedSourceFitAverages = sourceProfiles
    .map((profile) => profile?.sourceFitAverage)
    .filter((value) => Number.isFinite(Number(value)));
  const sourceFitAverage =
    observedSourceFitAverages.length > 0
      ? roundMetric(observedSourceFitAverages.reduce((sum, value) => sum + Number(value), 0) / observedSourceFitAverages.length)
      : null;
  const archetypeCounts = sourceProfiles.reduce((acc, profile) => {
    const key = profile?.archetypeId || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const dominantArchetypeId = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  const dominantArchetypeLabel = sourceProfiles.find((profile) => profile?.archetypeId === dominantArchetypeId)?.archetypeLabel || "미분류";
  const factChecks = supported.map((result) => result?.factCheck).filter(Boolean);
  const factVerdictCounts = factChecks.reduce(
    (acc, factCheck) => {
      const key = factCheck?.verdict || "weak";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { aligned: 0, weak: 0, domain_mismatch: 0, service_mismatch: 0, wrong_entity: 0 }
  );

  return {
    supportedCount: supported.length,
    groundedCount,
    groundedCoverage: supported.length > 0 ? roundMetric(groundedCount / supported.length) : null,
    enginesWithOfficialCitation: officialEngineCount,
    officialCitationCoverage: supported.length > 0 ? roundMetric(officialEngineCount / supported.length) : null,
    totalCitations,
    officialCitations,
    officialCitationRatio: totalCitations > 0 ? roundMetric(officialCitations / totalCitations) : null,
    searchQueriesUsed,
    searchQueryCount: searchQueriesUsed.length,
    plannedSearchQueries,
    plannedSearchQueryCount: plannedSearchQueries.length,
    querySlotLabels,
    querySlotCount: querySlotLabels.length,
    fanOutObservedCount,
    fanOutOpaqueCount,
    fanOutCompletenessAverage:
      observedFanOutRatios.length > 0
        ? roundMetric(observedFanOutRatios.reduce((sum, ratio) => sum + Number(ratio), 0) / observedFanOutRatios.length)
        : null,
    sourceMixCounts,
    sourceMixDominantId,
    sourceMixDominantLabel,
    sourceTypeCounts: aggregateSourceProfile.typeCounts,
    dominantSourceTypeId: aggregateSourceProfile.dominantTypeId,
    dominantSourceTypeLabel: aggregateSourceProfile.dominantTypeLabel,
    authorityTierCounts: aggregateSourceProfile.authorityTierCounts,
    dominantAuthorityTier: aggregateSourceProfile.dominantAuthorityTier,
    dominantAuthorityLabel: aggregateSourceProfile.dominantAuthorityLabel,
    highAuthorityCitationRatio: aggregateSourceProfile.highAuthorityRatio,
    sourceAuthorityAverage,
    sourceFitCounts,
    dominantSourceFitStatus,
    dominantSourceFitLabel,
    sourceFitAverage,
    dominantArchetypeId,
    dominantArchetypeLabel,
    queryMetadataCoverage: supported.length > 0 ? roundMetric(queryMetadataCount / supported.length) : null,
    factVerdictCounts,
    factAlignedCount: factVerdictCounts.aligned || 0,
    factWeakCount: factVerdictCounts.weak || 0,
    factDomainMismatchCount: factVerdictCounts.domain_mismatch || 0,
    factServiceMismatchCount: factVerdictCounts.service_mismatch || 0,
    factWrongEntityCount: factVerdictCounts.wrong_entity || 0,
    factAlignmentCoverage:
      supported.length > 0 ? roundMetric((factVerdictCounts.aligned || 0) / supported.length) : null,
  };
}

function createBaseResponse(engine, mode, intent, entityInput) {
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

function createUnsupportedResponse(engine, mode, intent, entityInput, reason) {
  return {
    ...createBaseResponse(engine, mode, intent, entityInput),
    response: `${engine}는 현재 ${getModeMeta(mode).shortLabel} · ${getIntentMeta(intent).shortLabel} 조합을 지원하지 않습니다.`,
    status: "unsupported",
    reason,
  };
}

function createSkippedResponse(engine, mode, intent, entityInput, reason) {
  return {
    ...createBaseResponse(engine, mode, intent, entityInput),
    response: `${engine} ${getModeMeta(mode).shortLabel} · ${getIntentMeta(intent).shortLabel} 검사는 비용 가드로 생략되었습니다.`,
    status: "skipped",
    reason,
  };
}

function buildCacheKey(baseResponse, entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const crawlSnapshotToken = hashString(JSON.stringify(entity.crawlSnapshot || {}));
  return [
    AI_CHECK_CACHE_VERSION,
    baseResponse.engine,
    baseResponse.mode,
    baseResponse.intent,
    entity.companyName,
    entity.domain,
    baseResponse.query,
    crawlSnapshotToken,
  ].join("::");
}

function cloneCachedResult(result) {
  return JSON.parse(JSON.stringify(result));
}

function getCachedResult(baseResponse, entityInput) {
  const key = buildCacheKey(baseResponse, entityInput);
  const cached = aiCheckCache.get(key);

  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    aiCheckCache.delete(key);
    return null;
  }

  return cloneCachedResult(cached.result);
}

function pruneAiCheckCache(maxEntries) {
  for (const [key, cached] of aiCheckCache.entries()) {
    if (!cached || cached.expiresAt <= Date.now()) {
      aiCheckCache.delete(key);
    }
  }

  while (aiCheckCache.size > maxEntries) {
    const oldestKey = aiCheckCache.keys().next().value;
    if (!oldestKey) break;
    aiCheckCache.delete(oldestKey);
  }
}

function setCachedResult(baseResponse, entityInput, result, cacheTtlMs, cacheMaxEntries) {
  const key = buildCacheKey(baseResponse, entityInput);
  if (aiCheckCache.has(key)) {
    aiCheckCache.delete(key);
  }
  aiCheckCache.set(key, {
    expiresAt: Date.now() + cacheTtlMs,
    result: cloneCachedResult(result),
  });
  pruneAiCheckCache(cacheMaxEntries);
}

async function askChatGPT(entityInput, mode, intent, config) {
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
      const errBody = await res.text();
      console.error(`[AAO] ChatGPT API error (${mode}/${intent}): ${res.status}`, errBody.substring(0, 200));
      return {
        ...request,
        response: `API 오류 (${res.status})`,
        status: "error",
        error: errBody,
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

async function askGemini(entityInput, mode, intent, config) {
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
      const errBody = await res.text();
      console.error(`[AAO] Gemini API error (${mode}/${intent}): ${res.status}`, errBody.substring(0, 200));
      return {
        ...request,
        response: `API 오류 (${res.status})`,
        status: "error",
        error: errBody,
        latencyMs: Date.now() - startedAt,
      };
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const text = (Array.isArray(parts) ? parts.map((part) => part.text || "").join("") : "")
      || data.candidates?.[0]?.output
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

    if (!text && data.error) {
      console.error("[AAO] Gemini API error:", data.error);
      return {
        ...request,
        response: `API 오류: ${data.error.message || "알 수 없는 오류"}`,
        status: "error",
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

async function askPerplexity(entityInput, mode, intent, config) {
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
      const errBody = await res.text();
      console.error(`[AAO] Perplexity API error (${mode}/${intent}): ${res.status}`, errBody.substring(0, 200));
      return {
        ...request,
        response: `API 오류 (${res.status})`,
        status: "error",
        error: errBody,
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

function analyzeResponse(response, entityInput) {
  const citationDetails =
    response.citationDetails || computeCitationDetails(response.citations || [], entityInput);
  const citationMetrics =
    response.citationMetrics || computeCitationMetricsFromDetails(citationDetails);
  const sourceProfile =
    response.sourceProfile || computeSourceProfile(citationDetails, entityInput);
  const sourceMix = computeSourceMix(citationMetrics);
  const queryPlanCoverage = computeQueryPlanCoverage({
    queryPlan: response.queryPlan || null,
    searchQueriesUsed: response.searchQueriesUsed || [],
    groundingMetadata: response.groundingMetadata || null,
    citationMetrics,
  });

  if (response.status === "unsupported") {
    return {
      engineId: response.engine,
      mode: response.mode,
      intent: response.intent,
      intentLabel: response.intentLabel,
      query: response.query,
      queryType: response.queryType,
      queryPlan: response.queryPlan || null,
      knows: false,
      matchStatus: "unsupported",
      response: response.response || "(미지원)",
      citations: [],
      searchQueriesUsed: [],
      groundingMetadata: null,
      citationMetrics,
      citationDetails,
      sourceProfile,
      sourceMix,
      queryPlanCoverage,
      factCheck: null,
      recognitionSource: "rules",
      aiRecognitionFallback: null,
      payloadDiagnostics: null,
      mentionPosition: { found: false, ratio: null, bucket: "none" },
      reason: response.reason || "이 엔진은 현재 이 모드를 지원하지 않습니다.",
      accuracy: null,
      status: "unsupported",
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
    };
  }

  if (response.status === "skipped") {
    return {
      engineId: response.engine,
      mode: response.mode,
      intent: response.intent,
      intentLabel: response.intentLabel,
      query: response.query,
      queryType: response.queryType,
      queryPlan: response.queryPlan || null,
      knows: false,
      matchStatus: "skipped",
      response: response.response || "(생략)",
      citations: [],
      searchQueriesUsed: [],
      groundingMetadata: null,
      citationMetrics,
      citationDetails,
      sourceProfile,
      sourceMix,
      queryPlanCoverage,
      factCheck: null,
      recognitionSource: "rules",
      aiRecognitionFallback: null,
      payloadDiagnostics: null,
      mentionPosition: { found: false, ratio: null, bucket: "none" },
      reason: response.reason || "비용 가드로 인해 실행하지 않았습니다.",
      accuracy: null,
      status: "skipped",
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
    };
  }

  if (response.status === "error" || !response.response) {
    return {
      engineId: response.engine,
      mode: response.mode,
      intent: response.intent,
      intentLabel: response.intentLabel,
      query: response.query,
      queryType: response.queryType,
      queryPlan: response.queryPlan || null,
      knows: false,
      matchStatus: "error",
      response: response.response || "(응답 없음)",
      citations: response.citations || [],
      searchQueriesUsed: response.searchQueriesUsed || [],
      groundingMetadata: response.groundingMetadata || null,
      citationMetrics,
      citationDetails,
      sourceProfile,
      sourceMix,
      queryPlanCoverage,
      factCheck: null,
      recognitionSource: "rules",
      aiRecognitionFallback: null,
      payloadDiagnostics: response.payloadDiagnostics || null,
      mentionPosition: { found: false, ratio: null, bucket: "none" },
      reason: "API 오류 또는 빈 응답으로 인해 판정할 수 없습니다.",
      accuracy: 0,
      status: response.status,
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
    };
  }

  const recognitionContext = buildRecognitionContext(response.response, entityInput);
  const factCheck = buildFactCheck(response, entityInput, recognitionContext, citationMetrics);
  const classification = classifyRecognition(response.response, entityInput, factCheck, recognitionContext);
  const knows = classification.matchStatus === "recognized";
  const text = recognitionContext.text;
  const crawlVerification = computeCrawlVerificationSignals(response.response, entityInput);

  let accuracy = 0;

  if (classification.matchStatus === "misidentified") {
    accuracy = 0;
  } else if (classification.matchStatus === "unknown") {
    accuracy = factCheck?.verdict === "weak" ? 10 : 5;
  } else {
    // 교차검증된 신호 (entityInput 기반 검증 — 높은 가중치)
    if (factCheck?.verdict === "aligned") accuracy += 25;
    if (factCheck?.serviceDefinitionMatch === true) accuracy += 20;
    if (factCheck?.officialDomainSignal) accuracy += 15;
    if (factCheck?.hasOfficialCitation) accuracy += 5;
    if (factCheck?.anchoredEntitySignal) accuracy += 5;

    // live_search citation 확인
    if (response.mode === AI_CHECK_MODES.LIVE_SEARCH && (response.citations || []).length > 0) {
      accuracy += 5;
    }

    // crawl snapshot과 일치하는 사실 신호
    if (crawlVerification.matchedYears.length > 0) accuracy += 10;
    if (crawlVerification.matchedEmails.length > 0) accuracy += 8;
    if (crawlVerification.matchedHostnames.length > 0) accuracy += 6;
    if (crawlVerification.matchedPhraseHints.length >= 2) accuracy += 10;
    else if (crawlVerification.matchedPhraseHints.length === 1) accuracy += 5;
    if (crawlVerification.matchedServiceHints.length >= 2) accuracy += 8;
    else if (crawlVerification.matchedServiceHints.length === 1) accuracy += 4;

    // 응답 풍부도 (비교차검증 — 낮은 가중치)
    if (text.length > 1000) accuracy += 5;
    else if (text.length > 300) accuracy += 3;
    // 설립 주장: 검증된 연도 일치 → 가산 / 스냅샷 있는데 불일치 → 감점
    if (crawlVerification.foundFoundingClaim) {
      if (crawlVerification.matchedYears.length > 0) {
        accuracy += 2;
      } else if (crawlVerification.hasData) {
        accuracy -= 3;
      }
    }
    if (crawlVerification.hasData && crawlVerification.foundContactClaim && crawlVerification.matchedEmails.length === 0 && crawlVerification.matchedHostnames.length === 0) {
      accuracy -= 3;
    }

    accuracy = Math.max(20, Math.min(accuracy, 95));
  }

  return {
    engineId: response.engine,
    mode: response.mode,
    intent: response.intent,
    intentLabel: response.intentLabel,
    query: response.query,
    queryType: response.queryType,
    queryPlan: response.queryPlan || null,
    knows,
    matchStatus: classification.matchStatus,
    response: response.response,
    citations: response.citations || [],
    searchQueriesUsed: response.searchQueriesUsed || [],
    groundingMetadata: response.groundingMetadata || null,
    citationMetrics,
    citationDetails,
    sourceProfile,
    sourceMix,
    queryPlanCoverage,
    factCheck,
    crawlVerification,
    recognitionContext,
    recognitionSource: "rules",
    aiRecognitionFallback: null,
    payloadDiagnostics: response.payloadDiagnostics || null,
    mentionPosition: computeMentionPosition(response.response, entityInput),
    reason: classification.reason,
    accuracy,
    status: "success",
    latencyMs: response.latencyMs,
    tokenUsage: response.tokenUsage,
  };
}

export function __testEvaluateAiCheckResponse(response, entityInput) {
  const normalizedResponse = {
    engine: response?.engine || "fixture",
    mode: response?.mode || AI_CHECK_MODES.LIVE_SEARCH,
    intent: response?.intent || "awareness",
    intentLabel: getIntentMeta(response?.intent || "awareness").label,
    query: response?.query || "",
    queryType: response?.queryType || getModeMeta(response?.mode || AI_CHECK_MODES.LIVE_SEARCH).queryType,
    queryPlan: response?.queryPlan || null,
    response: response?.response || "",
    citations: Array.isArray(response?.citations) ? response.citations : [],
    searchQueriesUsed: Array.isArray(response?.searchQueriesUsed) ? response.searchQueriesUsed : [],
    groundingMetadata: response?.groundingMetadata || null,
    citationMetrics: response?.citationMetrics || null,
    citationDetails: response?.citationDetails || null,
    sourceProfile: response?.sourceProfile || null,
    status: response?.status || "success",
    latencyMs: response?.latencyMs ?? null,
    tokenUsage: response?.tokenUsage || null,
    recognitionSource: response?.recognitionSource || "rules",
    aiRecognitionFallback: response?.aiRecognitionFallback || null,
    payloadDiagnostics: response?.payloadDiagnostics || null,
  };

  return analyzeResponse(normalizedResponse, entityInput);
}

export function __testEvaluateSourceProfile(citations, entityInput) {
  const citationDetails = computeCitationDetails(citations, entityInput);
  const citationMetrics = computeCitationMetricsFromDetails(citationDetails);
  const sourceProfile = computeSourceProfile(citationDetails, entityInput);
  const sourceMix = computeSourceMix(citationMetrics);

  return {
    citationDetails,
    citationMetrics,
    sourceProfile,
    sourceMix,
  };
}

function getTaskPriority(engine, mode, intent) {
  const modeIntentPriority = {
    [AI_CHECK_MODES.LIVE_SEARCH]: {
      awareness: 100,
      comparison: 60,
      purchase: 58,
    },
    [AI_CHECK_MODES.STRICT_RECALL]: {
      awareness: 80,
      comparison: 35,
      purchase: 30,
    },
  };

  const enginePriority = {
    chatgpt: 10,
    perplexity: 8,
    gemini: 6,
  };

  return (modeIntentPriority[mode]?.[intent] || 0) + (enginePriority[engine] || 0);
}

function buildTaskDefinitions(entityInput, config) {
  const definitions = [];

  for (const mode of [AI_CHECK_MODES.STRICT_RECALL, AI_CHECK_MODES.LIVE_SEARCH]) {
    for (const intent of config.enabledIntents) {
      for (const engine of ENGINE_ORDER) {
        if (!SUPPORTED_MODE_BY_ENGINE[engine]?.includes(mode)) {
          definitions.push({
            kind: "static",
            mode,
            intent,
            engine,
            response: createUnsupportedResponse(
              engine,
              mode,
              intent,
              entityInput,
              `${engine}는 ${getModeMeta(mode).shortLabel} 모드를 지원하지 않습니다.`
            ),
          });
          continue;
        }

        if (engine === "chatgpt" && mode === AI_CHECK_MODES.STRICT_RECALL && !config.enableChatgptStrictRecall) {
          definitions.push({
            kind: "static",
            mode,
            intent,
            engine,
            response: createSkippedResponse(
              engine,
              mode,
              intent,
              entityInput,
              "strict recall ChatGPT는 비용 가드 설정으로 비활성화되었습니다."
            ),
          });
          continue;
        }

        const baseResponse = createBaseResponse(engine, mode, intent, entityInput);
        const cachedResult = getCachedResult(baseResponse, entityInput);

        if (cachedResult) {
          definitions.push({
            kind: "cached",
            mode,
            intent,
            engine,
            result: cachedResult,
          });
          continue;
        }

        const runner =
          engine === "chatgpt"
            ? () => askChatGPT(entityInput, mode, intent, config)
            : engine === "perplexity"
              ? () => askPerplexity(entityInput, mode, intent, config)
              : () => askGemini(entityInput, mode, intent, config);

        definitions.push({
          kind: "candidate",
          mode,
          intent,
          engine,
          baseResponse,
          priority: getTaskPriority(engine, mode, intent),
          run: runner,
        });
      }
    }
  }

  return definitions;
}

function createEmptyBudget(config) {
  return {
    maxTasks: config.maxTasks,
    candidates: 0,
    executed: 0,
    cached: 0,
    skipped: 0,
    unsupported: 0,
  };
}

function groupResultsByMode(results, config, budgets) {
  const bundles = {};
  const defaultIntent =
    config.enabledIntents.includes("awareness")
      ? "awareness"
      : config.enabledIntents[0] || "awareness";

  for (const mode of [AI_CHECK_MODES.STRICT_RECALL, AI_CHECK_MODES.LIVE_SEARCH]) {
    const intentResults = {};
    const modeResults = [];

    for (const intent of config.enabledIntents) {
      const resultsForIntent = results
        .filter((result) => result.mode === mode && result.intent === intent)
        .sort((a, b) => ENGINE_ORDER.indexOf(a.engineId) - ENGINE_ORDER.indexOf(b.engineId));

      modeResults.push(...resultsForIntent);
      intentResults[intent] = {
        ...getIntentMeta(intent),
        results: resultsForIntent,
        summary: summarizeAiResults(resultsForIntent),
      };
    }

    bundles[mode] = {
      ...MODE_META[mode],
      defaultIntent,
      intents: config.enabledIntents.map((intent) => getIntentMeta(intent)),
      intentResults,
      results: intentResults[defaultIntent]?.results || [],
      summary: summarizeAiResults(modeResults),
      budget: budgets[mode],
    };
  }

  return bundles;
}

export async function checkAllEngines(entityInput) {
  const config = resolveAiCheckConfig();
  const definitions = buildTaskDefinitions(entityInput, config);
  const budgets = {
    [AI_CHECK_MODES.STRICT_RECALL]: createEmptyBudget(config),
    [AI_CHECK_MODES.LIVE_SEARCH]: createEmptyBudget(config),
  };

  const staticResults = [];
  const cachedResults = [];
  const candidates = [];

  for (const definition of definitions) {
    if (definition.kind === "static") {
      if (definition.response.status === "unsupported") budgets[definition.mode].unsupported += 1;
      if (definition.response.status === "skipped") budgets[definition.mode].skipped += 1;
      staticResults.push(analyzeResponse(definition.response, entityInput));
      continue;
    }

    if (definition.kind === "cached") {
      budgets[definition.mode].cached += 1;
      cachedResults.push(definition.result);
      continue;
    }

    budgets[definition.mode].candidates += 1;
    candidates.push(definition);
  }

  const prioritizedCandidates = [...candidates].sort((a, b) => b.priority - a.priority);
  const runnable = prioritizedCandidates.slice(0, config.maxTasks);
  const overflow = prioritizedCandidates.slice(config.maxTasks);

  const skippedByBudget = overflow.map((definition) => {
    budgets[definition.mode].skipped += 1;
    return analyzeResponse(
      createSkippedResponse(
        definition.engine,
        definition.mode,
        definition.intent,
        entityInput,
        "비용 가드로 인해 우선순위가 낮은 검사는 이번 실행에서 생략되었습니다."
      ),
      entityInput
    );
  });

  const executedSettled = await Promise.allSettled(runnable.map((definition) => definition.run()));

  const executedResults = await Promise.all(executedSettled.map(async (result, index) => {
    const definition = runnable[index];
    budgets[definition.mode].executed += 1;

    if (result.status === "fulfilled") {
      const analyzed = await applyAiRecognitionFallback(analyzeResponse(result.value, entityInput), entityInput, config);
      if (analyzed.status === "success") {
        setCachedResult(definition.baseResponse, entityInput, analyzed, config.cacheTtlMs, config.cacheMaxEntries);
      }
      return analyzed;
    }

    return analyzeResponse(
      {
        ...definition.baseResponse,
        response: "API 호출 실패",
        status: "error",
      },
      entityInput
    );
  }));

  const allResults = [
    ...staticResults,
    ...cachedResults,
    ...skippedByBudget,
    ...executedResults,
  ];

  return {
    defaultMode: AI_CHECK_MODES.LIVE_SEARCH,
    defaultIntent:
      config.enabledIntents.includes("awareness")
        ? "awareness"
        : config.enabledIntents[0] || "awareness",
    modes: groupResultsByMode(allResults, config, budgets),
  };
}

// ---------------------------------------------------------------------------
// Ground Truth Extraction + Stage 2 Field Delivery Evaluation
// ---------------------------------------------------------------------------

const GROUND_TRUTH_FIELDS = [
  "entity_name",
  "entity_type",
  "founded",
  "headquarters",
  "key_products",
  "ceo_or_leader",
  "employee_count",
  "revenue",
  "parent_company",
  "description",
  "competitors",
  "unique_value",
];

const GT_ARRAY_FIELDS = new Set(["key_products", "competitors"]);

const FACT_LABEL_MAP = {
  entity_name: ["회사명", "서비스명", "브랜드명", "name", "상호"],
  entity_type: ["업종", "산업", "분류", "type", "industry", "사업 분야", "업태"],
  founded: ["설립", "창립", "founded", "설립일", "창립일", "설립연도"],
  headquarters: ["본사", "위치", "headquarters", "location", "주소", "소재지"],
  ceo_or_leader: ["대표", "대표자", "ceo", "founder", "대표이사", "대표자명"],
  employee_count: ["직원 수", "임직원", "employees", "인원"],
  revenue: ["매출", "revenue", "매출액"],
  parent_company: ["모회사", "parent", "소속"],
  key_products: ["서비스", "제품", "products", "services", "주요 서비스", "주요 제품", "사업 영역"],
  description: ["한 줄 소개", "설명", "description", "소개"],
};

const FACT_ALIAS_TO_FIELD = new Map(
  Object.entries(FACT_LABEL_MAP).flatMap(([field, aliases]) =>
    aliases.map((alias) => [alias.toLowerCase(), field])
  )
);

const FACT_LABEL_ALTERNATION = [...FACT_ALIAS_TO_FIELD.keys()]
  .sort((left, right) => right.length - left.length)
  .map(escapeFactRegExp)
  .join("|");

const FACT_SECTION_ANCHORS = [
  "공식 사실 요약",
  "핵심 사실 요약",
  "기본 정보",
  "company overview",
  "official facts",
  "key facts",
];

const FACT_SCALAR_MAX_LENGTH = {
  entity_name: 120,
  entity_type: 120,
  founded: 40,
  headquarters: 120,
  ceo_or_leader: 120,
  employee_count: 80,
  revenue: 120,
  parent_company: 120,
  description: 420,
};

function escapeFactRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFactValue(field, value) {
  const normalized = String(value || "")
    .replace(/^[\-*•·\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  if (GT_ARRAY_FIELDS.has(field)) {
    const items = normalized
      .split(/,|·|\/| 및 | and /)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => item.length <= 80);
    if (!items.length || items.length > 8) return null;
    const totalChars = items.join(", ").length;
    return totalChars <= 260 ? items : null;
  }

  const maxLength = FACT_SCALAR_MAX_LENGTH[field];
  if (maxLength && normalized.length > maxLength) return null;

  return normalized;
}

function extractFactsBlockFromLines(content = "") {
  const allLines = String(content || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields = {};
  let consecutiveMatches = 0;
  const pendingFields = {};

  for (const line of allLines) {
    const match = line.match(/^[-*]?\s*([^:：]{1,30})\s*[:：]\s*(.+)$/);
    if (!match) {
      if (consecutiveMatches >= 2) Object.assign(fields, pendingFields);
      consecutiveMatches = 0;
      Object.keys(pendingFields).forEach((key) => delete pendingFields[key]);
      continue;
    }

    const label = match[1].trim().toLowerCase();
    const field = FACT_ALIAS_TO_FIELD.get(label);
    const value = normalizeFactValue(field, match[2]);
    if (!field || !value) continue;

    consecutiveMatches += 1;
    pendingFields[field] = {
      value,
      source: "official_facts_block",
    };
  }

  if (consecutiveMatches >= 2) Object.assign(fields, pendingFields);
  return fields;
}

function extractFactsBlockInlineWindow(text = "") {
  const labelPattern = new RegExp(`(${FACT_LABEL_ALTERNATION})\\s*[:：]\\s*`, "gi");
  const matches = [];
  let match;

  while ((match = labelPattern.exec(text))) {
    matches.push({
      label: match[1].toLowerCase(),
      start: match.index,
      valueStart: labelPattern.lastIndex,
    });
  }

  if (matches.length < 2) return {};

  const fields = {};
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const field = FACT_ALIAS_TO_FIELD.get(current.label);
    if (!field || fields[field]) continue;

    const rawValue = text.slice(current.valueStart, next ? next.start : text.length).trim();
    const value = normalizeFactValue(field, rawValue);
    if (!value) continue;

    fields[field] = {
      value,
      source: "official_facts_block",
    };
  }

  return Object.keys(fields).length >= 2 ? fields : {};
}

function buildFactExtractionWindows(content = "") {
  const text = String(content || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];

  const lower = text.toLowerCase();
  const starts = new Set();

  for (const anchor of FACT_SECTION_ANCHORS) {
    let searchIndex = 0;
    const normalizedAnchor = anchor.toLowerCase();
    while (searchIndex < lower.length) {
      const foundAt = lower.indexOf(normalizedAnchor, searchIndex);
      if (foundAt === -1) break;
      starts.add(foundAt);
      searchIndex = foundAt + normalizedAnchor.length;
    }
  }

  const windows = [...starts]
    .sort((left, right) => left - right)
    .map((start) => text.slice(start, Math.min(text.length, start + 900)));

  windows.push(text);
  return windows;
}

function extractFactsBlockInline(content = "") {
  const windows = buildFactExtractionWindows(content);
  let best = {};

  for (const windowText of windows) {
    const parsed = extractFactsBlockInlineWindow(windowText);
    if (Object.keys(parsed).length > Object.keys(best).length) {
      best = parsed;
    }
    if (Object.keys(best).length >= 2 && windowText !== windows[windows.length - 1]) {
      return best;
    }
  }

  return Object.keys(best).length >= 2 ? best : {};
}

function extractFactsBlockFromContent(content = "") {
  const fromLines = extractFactsBlockFromLines(content);
  const fromInline = extractFactsBlockInline(content);
  return { ...fromInline, ...fromLines };
}

function parseJsonLdDocumentsForGt(blocks = []) {
  const documents = [];
  for (const block of blocks || []) {
    try {
      const parsed = JSON.parse(block);
      if (Array.isArray(parsed)) {
        documents.push(...parsed);
      } else if (Array.isArray(parsed?.["@graph"])) {
        documents.push(...parsed["@graph"]);
      } else {
        documents.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return documents.filter(Boolean);
}

const GT_ENTITY_JSONLD_TYPES = new Set([
  "Organization",
  "Corporation",
  "LocalBusiness",
  "ProfessionalService",
  "Service",
  "SoftwareApplication",
  "Product",
  "Person",
  "ProfilePage",
]);

function isEligibleGroundTruthDocument(document) {
  const rawType = document?.["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType].filter(Boolean);
  return types.some((type) => GT_ENTITY_JSONLD_TYPES.has(String(type)));
}

function extractFaqPairsFromContent(content = "") {
  const pairs = [];
  const lines = String(content || "").split(/\n+/);

  for (let i = 0; i < lines.length - 1; i++) {
    const qMatch = lines[i].match(/^\s*(?:q[.:]|q\s|- q[:.]|질문[:.]|문:)\s*(.+)/i);
    if (!qMatch) continue;
    const aMatch = lines[i + 1]?.match(/^\s*(?:a[.:]|a\s|- a[:.]|답변[:.]|답:)\s*(.+)/i);
    if (!aMatch) continue;
    pairs.push({ question: qMatch[1].trim(), answer: aMatch[1].trim() });
    i += 1;
  }

  return pairs;
}

function extractFaqPairsFromJsonLd(documents = []) {
  const pairs = [];
  for (const doc of documents) {
    const rawType = doc?.["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    if (!types.some((t) => String(t) === "FAQPage")) continue;
    const mainEntity = Array.isArray(doc?.mainEntity) ? doc.mainEntity : [doc?.mainEntity].filter(Boolean);
    for (const item of mainEntity) {
      const question = item?.name || "";
      const answer = item?.acceptedAnswer?.text || "";
      if (question && answer) pairs.push({ question, answer });
    }
  }
  return pairs;
}

export function resolveOfficialGroundTruth(crawlSnapshot = {}) {
  const jsonLdBlocks = Array.isArray(crawlSnapshot.jsonLdBlocks)
    ? crawlSnapshot.jsonLdBlocks
    : [];
  const documents = parseJsonLdDocumentsForGt(jsonLdBlocks);
  const entityDocuments = documents.filter(isEligibleGroundTruthDocument);
  const fields = extractFactsBlockFromContent(crawlSnapshot.content || crawlSnapshot.contentPreview || "");

  for (const document of entityDocuments) {
    if (!fields.entity_name && document?.name) {
      const rawName = String(document.name).trim();
      // Skip names that look like page titles (contain | or are very long)
      const looksLikeTitle = rawName.includes("|") || rawName.includes(" - ") || rawName.length > 60;
      if (!looksLikeTitle) {
        fields.entity_name = { value: rawName, source: "jsonld" };
      }
    }
    if (!fields.description && document?.description) {
      fields.description = { value: String(document.description).trim(), source: "jsonld" };
    }
    if (!fields.founded && document?.foundingDate) {
      fields.founded = { value: String(document.foundingDate).trim(), source: "jsonld" };
    }
    if (!fields.ceo_or_leader && document?.founder) {
      const founderVal = typeof document.founder === "string"
        ? document.founder.trim()
        : document.founder?.name ? String(document.founder.name).trim() : "";
      if (founderVal) fields.ceo_or_leader = { value: founderVal, source: "jsonld" };
    }
    if (!fields.entity_type && document?.serviceType) {
      fields.entity_type = { value: String(document.serviceType).trim(), source: "jsonld" };
    }
    if (!fields.headquarters && document?.address?.addressLocality) {
      fields.headquarters = { value: String(document.address.addressLocality).trim(), source: "jsonld" };
    }
    if (!fields.key_products && document?.knowsAbout) {
      const items = Array.isArray(document.knowsAbout) ? document.knowsAbout : [document.knowsAbout];
      const values = items.map((item) => String(typeof item === "object" ? item?.name || "" : item || "").trim()).filter(Boolean);
      if (values.length) {
        fields.key_products = { value: values, source: "jsonld" };
      }
    }
  }

  // Collect alternateName(s) from JSON-LD for bilingual matching
  const alternateNames = [];
  for (const document of entityDocuments) {
    if (document?.alternateName) {
      const altNames = Array.isArray(document.alternateName)
        ? document.alternateName : [document.alternateName];
      for (const n of altNames) {
        const trimmed = String(n || "").trim();
        if (trimmed) alternateNames.push(trimmed);
      }
    }
  }

  const filtered = {};
  for (const field of GROUND_TRUTH_FIELDS) {
    const entry = fields[field];
    if (!entry) continue;
    const hasValue = GT_ARRAY_FIELDS.has(field)
      ? Array.isArray(entry.value) && entry.value.length > 0
      : Boolean(String(entry.value || "").trim());
    if (!hasValue) continue;
    filtered[field] = entry;
  }

  const contentFaqPairs = extractFaqPairsFromContent(crawlSnapshot.content || crawlSnapshot.contentPreview || "");
  const jsonLdFaqPairs = extractFaqPairsFromJsonLd(documents);
  const faqPairs = [...jsonLdFaqPairs, ...contentFaqPairs];

  return {
    declaredFields: Object.entries(filtered).map(([field, entry]) => ({
      field,
      value: entry.value,
      source: entry.source,
    })),
    fieldMap: filtered,
    fieldCount: Object.keys(filtered).length,
    fieldNames: Object.keys(filtered),
    alternateNames,
    faqPairs,
  };
}

export function hydrateOfficialGroundTruth(serializedGroundTruth = {}, crawlSnapshot = {}) {
  const declaredFields = Array.isArray(serializedGroundTruth?.declaredFields)
    ? serializedGroundTruth.declaredFields.filter((entry) => entry?.field)
    : [];

  if (!declaredFields.length) {
    return resolveOfficialGroundTruth(crawlSnapshot);
  }

  const fieldMap = {};
  for (const entry of declaredFields) {
    fieldMap[entry.field] = {
      value: entry.value,
      source: entry.source || "unknown",
    };
  }

  const faqPairs = Array.isArray(serializedGroundTruth?.faqPairs)
    ? serializedGroundTruth.faqPairs.filter((pair) => pair?.question && pair?.answer)
    : [];

  const alternateNames = Array.isArray(serializedGroundTruth?.alternateNames)
    ? serializedGroundTruth.alternateNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];

  return {
    declaredFields,
    fieldMap,
    fieldCount: declaredFields.length,
    fieldNames: declaredFields.map((entry) => entry.field),
    alternateNames,
    faqPairs,
  };
}

// ---------------------------------------------------------------------------
// Field Comparison Helpers
// ---------------------------------------------------------------------------

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\[\](),.:;'"`"]/g, " ")
    // 한국어 숫자 접미사 분리: 2026년 → 2026, 150명 → 150, 5억 → 5
    .replace(/(\d+)\s*[년월일명개원억만천백]+/g, "$1")
    // 한국어 조사 제거 (은/는/이/가/을/를/의/에/로/와/과/도/서)
    .replace(/([\uac00-\ud7a3])(은|는|이|가|을|를|의|에|로|와|과|도|서)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeComparableText(value) {
  return normalizeComparableText(value)
    .split(/[^0-9a-zA-Z가-힣]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function overlapRatio(left, right) {
  const leftSet = new Set(tokenizeComparableText(left));
  const rightSet = new Set(tokenizeComparableText(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftSet.size, rightSet.size);
}

function extractYearSet(value) {
  return new Set(String(value || "").match(/\b(18|19|20)\d{2}\b/g) || []);
}

function valuesContainEachOther(left, right) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function compareScalarFieldGt(field, groundTruthValue, extractedValue) {
  if (!groundTruthValue || !extractedValue) return false;

  if (field === "founded") {
    const left = extractYearSet(groundTruthValue);
    const right = extractYearSet(extractedValue);
    return [...left].some((year) => right.has(year));
  }

  if (field === "description" || field === "unique_value") {
    return overlapRatio(groundTruthValue, extractedValue) >= 0.35 || valuesContainEachOther(groundTruthValue, extractedValue);
  }

  if (field === "entity_type" || field === "headquarters") {
    return overlapRatio(groundTruthValue, extractedValue) >= 0.4 || valuesContainEachOther(groundTruthValue, extractedValue);
  }

  if (field === "employee_count" || field === "revenue") {
    const leftYears = extractYearSet(groundTruthValue);
    const rightYears = extractYearSet(extractedValue);
    if (leftYears.size && rightYears.size && [...leftYears].some((year) => rightYears.has(year))) return true;
    return valuesContainEachOther(groundTruthValue, extractedValue);
  }

  return valuesContainEachOther(groundTruthValue, extractedValue) || overlapRatio(groundTruthValue, extractedValue) >= 0.5;
}

// ---------------------------------------------------------------------------
// Inferred Cause + Suggested Fix per field
// ---------------------------------------------------------------------------

function inferMissedFieldCause(_field, source, observedEvidence = {}) {
  // Evidence-based cause classification with confidence levels
  // confidence: "high" = direct crawl evidence, "medium" = inferred from signals, "low" = source-based guess

  if (observedEvidence.robotsBlocked) {
    return {
      inferredCause: "robots.txt 또는 메타 태그로 AI 크롤러 접근이 차단됨",
      suggestedFix: "robots.txt에서 AI 크롤러(GPTBot, Google-Extended 등)를 허용하세요.",
      observedSignal: "robots_blocked",
      confidence: "high",
    };
  }

  if (observedEvidence.noStaticHtml) {
    return {
      inferredCause: "정적 HTML에서 콘텐츠를 수집할 수 없음",
      suggestedFix: "핵심 정보는 JS 없이 서버사이드/정적 HTML로 노출하세요.",
      observedSignal: "no_static_html",
      confidence: "high",
    };
  }

  if (observedEvidence.jsRendered) {
    return {
      inferredCause: "JS 렌더링 후에만 콘텐츠가 나타남 (추정)",
      suggestedFix: "핵심 정보는 JS 없이 서버사이드/정적 HTML로 노출하세요.",
      observedSignal: "js_rendering_only",
      confidence: "medium",
    };
  }

  if (observedEvidence.lowWordCount) {
    return {
      inferredCause: "페이지 콘텐츠 절대량이 부족하여 AI가 필드를 추출하지 못함",
      suggestedFix: "핵심 사실을 facts block과 첫 문단에 직접 기술하세요.",
      observedSignal: "content_sparse",
      confidence: "medium",
    };
  }

  if (source === "jsonld") {
    const bothSources = observedEvidence.hasFactsBlock;
    return {
      inferredCause: bothSources
        ? "JSON-LD + facts block 양쪽에 선언되었으나 AI 엔진이 읽지 못함"
        : "JSON-LD에만 선언됨 — 평문에서 해당 사실이 노출되지 않음",
      suggestedFix: bothSources
        ? "첫 문장에 핵심 사실을 직접 포함하세요."
        : "평문 facts block에도 동일 사실을 중복 선언하세요.",
      observedSignal: bothSources ? "dual_source_missed" : "jsonld_only",
      confidence: "low",
    };
  }

  if (source === "official_facts_block") {
    return {
      inferredCause: "facts block에 있으나 JSON-LD에는 없음 (추정)",
      suggestedFix: "JSON-LD에도 같은 필드를 추가하세요.",
      observedSignal: "facts_block_only",
      confidence: "low",
    };
  }

  return {
    inferredCause: null,
    suggestedFix: "해당 사실을 JSON-LD + facts block + 첫 문단 3곳에 중복 선언하세요.",
    observedSignal: "unknown",
    confidence: "low",
  };
}

// ---------------------------------------------------------------------------
// Stage 2: evaluateFieldDelivery
// ---------------------------------------------------------------------------

const FIELD_NEGATIVE_PATTERNS = {
  entity_name: ["entity name", "company name", "회사명"],
  entity_type: ["entity type", "industry", "업종", "산업"],
  founded: ["founded", "founding date", "설립", "설립연도"],
  headquarters: ["headquarters", "address", "본사", "주소"],
  key_products: ["key products", "products", "services", "주요 제품", "주요 서비스"],
  description: ["description", "summary", "설명", "소개"],
  ceo_or_leader: ["ceo", "leader", "founder", "대표", "대표자", "대표이사"],
};

function hasNegativeContext(responseText, field) {
  const text = String(responseText || "");
  const lowerText = text.toLowerCase();
  const fieldPatterns = [
    ...(FIELD_NEGATIVE_PATTERNS[field] || []),
    field.replace(/_/g, " "),
    field,
  ].filter(Boolean);

  const lines = text.split(/\r?\n/);

  function lineHasNegative(idx) {
    if (idx < 0 || idx >= lines.length) return false;
    return /찾지\s*못|확인할?\s*수\s*없|not\s*found|없음|n\/a/i.test(lines[idx]);
  }

  function lineLooksLikeAnotherField(line) {
    return /\*\*[^*]+\*\*\s*:|[-*]\s*\*\*[^*]+\*\*\s*:|^[a-z_ ]+\s*:|^[가-힣A-Za-z ]+\s*:/.test(line.trim());
  }

  for (const pattern of fieldPatterns) {
    // Prefer line-scoped checks so a later "찾지 못함" on another field
    // does not invalidate a positive match on the current field.
    const patternLower = pattern.toLowerCase();
    let matchedOnLines = false;
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].toLowerCase().includes(patternLower)) continue;
      matchedOnLines = true;
      if (lineHasNegative(i)) return true;

      const nextLine = lines[i + 1] || "";
      if (
        nextLine.trim() &&
        !lineLooksLikeAnotherField(nextLine) &&
        lineHasNegative(i + 1)
      ) {
        return true;
      }
    }

    if (matchedOnLines) {
      continue;
    }

    // Fallback for single-line/minified responses without line structure.
    let searchIdx = 0;
    while (searchIdx < lowerText.length) {
      const idx = lowerText.indexOf(patternLower, searchIdx);
      if (idx === -1) break;
      const section = lowerText.slice(Math.max(0, idx - 20), idx + 80);
      if (/찾지\s*못|확인할?\s*수\s*없|not\s*found|없음|n\/a/i.test(section)) {
        return true;
      }
      searchIdx = idx + patternLower.length;
    }
  }

  return false;
}

export function evaluateFieldDelivery(responseText = "", groundTruth = {}, observedEvidence = {}) {
  const fieldMap = groundTruth.fieldMap || {};
  const fieldNames = Object.keys(fieldMap);
  const text = normalizeComparableText(responseText);
  const deliveredFields = [];
  const missedFields = [];

  for (const field of fieldNames) {
    const entry = fieldMap[field];
    const truthValue = entry.value;
    const negativeContext = hasNegativeContext(responseText, field);

    let delivered = false;

    if (negativeContext) {
      delivered = false;
    } else if (GT_ARRAY_FIELDS.has(field)) {
      const items = Array.isArray(truthValue) ? truthValue : [];
      for (const item of items) {
        if (normalizeComparableText(item) && text.includes(normalizeComparableText(item))) {
          delivered = true;
          break;
        }
        if (overlapRatio(item, responseText) >= 0.4) {
          delivered = true;
          break;
        }
      }
    } else {
      const normalizedTruth = normalizeComparableText(truthValue);
      if (normalizedTruth && text.includes(normalizedTruth)) {
        delivered = true;
      } else {
        delivered = compareScalarFieldGt(field, truthValue, responseText);
      }
      // Bilingual fallback: check alternateNames for entity_name/ceo_or_leader
      if (!delivered && (field === "entity_name" || field === "ceo_or_leader")) {
        for (const altName of groundTruth.alternateNames || []) {
          const altNorm = normalizeComparableText(altName);
          if (altNorm && text.includes(altNorm)) {
            delivered = true;
            break;
          }
        }
      }
    }

    // Override: if response explicitly says "찾지 못함" near the field label, reject the match
    if (delivered && negativeContext) {
      delivered = false;
    }

    if (delivered) {
      deliveredFields.push({
        field,
        value: truthValue,
        source: entry.source,
      });
    } else {
      const causeMeta = inferMissedFieldCause(field, entry.source, observedEvidence);
      missedFields.push({
        field,
        declaredValue: truthValue,
        source: entry.source,
        inferredCause: causeMeta.inferredCause,
        suggestedFix: causeMeta.suggestedFix,
        observedSignal: causeMeta.observedSignal || null,
        confidence: causeMeta.confidence || "low",
      });
    }
  }

  const faqDelivered = [];
  const faqMissed = [];

  for (const pair of groundTruth.faqPairs || []) {
    const answerNorm = normalizeComparableText(pair.answer);
    if (answerNorm && overlapRatio(pair.answer, responseText) >= 0.3) {
      faqDelivered.push(pair);
    } else {
      faqMissed.push(pair);
    }
  }

  const totalFields = fieldNames.length;
  const deliveredCount = deliveredFields.length;

  return {
    deliveredFields,
    missedFields,
    deliveryRate: totalFields ? Number((deliveredCount / totalFields).toFixed(3)) : null,
    totalDeclaredFields: totalFields,
    faqDelivered,
    faqMissed,
  };
}

// ---------------------------------------------------------------------------
// URL-based Page Delivery Verification (v5 Stage 2)
// ---------------------------------------------------------------------------

function buildUrlVerificationPrompt(url, groundTruth) {
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
    `각 항목에 대해:`,
    `1. 페이지에서 해당 정보를 찾았으면 찾은 값을 그대로 적어줘.`,
    `2. 페이지에서 찾지 못했으면 "찾지 못함"이라고 적어줘.`,
    `3. 페이지 자체에 접근할 수 없었으면 그 이유를 적어줘.`,
    ``,
    `반드시 해당 URL의 페이지 내용만 기준으로 답해줘. 다른 출처의 정보를 섞지 마.`,
  ].join("\n");
}

function buildSubpageVerificationPrompt(urls) {
  return [
    `다음 URL들을 각각 직접 방문해서 접근 가능한지 확인해줘.`,
    ``,
    ...urls.map((url, i) => `${i + 1}. ${url}`),
    ``,
    `각 URL에 대해 아래 형식으로 정확히 답변해줘:`,
    ``,
    `[URL] → 결과: 접근성공 / 접근실패`,
    `제목: (페이지 제목)`,
    `요약: (한 줄 요약)`,
    `실패사유: (접근실패인 경우만 — 차단, 404, 타임아웃 등)`,
    ``,
    `반드시 각 URL을 실제로 읽어보고, 추측하지 마.`,
  ].join("\n");
}

function normalizeSubpageUrlForComparison(url) {
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

async function askEngineWithUrl(engine, prompt, config) {
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
      const parts = data.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";
      return { text, citations: [], status: text ? "success" : "error", latencyMs: Date.now() - startedAt };
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

export async function verifyUrlDelivery(url, groundTruth, subpageUrls = [], config = {}, crawlSignals = {}) {
  const resolvedConfig = { ...resolveAiCheckConfig(), ...config };
  const prompt = buildUrlVerificationPrompt(url, groundTruth);
  const engineIds = ["chatgpt", "gemini", "perplexity"];
  const normalizedSubpageUrls = [...new Map(
    subpageUrls
      .map((subUrl) => [normalizeSubpageUrlForComparison(subUrl), normalizeSubpageUrlForComparison(subUrl)])
      .filter(([canonicalUrl]) => canonicalUrl),
  ).values()];

  // Build observed evidence from crawl signals for cause classification
  const observedEvidence = {
    robotsBlocked: crawlSignals.robotsDenied === true,
    jsRendered: crawlSignals.jsRendered === true
      || (crawlSignals.directSourceCount === 0 && crawlSignals.jinaSourceCount > 0),
    noStaticHtml: crawlSignals.directSourceCount === 0 && crawlSignals.jinaSourceCount === 0,
    lowWordCount: (crawlSignals.wordCount || 0) < 100,
    hasFactsBlock: (crawlSignals.factLabelCount || 0) >= 2,
    noFirstParagraphEntity: crawlSignals.entityDefinitionOk === false,
  };

  const results = await Promise.allSettled(
    engineIds.map((engineId) => askEngineWithUrl(engineId, prompt, resolvedConfig))
  );

  const engines = {};
  for (let i = 0; i < engineIds.length; i++) {
    const engineId = engineIds[i];
    const result = results[i];
    if (result.status !== "fulfilled" || result.value.status !== "success") {
      engines[engineId] = {
        status: result.status === "fulfilled" ? result.value.status : "error",
        error: result.status === "fulfilled" ? result.value.error : result.reason?.message,
        latencyMs: result.status === "fulfilled" ? result.value.latencyMs : null,
        deliveredFields: [],
        missedFields: [],
        deliveryRate: null,
        totalDeclaredFields: groundTruth.fieldCount || 0,
        subpageResults: [],
      };
      continue;
    }

    const raw = result.value;
    const delivery = evaluateFieldDelivery(raw.text, groundTruth, observedEvidence);
    // Citation verification: exact URL match > path match > host-only match
    const targetParsed = (() => { try { return new URL(url); } catch { return null; } })();
    const targetHost = targetParsed?.hostname.replace(/^www\./, "") || "";
    const targetPath = targetParsed?.pathname.replace(/\/+$/, "") || "";
    let citedOfficialUrl = false;
    let citationMatchLevel = "none"; // "exact" | "path" | "host_only" | "none"

    for (const c of raw.citations || []) {
      try {
        const cited = new URL(c);
        const cHost = cited.hostname.replace(/^www\./, "");
        const cPath = cited.pathname.replace(/\/+$/, "");
        if (cHost !== targetHost) continue;
        if (cPath === targetPath) {
          citationMatchLevel = "exact";
          citedOfficialUrl = true;
          break;
        }
        if (citationMatchLevel !== "exact") {
          citationMatchLevel = cHost === targetHost && cPath !== targetPath ? "host_only" : citationMatchLevel;
          if (cPath.startsWith(targetPath) || targetPath.startsWith(cPath)) {
            citationMatchLevel = "path";
          }
          citedOfficialUrl = true;
        }
      } catch { /* skip invalid URLs */ }
    }

    engines[engineId] = {
      status: "success",
      latencyMs: raw.latencyMs,
      responsePreview: raw.text.slice(0, 500),
      citedOfficialUrl,
      citationMatchLevel,
      citations: raw.citations || [],
      ...delivery,
      subpageResults: [],
    };
  }

  // Subpage verification (if URLs provided)
  if (normalizedSubpageUrls.length > 0) {
    const subPrompt = buildSubpageVerificationPrompt(normalizedSubpageUrls);
    const subResults = await Promise.allSettled(
      engineIds.map((engineId) => askEngineWithUrl(engineId, subPrompt, resolvedConfig))
    );

    for (let i = 0; i < engineIds.length; i++) {
      const engineId = engineIds[i];
      if (!engines[engineId] || engines[engineId].status !== "success") continue;
      const subResult = subResults[i];
      if (subResult.status !== "fulfilled" || subResult.value.status !== "success") continue;

      const subText = subResult.value.text;
      const subCitations = subResult.value.citations || [];
      const mainCitations = engines[engineId].citations || [];
      const allCitations = [...subCitations, ...mainCitations];
      engines[engineId].subpageResults = normalizedSubpageUrls.map((subUrl) => {
        const pathname = (() => { try { return new URL(subUrl).pathname; } catch { return subUrl; } })();
        const urlLower = subUrl.toLowerCase();
        const pathLower = pathname.toLowerCase();
        const textLower = subText.toLowerCase();

        // Find the section of the response that discusses this specific URL
        const urlSectionIdx = textLower.indexOf(urlLower) !== -1
          ? textLower.indexOf(urlLower)
          : textLower.indexOf(pathLower);
        // Extract ~400 chars after the URL mention as the relevant section
        const sectionText = urlSectionIdx !== -1
          ? textLower.slice(urlSectionIdx, urlSectionIdx + 400)
          : "";

        // Strong evidence: structured "접근성공" keyword near this URL
        const hasSuccessKeyword = sectionText.includes("접근성공")
          || sectionText.includes("접근 성공")
          || (sectionText.includes("제목:") && !sectionText.includes("접근실패"));
        // Strong evidence: this exact URL or path appears in engine citations (sub + main)
        const citedDirectly = allCitations.some((c) => {
          try {
            const parsed = new URL(c);
            return parsed.pathname.replace(/\/+$/, "") === pathname.replace(/\/+$/, "")
              && parsed.hostname.replace(/^www\./, "") === new URL(subUrl).hostname.replace(/^www\./, "");
          } catch { return c.toLowerCase().includes(pathLower); }
        });

        const hasFailKeyword = sectionText.includes("접근실패") || sectionText.includes("접근 실패");
        const blocked = hasFailKeyword && /차단|block|403|robot|disallow/i.test(sectionText);
        const notFound = hasFailKeyword && /404|not found|찾을 수 없/i.test(sectionText);

        // Content-based evidence: URL mentioned + content summary present (but no structured keyword)
        const hasSummaryContent = sectionText.length > 30
          && !hasSuccessKeyword && !hasFailKeyword
          && (sectionText.includes("요약:") || sectionText.includes("내용:") || sectionText.length > 100);

        // Three-state reached: true | false | "uncertain"
        let reached;
        let evidence;
        if (citedDirectly) {
          reached = true;
          evidence = "citation_match";
        } else if (hasSuccessKeyword) {
          reached = true;
          evidence = "structured_response";
        } else if (hasFailKeyword) {
          reached = false;
          evidence = "structured_fail";
        } else if (hasSummaryContent) {
          reached = "uncertain";
          evidence = "content_summary";
        } else {
          reached = false;
          evidence = "not_mentioned";
        }

        return {
          url: subUrl,
          reached,
          evidence,
          inferredCause: blocked ? "robots.txt 또는 접근 차단"
            : notFound ? "페이지 없음 (404)"
            : reached === false ? "엔진이 도달하지 못함"
            : reached === "uncertain" ? "응답에 언급되었으나 접근 여부 불확실"
            : null,
          suggestedFix: blocked ? "크롤 허용 또는 AI 프로필에 요약 포함"
            : notFound ? "페이지를 생성하거나 AI 프로필에 내용 통합"
            : reached === false ? "서브페이지 링크를 메인 페이지 + JSON-LD hasPart로 노출"
            : null,
        };
      });
    }
  }

  // Debug log dump (AAO_DEBUG_LOG=1)
  if (process.env.AAO_DEBUG_LOG === "1") {
    try {
      const logDir = "/tmp/aao-delivery-logs";
      await mkdir(logDir, { recursive: true });
      const hostname = (() => { try { return new URL(url).hostname; } catch { return "unknown"; } })();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const logData = {
        url,
        timestamp: new Date().toISOString(),
        groundTruth: {
          declaredFields: groundTruth.declaredFields,
          faqPairs: groundTruth.faqPairs,
          fieldCount: groundTruth.fieldCount,
        },
        crawlSignals,
        observedEvidence,
        engines: Object.fromEntries(
          Object.entries(engines).map(([id, eng]) => [id, {
            status: eng.status,
            latencyMs: eng.latencyMs,
            citedOfficialUrl: eng.citedOfficialUrl,
            citationMatchLevel: eng.citationMatchLevel,
            citations: eng.citations,
            deliveredFields: eng.deliveredFields,
            missedFields: eng.missedFields,
            deliveryRate: eng.deliveryRate,
            subpageResults: eng.subpageResults,
            responsePreview: eng.responsePreview,
          }])
        ),
      };
      await writeFile(`${logDir}/${ts}-${hostname}.json`, JSON.stringify(logData, null, 2));
      console.log(`[AAO] Debug log saved: ${logDir}/${ts}-${hostname}.json`);
    } catch (e) {
      console.warn(`[AAO] Debug log failed:`, e.message);
    }
  }

  return { url, engines };
}
