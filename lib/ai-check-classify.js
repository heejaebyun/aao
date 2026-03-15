// lib/ai-check-classify.js — Recognition, Citation, Source profiling
// Extracted from ai-check.js — no business logic changes

import {
  normalizeEntityInput,
  extractStrongEntityHints,
  extractServiceHints,
  getEntityAnchorTerms,
  getServiceDefinitionHints,
  getOfficialDomain,
  getHostname,
  isVertexGroundingUrl,
  extractHostnameCandidate,
  toCanonicalCitationUrl,
  hostnameMatchesAny,
  extractHostnamesFromText,
  hostMatchesOfficialDomain,
  uniqueStrings,
  hashString,
  sanitizePromptInput,
  computeCrawlVerificationSignals,
} from "./ai-check-entity.js";

import {
  AI_CHECK_MODES,
  AI_CHECK_INTENTS,
  getModeMeta,
  getIntentMeta,
  extractOpenAiResponsesOutputText,
  sanitizePreview,
} from "./ai-check-api.js";

// ---------------------------------------------------------------------------
// Recognition fallback constants
// ---------------------------------------------------------------------------

const AI_RECOGNITION_FALLBACK_MIN_CONFIDENCE = 0.55;

// ---------------------------------------------------------------------------
// Fact check sentence helpers
// ---------------------------------------------------------------------------

export function splitFactCheckSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?。]|다\.|요\.)\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export function countSentencesContainingAny(sentences, terms) {
  const normalizedTerms = uniqueStrings(terms)
    .map((term) => String(term || "").toLowerCase().trim())
    .filter((term) => term.length >= 2);
  if (normalizedTerms.length === 0) return 0;

  return sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return normalizedTerms.some((term) => lower.includes(term));
  }).length;
}

export function hasComparisonCue(text) {
  return /(비교|경쟁|대안|차이|대비|vs\b|versus|alternative|alternatives|competitor|competitors|compare|comparison)/i.test(
    String(text || "")
  );
}

// ---------------------------------------------------------------------------
// Recognition context
// ---------------------------------------------------------------------------

export function buildRecognitionContext(responseText, entityInput) {
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

// ---------------------------------------------------------------------------
// Fact check
// ---------------------------------------------------------------------------

export function buildFactCheck(response, entityInput, recognitionContext, citationMetrics) {
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

// ---------------------------------------------------------------------------
// Recognition classification
// ---------------------------------------------------------------------------

export function classifyRecognition(responseText, entityInput, factCheck = null, recognitionContext = null) {
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

// ---------------------------------------------------------------------------
// AI Recognition fallback
// ---------------------------------------------------------------------------

export function shouldRunAiRecognitionFallback(result, config) {
  if (!config?.enableAiRecognitionFallback) return false;
  if (!process.env.OPENAI_API_KEY) return false;
  if (!result || result.status !== "success") return false;
  if (!result.response || typeof result.response !== "string") return false;
  if (result.recognitionSource === "ai_fallback") return false;
  if (result.matchStatus === "unknown") return true;
  if (result.factCheck?.verdict === "weak") return true;
  if (result.matchStatus === "recognized" && result.recognitionContext?.looksHedged) return true;
  return false;
}

export function buildAiRecognitionFallbackPrompt(result, entityInput) {
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

export function parseAiRecognitionFallbackOutput(rawText) {
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

export async function applyAiRecognitionFallback(result, entityInput, config) {
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

// ---------------------------------------------------------------------------
// Mention position
// ---------------------------------------------------------------------------

export function computeMentionPosition(responseText, entityInput) {
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

// ---------------------------------------------------------------------------
// Round metric
// ---------------------------------------------------------------------------

export function roundMetric(value, digits = 4) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

// ---------------------------------------------------------------------------
// Citation classification
// ---------------------------------------------------------------------------

export function isOfficialCitation(url, entityInput) {
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

export function inferSourceArchetype(entityInput) {
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

export function getSourceFitMetaFromProfile(profile) {
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

export function classifyCitationSource(url, entityInput) {
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

// ---------------------------------------------------------------------------
// Citation metrics + source profile
// ---------------------------------------------------------------------------

export function computeCitationDetails(citations, entityInput) {
  return uniqueStrings(citations).map((citation) => classifyCitationSource(citation, entityInput));
}

export function computeCitationMetricsFromDetails(citationDetails) {
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

export function computeCitationMetrics(citations, entityInput) {
  return computeCitationMetricsFromDetails(computeCitationDetails(citations, entityInput));
}

export function computeSourceProfile(citationDetails, entityInput = null) {
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

export function computeSourceMix(citationMetrics) {
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

export function computeQueryPlanCoverage(result) {
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

// ---------------------------------------------------------------------------
// analyzeResponse
// ---------------------------------------------------------------------------

export function analyzeResponse(response, entityInput) {
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
    if (factCheck?.verdict === "aligned") accuracy += 25;
    if (factCheck?.serviceDefinitionMatch === true) accuracy += 20;
    if (factCheck?.officialDomainSignal) accuracy += 15;
    if (factCheck?.hasOfficialCitation) accuracy += 5;
    if (factCheck?.anchoredEntitySignal) accuracy += 5;

    if (response.mode === AI_CHECK_MODES.LIVE_SEARCH && (response.citations || []).length > 0) {
      accuracy += 5;
    }

    if (crawlVerification.matchedYears.length > 0) accuracy += 10;
    if (crawlVerification.matchedEmails.length > 0) accuracy += 8;
    if (crawlVerification.matchedHostnames.length > 0) accuracy += 6;
    if (crawlVerification.matchedPhraseHints.length >= 2) accuracy += 10;
    else if (crawlVerification.matchedPhraseHints.length === 1) accuracy += 5;
    if (crawlVerification.matchedServiceHints.length >= 2) accuracy += 8;
    else if (crawlVerification.matchedServiceHints.length === 1) accuracy += 4;

    if (text.length > 1000) accuracy += 5;
    else if (text.length > 300) accuracy += 3;
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

// ---------------------------------------------------------------------------
// summarizeAiResults
// ---------------------------------------------------------------------------

export function summarizeAiResults(results) {
  const items = Array.isArray(results) ? results : [];
  const supported = items.filter((result) => result?.status !== "unsupported" && result?.status !== "skipped");
  const sourceMixes = supported.map((result) => result?.sourceMix || computeSourceMix(result?.citationMetrics));
  const citationDetailsList = supported.flatMap((result) => (Array.isArray(result?.citationDetails) ? result.citationDetails : []));
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
  const aggregateSourceProfile = computeSourceProfile(citationDetailsList);
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

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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
  const citMetrics = computeCitationMetricsFromDetails(citationDetails);
  const sourceProfile = computeSourceProfile(citationDetails, entityInput);
  const sourceMix = computeSourceMix(citMetrics);

  return {
    citationDetails,
    citationMetrics: citMetrics,
    sourceProfile,
    sourceMix,
  };
}
