function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getLeadParagraph(content = "") {
  const lines = String(content || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("---"))
    .filter((line) => !line.startsWith("[추가 페이지:"));

  const paragraphs = [];
  let current = [];

  for (const line of lines) {
    if (!line) {
      if (current.length) paragraphs.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(line);
    if (current.join(" ").length >= 240) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }

  if (current.length) paragraphs.push(current.join(" "));
  return normalizeText(paragraphs[0] || "");
}

function getFirstSentence(text = "") {
  const normalized = normalizeText(text);
  const match = normalized.match(/^(.{1,220}?[.!?]|.{1,220}?다\.|.{1,220}?요\.)/);
  return normalizeText(match?.[1] || normalized.slice(0, 220));
}

function extractEntityName(snapshot = {}) {
  return normalizeText(
    snapshot.title
      || snapshot.metadata?.headingStructure?.h1Texts?.[0]
      || ""
  );
}

function hasEntityDefinition(snapshot = {}) {
  const entityName = extractEntityName(snapshot);
  const lead = getLeadParagraph(snapshot.content || "");
  const firstSentence = getFirstSentence(lead);
  if (!firstSentence) return false;

  const hasEntityMention = entityName
    ? firstSentence.toLowerCase().includes(entityName.toLowerCase())
    : false;
  const hasDefinitionPattern = /(?:은|는)\s+.+(?:기업|회사|브랜드|서비스|플랫폼|제조사|기관|조직)|\bis\s+(?:an?|the)\s+.+(?:company|business|brand|platform|service|organization)\b/i
    .test(firstSentence);

  return hasEntityMention && hasDefinitionPattern;
}

function parseJsonLdBlocks(blocks = []) {
  const documents = [];

  for (const block of blocks || []) {
    try {
      const parsed = JSON.parse(block);
      documents.push(parsed);
    } catch {
      continue;
    }
  }

  return documents;
}

function flattenJsonLdDocuments(input) {
  const queue = Array.isArray(input) ? [...input] : [input];
  const flattened = [];

  while (queue.length) {
    const item = queue.shift();
    if (!item) continue;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    if (Array.isArray(item["@graph"])) {
      queue.push(...item["@graph"]);
    }
    flattened.push(item);
  }

  return flattened;
}

function collectJsonLdSignals(jsonLdBlocks = []) {
  const documents = flattenJsonLdDocuments(parseJsonLdBlocks(jsonLdBlocks));
  const types = new Set();
  let faqCount = 0;
  let hasPartCount = 0;
  let significantLinkCount = 0;
  let sameAsCount = 0;
  let factFieldCount = 0;

  const factKeys = [
    "name",
    "alternateName",
    "foundingDate",
    "founder",
    "description",
    "email",
    "telephone",
    "address",
    "serviceType",
    "knowsAbout",
    "sameAs",
  ];

  for (const document of documents) {
    const rawType = document?.["@type"];
    const typeValues = Array.isArray(rawType) ? rawType : [rawType];
    for (const value of typeValues.filter(Boolean)) {
      types.add(String(value));
      if (String(value) === "FAQPage") faqCount += 1;
    }

    if (Array.isArray(document?.hasPart)) {
      hasPartCount += document.hasPart.length;
    } else if (document?.hasPart) {
      hasPartCount += 1;
    }

    if (Array.isArray(document?.significantLink)) {
      significantLinkCount += document.significantLink.length;
    } else if (document?.significantLink) {
      significantLinkCount += 1;
    }

    if (Array.isArray(document?.sameAs)) {
      sameAsCount += document.sameAs.length;
    } else if (document?.sameAs) {
      sameAsCount += 1;
    }

    for (const key of factKeys) {
      if (document?.[key] !== undefined && document?.[key] !== null && document?.[key] !== "") {
        factFieldCount += 1;
      }
    }
  }

  return {
    types: Array.from(types).sort(),
    faqCount,
    hasPartCount,
    significantLinkCount,
    sameAsCount,
    factFieldCount,
  };
}

function detectFactsBlock(snapshot = {}) {
  const lines = String(snapshot.content || "")
    .slice(0, 1600)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const factLabels = new Set();
  const kvRegexes = [
    /^[-*]\s*([^:]{1,30})\s*:\s*(.+)$/,
    /^([^:#]{1,30})\s*:\s*(.+)$/,
  ];

  for (const line of lines) {
    for (const regex of kvRegexes) {
      const match = line.match(regex);
      if (!match) continue;
      const label = normalizeText(match[1]);
      const value = normalizeText(match[2]);
      if (!label || !value) continue;
      if (label.length > 30 || value.length < 2) continue;
      factLabels.add(label);
      break;
    }
  }

  return {
    factLabelCount: factLabels.size,
    labels: Array.from(factLabels).slice(0, 8),
  };
}

function detectFaq(snapshot = {}, jsonLdSignals = null) {
  const headingTexts = [
    ...(snapshot.metadata?.headingStructure?.h1Texts || []),
    ...(snapshot.metadata?.headingStructure?.h2Texts || []),
  ].map((item) => normalizeText(item));
  const content = String(snapshot.content || "");
  const hasFaqHeading = headingTexts.some((heading) => /faq|자주 묻는 질문/i.test(heading));
  const hasQaPattern = /(?:^|\n)\s*(?:q[.:]|q\s|- q[:.]|질문[:.]|문:)\s+/im.test(content)
    && /(?:^|\n)\s*(?:a[.:]|a\s|- a[:.]|답변[:.]|답:)\s+/im.test(content);
  const hasFaqJsonLd = Boolean(jsonLdSignals?.faqCount);

  return {
    hasFaqHeading,
    hasQaPattern,
    hasFaqJsonLd,
  };
}

function detectSubpageRegistry(snapshot = {}, jsonLdSignals = null) {
  const internalLinks = Array.isArray(snapshot.links) ? snapshot.links : [];
  const helpfulLinks = internalLinks.filter((href) => {
    try {
      const pathname = new URL(href).pathname.toLowerCase();
      return pathname !== "/" && pathname.split("/").length <= 4;
    } catch {
      return false;
    }
  });

  const hasSubpageHeading = /(주요 페이지|핵심 페이지|related pages|important pages|subpages?)/i
    .test(String(snapshot.content || "").slice(0, 2400));

  return {
    internalLinkCount: helpfulLinks.length,
    hasSubpageHeading,
    jsonLdHasPartCount: jsonLdSignals?.hasPartCount || 0,
    jsonLdSignificantLinkCount: jsonLdSignals?.significantLinkCount || 0,
  };
}

function createCheck({
  id,
  category,
  title,
  status,
  evidence,
  fix,
  blocking = false,
  origin = "catalog",
  blockageIds = [],
}) {
  return { id, category, title, status, evidence, fix, blocking, origin, blockageIds };
}

export function buildAaoLintReport({ snapshot, discoverySignals }) {
  const jsonLdSignals = collectJsonLdSignals(snapshot?.jsonLdBlocks || []);
  const factsBlock = detectFactsBlock(snapshot);
  const faqSignals = detectFaq(snapshot, jsonLdSignals);
  const subpageRegistry = detectSubpageRegistry(snapshot, jsonLdSignals);
  const leadParagraph = getLeadParagraph(snapshot?.content || "");
  const firstSentence = getFirstSentence(leadParagraph);
  const entityDefinitionOk = hasEntityDefinition(snapshot);
  const headingStructure = snapshot?.metadata?.headingStructure || {};
  const indexability = snapshot?.metadata?.indexability || {};
  const robots = discoverySignals?.robots || {};
  const sitemap = discoverySignals?.sitemap || {};
  const llmsTxt = discoverySignals?.llmsTxt || {};
  const directSourceCount = (snapshot?.crawlSource || []).filter((item) => String(item || "").startsWith("direct:")).length;
  const jinaSourceCount = (snapshot?.crawlSource || []).filter((item) => String(item || "").startsWith("jina:")).length;
  const title = normalizeText(snapshot?.title);
  const description = normalizeText(snapshot?.description);
  const hasOg = Boolean(snapshot?.metadata?.hasOpenGraph || snapshot?.metadata?.openGraphTitle || snapshot?.metadata?.openGraphDescription);
  const isAiProfilePage = /\/ai-profile(\/|$)?/i.test(String(snapshot?.url || ""))
    || /ai profile/i.test(`${snapshot?.title || ""} ${snapshot?.description || ""}`);

  const coreChecks = [];
  const platformChecks = [];

  coreChecks.push(createCheck({
    id: "entity-definition",
    category: "content",
    title: "첫 문장 엔티티 정의",
    status: entityDefinitionOk ? "pass" : "fail",
    blocking: !entityDefinitionOk,
    origin: "catalog",
    blockageIds: ["B002"],
    evidence: entityDefinitionOk
      ? `첫 문장에 엔티티명과 정의 패턴이 함께 있습니다. (${firstSentence.slice(0, 140)})`
      : `첫 문장이 'X는 Y이다' 형태로 충분히 단순하지 않습니다. (${firstSentence.slice(0, 140) || "문장 없음"})`,
    fix: "첫 문장을 회사명 + 업종/정의가 함께 있는 한 문장으로 단순화하세요.",
  }));

  coreChecks.push(createCheck({
    id: "facts-source-structure",
    category: "content",
    title: "명시적 사실 소스",
    status: factsBlock.factLabelCount >= 4 || jsonLdSignals.factFieldCount >= 6
      ? "pass"
      : factsBlock.factLabelCount >= 2 || jsonLdSignals.factFieldCount >= 3
        ? "warn"
        : "fail",
    blocking: factsBlock.factLabelCount < 2 && jsonLdSignals.factFieldCount < 3,
    origin: "catalog",
    blockageIds: ["B001"],
    evidence: `facts block 라벨 ${factsBlock.factLabelCount}개 · JSON-LD fact 필드 ${jsonLdSignals.factFieldCount}개`,
    fix: "인포박스/표 의존 사실은 상단 facts block과 JSON-LD에 중복 선언하세요.",
  }));

  platformChecks.push(createCheck({
    id: "static-rendering",
    category: "rendering",
    title: "정적 렌더링 접근성",
    status: directSourceCount > 0 ? "pass" : jinaSourceCount > 0 ? "warn" : "fail",
    blocking: directSourceCount === 0 && jinaSourceCount === 0,
    origin: "platform",
    evidence: directSourceCount > 0
      ? `직접 fetch 경로에서 읽힌 페이지가 ${directSourceCount}개 있습니다.`
      : jinaSourceCount > 0
        ? `직접 fetch보다 렌더링 fallback 의존도가 높습니다. (${jinaSourceCount}개)`
        : "직접 fetch와 렌더링 fallback 모두에서 안정적인 텍스트를 확인하지 못했습니다.",
    fix: "핵심 정보는 JS 없이 서버사이드/정적 HTML로 노출하세요.",
  }));

  platformChecks.push(createCheck({
    id: "subpage-registry",
    category: "subpages",
    title: "서브페이지 허브 구조",
    status: subpageRegistry.internalLinkCount >= 2 && (subpageRegistry.jsonLdHasPartCount > 0 || subpageRegistry.jsonLdSignificantLinkCount > 0)
      ? "pass"
      : isAiProfilePage
        ? "fail"
        : "warn",
    blocking: isAiProfilePage && subpageRegistry.internalLinkCount < 2,
    origin: "platform",
    evidence: `내부 링크 ${subpageRegistry.internalLinkCount}개 · hasPart ${subpageRegistry.jsonLdHasPartCount}개 · significantLink ${subpageRegistry.jsonLdSignificantLinkCount}개`,
    fix: "본문의 링크+설명, JSON-LD hasPart/significantLink, llms.txt 3겹 구조로 서브페이지를 노출하세요.",
  }));

  platformChecks.push(createCheck({
    id: "indexability",
    category: "access",
    title: "인덱싱/크롤 접근성",
    status: indexability?.allowsIndexing === false
      ? "fail"
      : robots?.summary?.deniedCount > 0
        ? "warn"
        : "pass",
    blocking: indexability?.allowsIndexing === false,
    origin: "platform",
    evidence: [
      `indexability: ${indexability?.status || "unknown"}`,
      `robots 허용 ${robots?.summary?.allowedCount ?? 0}/${robots?.summary ? 6 : 0}`,
      sitemap?.fetched ? `sitemap ${sitemap.exists ? "있음" : "없음"}` : "sitemap 확인 안 됨",
    ].join(" · "),
    fix: "noindex/차단 신호를 제거하고 robots.txt, sitemap.xml, canonical을 일관되게 맞추세요.",
  }));

  if (faqSignals.hasFaqHeading || faqSignals.hasQaPattern || faqSignals.hasFaqJsonLd) {
    platformChecks.push(createCheck({
      id: "faq-structure",
      category: "content",
      title: "FAQ/질문응답 구조",
      status: "pass",
      origin: "platform",
      evidence: `FAQ heading ${faqSignals.hasFaqHeading ? "있음" : "없음"} · Q/A 패턴 ${faqSignals.hasQaPattern ? "있음" : "없음"} · FAQ JSON-LD ${faqSignals.hasFaqJsonLd ? "있음" : "없음"}`,
      fix: "FAQ 섹션과 FAQPage JSON-LD를 같이 두면 AI가 반복 질문을 안정적으로 읽습니다.",
    }));
  }

  const checks = [...coreChecks, ...platformChecks];

  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const failCount = checks.filter((check) => check.status === "fail").length;

  return {
    version: "lint-v1",
    readyForAiValidation: failCount === 0,
    summary: {
      totalChecks: checks.length,
      coreCheckCount: coreChecks.length,
      platformCheckCount: platformChecks.length,
      passCount,
      warnCount,
      failCount,
    },
    detectedSignals: {
      entityName: extractEntityName(snapshot),
      firstSentence,
      jsonLdTypes: jsonLdSignals.types,
      factLabelCount: factsBlock.factLabelCount,
      internalLinkCount: subpageRegistry.internalLinkCount,
    },
    coreChecks,
    platformChecks,
    checks,
  };
}
