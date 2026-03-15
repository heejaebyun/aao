// lib/ai-check-entity.js — Entity normalization + Ground Truth
// Extracted from ai-check.js — no business logic changes

// ---------------------------------------------------------------------------
// Shared utility helpers
// ---------------------------------------------------------------------------

export function parseString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function parseBoolean(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

export function parsePositiveInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
}

export function uniqueStrings(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Entity normalization
// ---------------------------------------------------------------------------

export function sanitizePromptInput(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEntityInput(entityInput) {
  if (typeof entityInput === "string") {
    return {
      companyName: sanitizePromptInput(entityInput, 120),
      domain: "",
      officialTitle: "",
      officialDescription: "",
      aliases: [],
      crawlSnapshot: normalizeCrawlSnapshot(),
    };
  }

  return {
    companyName: sanitizePromptInput(entityInput?.companyName || "", 120),
    domain: entityInput?.domain || "",
    officialTitle: sanitizePromptInput(entityInput?.officialTitle || "", 160),
    officialDescription: sanitizePromptInput(entityInput?.officialDescription || "", 500),
    aliases: Array.isArray(entityInput?.aliases)
      ? entityInput.aliases.filter(Boolean).map((a) => sanitizePromptInput(a, 80))
      : [],
    crawlSnapshot: normalizeCrawlSnapshot(entityInput?.crawlSnapshot),
  };
}

export function normalizeCrawlSnapshot(snapshot = null) {
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

// ---------------------------------------------------------------------------
// Entity hint extraction
// ---------------------------------------------------------------------------

export function extractStrongEntityHints(entityInput) {
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

export function extractServiceHints(entityInput) {
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

export function inferCategoryHint(entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const hints = extractServiceHints(entity).slice(0, 3);
  if (hints.length > 0) return hints.join(", ");
  if (entity.officialTitle) return entity.officialTitle;
  if (entity.officialDescription) return entity.officialDescription.split(/[.!?]/)[0];
  return "서비스";
}

export function getEntityAnchorTerms(entityInput) {
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

export function getServiceDefinitionHints(entityInput) {
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

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

export function extractYears(text) {
  return uniqueStrings(String(text || "").match(/\b(?:19|20)\d{2}\b/g) || []);
}

export function extractEmails(text) {
  return uniqueStrings(
    (String(text || "").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [])
      .map((email) => email.toLowerCase())
  );
}

export function extractPhraseHints(values) {
  return uniqueStrings(
    (values || [])
      .flatMap((value) => String(value || "").split(/(?<=[.!?。])\s+|\n+/))
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter((value) => value.length >= 16 && value.length <= 90 && /[a-z가-힣0-9]/i.test(value))
  ).slice(0, 12);
}

// ---------------------------------------------------------------------------
// Crawl verification
// ---------------------------------------------------------------------------

export function buildCrawlVerificationSnapshot(entityInput) {
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

export function computeCrawlVerificationSignals(responseText, entityInput) {
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

// ---------------------------------------------------------------------------
// Hostname helpers
// ---------------------------------------------------------------------------

export function extractHostnamesFromText(text) {
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

export function hostMatchesOfficialDomain(hostname, officialDomain) {
  if (!hostname || !officialDomain) return false;
  return hostname === officialDomain || hostname.endsWith(`.${officialDomain}`);
}

export function getOfficialDomain(entityInput) {
  return normalizeEntityInput(entityInput).domain.replace(/^www\./, "").toLowerCase();
}

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isVertexGroundingUrl(url) {
  const hostname = getHostname(url);
  return hostname === "vertexaisearch.cloud.google.com";
}

export function extractHostnameCandidate(value) {
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

export function toCanonicalCitationUrl(hostname) {
  return hostname ? `https://${hostname}` : "";
}

export function hostnameMatchesAny(hostname, domains) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

// ---------------------------------------------------------------------------
// Ground Truth constants
// ---------------------------------------------------------------------------

export const GROUND_TRUTH_FIELDS = [
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

export const GT_ARRAY_FIELDS = new Set(["key_products", "competitors"]);

export const FACT_LABEL_MAP = {
  entity_name: ["회사명", "서비스명", "브랜드명", "name", "상호"],
  entity_type: ["업종", "산업", "분류", "type", "industry", "사업 분야", "업태"],
  founded: ["설립", "창립", "founded", "설립일", "창립일", "설립연도"],
  headquarters: ["본사", "위치", "headquarters", "location", "주소", "소재지"],
  ceo_or_leader: ["대표", "대표자", "ceo", "founder", "대표이사", "대표자명"],
  employee_count: ["직원 수", "임직원", "employees", "인원"],
  revenue: ["매출", "revenue", "매출액"],
  parent_company: ["모회사", "parent", "소속"],
  key_products: ["서비스", "제품", "key products", "key services", "products", "services", "주요 서비스", "주요 제품", "사업 영역"],
  description: ["한 줄 소개", "설명", "description", "소개"],
};

export const FACT_ALIAS_TO_FIELD = new Map(
  Object.entries(FACT_LABEL_MAP).flatMap(([field, aliases]) =>
    aliases.map((alias) => [alias.toLowerCase(), field])
  )
);

export const FACT_LABEL_ALTERNATION = [...FACT_ALIAS_TO_FIELD.keys()]
  .sort((left, right) => right.length - left.length)
  .map(escapeFactRegExp)
  .join("|");

export const FACT_SECTION_ANCHORS = [
  "공식 사실 요약",
  "핵심 사실 요약",
  "기본 정보",
  "company overview",
  "official facts",
  "key facts",
];

export const FACT_SCALAR_MAX_LENGTH = {
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

// ---------------------------------------------------------------------------
// Ground Truth extraction helpers
// ---------------------------------------------------------------------------

export function escapeFactRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveFactField(label = "") {
  const normalized = String(label || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  const direct = FACT_ALIAS_TO_FIELD.get(normalized);
  if (direct) return direct;

  const segments = normalized
    .split(/\s*\/\s*|\s*\|\s*|\s*·\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const resolved = FACT_ALIAS_TO_FIELD.get(segment);
    if (resolved) return resolved;
  }

  return null;
}

export function normalizeFactValue(field, value) {
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

export function mergeFieldSource(existingEntry, source) {
  if (!existingEntry || !source) return existingEntry;
  const existingSources = Array.isArray(existingEntry.sources)
    ? existingEntry.sources
    : existingEntry.source ? [existingEntry.source] : [];
  if (existingSources.includes(source)) return existingEntry;
  return {
    ...existingEntry,
    sources: [...existingSources, source],
  };
}

// ---------------------------------------------------------------------------
// Facts block extraction
// ---------------------------------------------------------------------------

export function extractFactsBlockFromLines(content = "") {
  const allLines = String(content || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields = {};
  let consecutiveMatches = 0;
  const pendingFields = {};

  for (const line of allLines) {
    const match = line.match(/^[-*]?\s*([^:：]{1,60})\s*[:：]\s*(.+)$/);
    if (!match) {
      if (consecutiveMatches >= 2) Object.assign(fields, pendingFields);
      consecutiveMatches = 0;
      Object.keys(pendingFields).forEach((key) => delete pendingFields[key]);
      continue;
    }

    const field = resolveFactField(match[1]);
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

export function extractFactsBlockInlineWindow(text = "") {
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
    const field = resolveFactField(current.label);
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

export function buildFactExtractionWindows(content = "") {
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

export function extractFactsBlockInline(content = "") {
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

export function extractFactsBlockFromContent(content = "") {
  const fromLines = extractFactsBlockFromLines(content);
  const fromInline = extractFactsBlockInline(content);
  return { ...fromInline, ...fromLines };
}

// ---------------------------------------------------------------------------
// JSON-LD / FAQ extraction
// ---------------------------------------------------------------------------

export function parseJsonLdDocumentsForGt(blocks = []) {
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

export const GT_ENTITY_JSONLD_TYPES = new Set([
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

export function isEligibleGroundTruthDocument(document) {
  const rawType = document?.["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType].filter(Boolean);
  return types.some((type) => GT_ENTITY_JSONLD_TYPES.has(String(type)));
}

export function extractFaqPairsFromContent(content = "") {
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

export function extractFaqPairsFromJsonLd(documents = []) {
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

// ---------------------------------------------------------------------------
// Ground Truth resolution
// ---------------------------------------------------------------------------

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
      const looksLikeTitle = rawName.includes("|") || rawName.includes(" - ") || rawName.length > 60;
      if (!looksLikeTitle) {
        fields.entity_name = { value: rawName, source: "jsonld" };
      }
    } else if (fields.entity_name && document?.name) {
      fields.entity_name = mergeFieldSource(fields.entity_name, "jsonld");
    }
    if (!fields.description && document?.description) {
      fields.description = { value: String(document.description).trim(), source: "jsonld" };
    } else if (fields.description && document?.description) {
      fields.description = mergeFieldSource(fields.description, "jsonld");
    }
    if (!fields.founded && document?.foundingDate) {
      fields.founded = { value: String(document.foundingDate).trim(), source: "jsonld" };
    } else if (fields.founded && document?.foundingDate) {
      fields.founded = mergeFieldSource(fields.founded, "jsonld");
    }
    if (!fields.ceo_or_leader && document?.founder) {
      const founderVal = typeof document.founder === "string"
        ? document.founder.trim()
        : document.founder?.name ? String(document.founder.name).trim() : "";
      if (founderVal) fields.ceo_or_leader = { value: founderVal, source: "jsonld" };
    } else if (fields.ceo_or_leader && document?.founder) {
      fields.ceo_or_leader = mergeFieldSource(fields.ceo_or_leader, "jsonld");
    }
    if (!fields.entity_type && document?.serviceType) {
      fields.entity_type = { value: String(document.serviceType).trim(), source: "jsonld" };
    } else if (fields.entity_type && document?.serviceType) {
      fields.entity_type = mergeFieldSource(fields.entity_type, "jsonld");
    }
    const rawHeadquarters = document?.address?.addressLocality || document?.address?.addressRegion;
    if (!fields.headquarters && rawHeadquarters) {
      fields.headquarters = { value: String(rawHeadquarters).trim(), source: "jsonld" };
    } else if (fields.headquarters && rawHeadquarters) {
      fields.headquarters = mergeFieldSource(fields.headquarters, "jsonld");
    }
    if (!fields.key_products && document?.knowsAbout) {
      const items = Array.isArray(document.knowsAbout) ? document.knowsAbout : [document.knowsAbout];
      const values = items.map((item) => String(typeof item === "object" ? item?.name || "" : item || "").trim()).filter(Boolean);
      if (values.length) {
        fields.key_products = { value: values, source: "jsonld" };
      }
    } else if (fields.key_products && document?.knowsAbout) {
      fields.key_products = mergeFieldSource(fields.key_products, "jsonld");
    }
  }

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
      sources: Array.isArray(entry.sources) ? entry.sources : (entry.source ? [entry.source] : []),
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
      sources: Array.isArray(entry.sources)
        ? entry.sources.filter(Boolean)
        : entry.source ? [entry.source] : ["unknown"],
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

export function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\[\](),.:;'"`"]/g, " ")
    .replace(/(\d+)\s*[년월일명개원억만천백]+/g, "$1")
    .replace(/([\uac00-\ud7a3])(은|는|이|가|을|를|의|에|로|와|과|도|서)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeComparableText(value) {
  return normalizeComparableText(value)
    .split(/[^0-9a-zA-Z가-힣]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function overlapRatio(left, right) {
  const leftSet = new Set(tokenizeComparableText(left));
  const rightSet = new Set(tokenizeComparableText(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftSet.size, rightSet.size);
}

export function extractYearSet(value) {
  return new Set(String(value || "").match(/\b(18|19|20)\d{2}\b/g) || []);
}

export function valuesContainEachOther(left, right) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

export function compareScalarFieldGt(field, groundTruthValue, extractedValue) {
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

const FIELD_NEGATIVE_PATTERNS = {
  entity_name: ["entity name", "company name", "회사명"],
  entity_type: ["entity type", "industry", "업종", "산업"],
  founded: ["founded", "founding date", "설립", "설립연도"],
  headquarters: ["headquarters", "address", "본사", "주소"],
  key_products: ["key products", "products", "services", "주요 제품", "주요 서비스"],
  description: ["description", "summary", "설명", "소개"],
  ceo_or_leader: ["ceo", "leader", "founder", "대표", "대표자", "대표이사"],
};

export function inferMissedFieldCause(_field, source, observedEvidence = {}) {
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

  const sources = Array.isArray(source) ? source : [source].filter(Boolean);
  const hasJsonLdSource = sources.includes("jsonld");
  const hasFactsBlockSource = sources.includes("official_facts_block");

  if (hasJsonLdSource) {
    const bothSources = hasFactsBlockSource || observedEvidence.hasFactsBlock;
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

  if (hasFactsBlockSource) {
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

export function hasNegativeContext(responseText, field) {
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

// ---------------------------------------------------------------------------
// Stage 2: evaluateFieldDelivery
// ---------------------------------------------------------------------------

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
      const causeMeta = inferMissedFieldCause(field, entry.sources || entry.source, observedEvidence);
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
