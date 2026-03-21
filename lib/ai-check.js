// lib/ai-check.js — Intent-aware AI checks with cost guard + cache (facade)
// Sub-modules: ai-check-entity.js, ai-check-cache.js, ai-check-api.js, ai-check-classify.js
import { writeFile, mkdir } from "node:fs/promises";

// Re-export entity module
export {
  sanitizePromptInput,
  normalizeEntityInput,
  normalizeCrawlSnapshot,
  extractStrongEntityHints,
  extractServiceHints,
  inferCategoryHint,
  getEntityAnchorTerms,
  getServiceDefinitionHints,
  extractYears,
  extractEmails,
  extractPhraseHints,
  buildCrawlVerificationSnapshot,
  computeCrawlVerificationSignals,
  extractHostnamesFromText,
  hostMatchesOfficialDomain,
  getOfficialDomain,
  getHostname,
  isVertexGroundingUrl,
  extractHostnameCandidate,
  toCanonicalCitationUrl,
  hostnameMatchesAny,
  parseString,
  parseBoolean,
  parsePositiveInt,
  uniqueStrings,
  hashString,
  GROUND_TRUTH_FIELDS,
  GT_ARRAY_FIELDS,
  FACT_LABEL_MAP,
  FACT_ALIAS_TO_FIELD,
  FACT_LABEL_ALTERNATION,
  FACT_SECTION_ANCHORS,
  FACT_SCALAR_MAX_LENGTH,
  GT_ENTITY_JSONLD_TYPES,
  escapeFactRegExp,
  resolveFactField,
  normalizeFactValue,
  mergeFieldSource,
  extractFactsBlockFromLines,
  extractFactsBlockInlineWindow,
  buildFactExtractionWindows,
  extractFactsBlockInline,
  extractFactsBlockFromContent,
  parseJsonLdDocumentsForGt,
  isEligibleGroundTruthDocument,
  extractFaqPairsFromContent,
  extractFaqPairsFromJsonLd,
  resolveOfficialGroundTruth,
  hydrateOfficialGroundTruth,
  normalizeComparableText,
  tokenizeComparableText,
  overlapRatio,
  extractYearSet,
  valuesContainEachOther,
  compareScalarFieldGt,
  inferMissedFieldCause,
  hasNegativeContext,
  evaluateFieldDelivery,
} from "./ai-check-entity.js";

// Re-export cache module
export {
  AI_CHECK_CACHE_VERSION,
  aiCheckCache,
  buildCacheKey,
  cloneCachedResult,
  getCachedResult,
  pruneAiCheckCache,
  setCachedResult,
} from "./ai-check-cache.js";

// Re-export API module
export {
  AI_CHECK_MODES,
  AI_CHECK_INTENTS,
  DEFAULT_INTENTS,
  ENGINE_ORDER,
  MODE_META,
  SUPPORTED_MODE_BY_ENGINE,
  SEARCH_QUERY_NOISE,
  getModeMeta,
  getIntentMeta,
  pickTemplate,
  createQuerySlot,
  buildQueryPlan,
  renderQueryPlanPrompt,
  buildPromptTemplates,
  buildCompanyPrompt,
  extractOpenAiResponsesOutputText,
  extractTokenUsage,
  normalizeSearchQuery,
  sanitizePreview,
  collectSearchQueries,
  collectPayloadDiagnostics,
  summarizeObjectKeys,
  collectExplicitQueryValues,
  extractKnownQueryFields,
  extractChatGptSearchQueries,
  countChatGptSearchToolCalls,
  extractPerplexitySearchQueries,
  getPerplexitySearchResultCount,
  getGeminiGroundingMetadataNode,
  getGeminiGroundingChunks,
  getGeminiGroundingSupports,
  extractGeminiSearchQueries,
  extractGeminiCitations,
  getGeminiGroundingChunkCount,
  getGeminiGroundingSupportCount,
  buildPayloadDiagnostics,
  maybeLogPayloadDiagnostics,
  buildGroundingMetadata,
  createBaseResponse,
  createUnsupportedResponse,
  createSkippedResponse,
  askChatGPT,
  askGemini,
  askPerplexity,
  buildUrlVerificationPrompt,
  buildSubpageVerificationPrompt,
  normalizeSubpageUrlForComparison,
  askEngineWithUrl,
} from "./ai-check-api.js";

// Re-export classify module
export {
  splitFactCheckSentences,
  countSentencesContainingAny,
  hasComparisonCue,
  buildRecognitionContext,
  buildFactCheck,
  classifyRecognition,
  shouldRunAiRecognitionFallback,
  buildAiRecognitionFallbackPrompt,
  parseAiRecognitionFallbackOutput,
  applyAiRecognitionFallback,
  computeMentionPosition,
  roundMetric,
  isOfficialCitation,
  inferSourceArchetype,
  getSourceFitMetaFromProfile,
  classifyCitationSource,
  computeCitationDetails,
  computeCitationMetricsFromDetails,
  computeCitationMetrics,
  computeSourceProfile,
  computeSourceMix,
  computeQueryPlanCoverage,
  analyzeResponse,
  summarizeAiResults,
  __testEvaluateAiCheckResponse,
  __testEvaluateSourceProfile,
} from "./ai-check-classify.js";

// ---------------------------------------------------------------------------
// Imports for orchestration (internal use)
// ---------------------------------------------------------------------------

import { parseBoolean, parsePositiveInt, parseString } from "./ai-check-entity.js";
import { evaluateFieldDelivery } from "./ai-check-entity.js";
import { getCachedResult, setCachedResult } from "./ai-check-cache.js";
import {
  AI_CHECK_MODES,
  AI_CHECK_INTENTS,
  ENGINE_ORDER,
  MODE_META,
  SUPPORTED_MODE_BY_ENGINE,
  getModeMeta,
  getIntentMeta,
  createBaseResponse,
  createUnsupportedResponse,
  createSkippedResponse,
  askChatGPT,
  askGemini,
  askPerplexity,
  askEngineWithUrl,
  buildUrlVerificationPrompt,
  buildSubpageVerificationPrompt,
  normalizeSubpageUrlForComparison,
} from "./ai-check-api.js";
import {
  analyzeResponse,
  applyAiRecognitionFallback,
  summarizeAiResults,
} from "./ai-check-classify.js";

// ---------------------------------------------------------------------------
// Orchestration constants
// ---------------------------------------------------------------------------

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_TASKS = 7;
const DEFAULT_CACHE_MAX_ENTRIES = 200;
const DEFAULT_INTENTS = ["awareness", "comparison", "purchase"];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function parseIntentList(value) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_INTENTS;

  const intents = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => AI_CHECK_INTENTS[item]);

  return intents.length > 0 ? Array.from(new Set(intents)) : DEFAULT_INTENTS;
}

export function resolveAiCheckConfig() {
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

// ---------------------------------------------------------------------------
// Task priority + definitions
// ---------------------------------------------------------------------------

export function getTaskPriority(engine, mode, intent) {
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

export function buildTaskDefinitions(entityInput, config) {
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

export function createEmptyBudget(config) {
  return {
    maxTasks: config.maxTasks,
    candidates: 0,
    executed: 0,
    cached: 0,
    skipped: 0,
    unsupported: 0,
  };
}

export function groupResultsByMode(results, config, budgets) {
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

// ---------------------------------------------------------------------------
// checkAllEngines
// ---------------------------------------------------------------------------

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
// verifyUrlDelivery
// ---------------------------------------------------------------------------

export async function verifyUrlDelivery(url, groundTruth, subpageUrls = [], config = {}, crawlSignals = {}) {
  const resolvedConfig = { ...resolveAiCheckConfig(), ...config };
  const prompt = buildUrlVerificationPrompt(url, groundTruth);
  const engineIds = ["chatgpt", "gemini", "perplexity"];
  const normalizedSubpageUrls = [...new Map(
    subpageUrls
      .map((subUrl) => [normalizeSubpageUrlForComparison(subUrl), normalizeSubpageUrlForComparison(subUrl)])
      .filter(([canonicalUrl]) => canonicalUrl),
  ).values()];

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
    const targetParsed = (() => { try { return new URL(url); } catch { return null; } })();
    const targetHost = targetParsed?.hostname.replace(/^www\./, "") || "";
    const targetPath = targetParsed?.pathname.replace(/\/+$/, "") || "";
    let citedOfficialUrl = false;
    let citationMatchLevel = "none";

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

        const urlSectionIdx = textLower.indexOf(urlLower) !== -1
          ? textLower.indexOf(urlLower)
          : textLower.indexOf(pathLower);
        const sectionText = urlSectionIdx !== -1
          ? textLower.slice(urlSectionIdx, urlSectionIdx + 400)
          : "";

        const hasSuccessKeyword = sectionText.includes("접근성공")
          || sectionText.includes("접근 성공")
          || (sectionText.includes("제목:") && !sectionText.includes("접근실패"));
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

        const hasSummaryContent = sectionText.length > 30
          && !hasSuccessKeyword && !hasFailKeyword
          && (sectionText.includes("요약:") || sectionText.includes("내용:") || sectionText.length > 100);

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
            error: eng.error || null,
            reason: eng.reason || null,
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
