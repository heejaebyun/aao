// lib/jina.js — crawl pipeline for AAO
// Primary path: direct HTML fetch + light internal crawl
// Fallback path: Jina browser rendering for CSR or blocked pages

import { collectDiscoverySignals } from "./discovery-signals";
import { assertSafePublicUrl, fetchWithSafeRedirects } from "./url-safety";

const EXTRA_PAGE_CANDIDATES = [
  "/about",
  "/about-us",
  "/company",
  "/who-we-are",
  "/contact",
  "/product",
  "/products",
  "/service",
  "/services",
  "/company-info",
  "/회사소개",
  "/서비스",
  "/제품",
  "/contact-us",
];

const DIRECT_FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

const MAX_EXTRA_PAGES = 2;
const LONG_TEXT_BLOCK_CHAR_THRESHOLD = 2000;

function detectHtmlCharset(contentType, buffer) {
  const headerMatch = contentType.match(/charset=([^\s;]+)/i);
  const headerCharset = headerMatch?.[1]?.toLowerCase().replace(/['"]/g, "") || "";
  if (headerCharset) return headerCharset;

  try {
    const asciiHead = Buffer.from(buffer).toString("ascii", 0, Math.min(buffer.byteLength, 4096));
    const metaCharsetMatch =
      asciiHead.match(/<meta[^>]+charset=["']?\s*([a-z0-9_-]+)/i) ||
      asciiHead.match(/<meta[^>]+content=["'][^"']*charset=([a-z0-9_-]+)/i);
    return metaCharsetMatch?.[1]?.toLowerCase().replace(/['"]/g, "") || "";
  } catch {
    return "";
  }
}

export async function crawlSite(url) {
  const safeUrl = await assertSafePublicUrl(url);

  const [mainPage, discoverySignals] = await Promise.all([
    fetchBestPage(safeUrl),
    collectDiscoverySignals(safeUrl),
  ]);

  if (!mainPage || !hasUsableContent(mainPage)) {
    throw new Error(`Crawl failed or returned insufficient content: ${url}`);
  }

  const candidateUrls = buildCandidateUrls(safeUrl, mainPage.internalLinks);
  const extraPages = [];

  for (const candidateUrl of candidateUrls) {
    if (extraPages.length >= MAX_EXTRA_PAGES) break;

    const page = await fetchBestPage(candidateUrl);
    if (!page || !hasUsableContent(page)) continue;

    extraPages.push(page);
  }

  const main = buildCrawlSnapshot(safeUrl, [mainPage]);
  const extras = extraPages.map((page) => buildCrawlSnapshot(page.url, [page]));
  const combined = buildCrawlSnapshot(safeUrl, [mainPage, ...extraPages]);

  return {
    url: safeUrl,
    main,
    extras,
    combined,
    gap: analyzeGap(main, extras, combined),
    discoverySignals,
  };
}

export async function crawlUrl(url) {
  const safeUrl = await assertSafePublicUrl(url);
  const page = await fetchBestPage(safeUrl);

  if (!page || !hasUsableContent(page)) {
    throw new Error(`Crawl failed or returned insufficient content: ${safeUrl}`);
  }

  return buildCrawlSnapshot(safeUrl, [page]);
}

async function fetchBestPage(url) {
  const directPage = await fetchDirectPage(url);

  if (hasStrongContent(directPage)) {
    return directPage;
  }

  const jinaPage = await fetchJinaPage(url);

  if (!directPage) return jinaPage;
  if (!jinaPage) return directPage;

  return pickBetterPage(directPage, jinaPage);
}

async function fetchDirectPage(url) {
  try {
    const response = await fetchWithSafeRedirects(url, {
      method: "GET",
      headers: DIRECT_FETCH_HEADERS,
      cache: "no-store",
    }, { skipInitialValidation: true });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    // Handle non-UTF-8 charsets (e.g. EUC-KR) from either headers or HTML meta tags.
    let html = "";
    const buffer = await response.arrayBuffer();
    const charset = detectHtmlCharset(contentType, buffer);
    if (charset && charset !== "utf-8" && charset !== "utf8") {
      try {
        const decoder = new TextDecoder(charset);
        html = decoder.decode(buffer);
      } catch {
        html = new TextDecoder("utf-8").decode(buffer);
      }
    } else {
      html = new TextDecoder("utf-8").decode(buffer);
    }
    if (!html) return null;

    return normalizeHtmlPage(response.url || url, html, "direct", response.headers);
  } catch {
    return null;
  }
}

async function fetchJinaPage(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.JINA_API_KEY}`,
        "X-Return-Format": "markdown",
        "X-Engine": "cf-browser-rendering",
        "X-With-Generated-Alt": "true",
        "X-Retain-Images": "none",
        "X-With-Links-Summary": "dedup",
        "X-With-Iframe": "true",
        "X-Timeout": "30",
        "X-Wait-For-Selector": "body",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    return normalizeJinaPage(url, data);
  } catch {
    return null;
  }
}

function normalizeHtmlPage(url, html, source, headers = null) {
  const title = decodeHtmlEntities(extractTagText(html, "title"));
  const description = decodeHtmlEntities(
    extractMetaContent(html, "name", "description") ||
      extractMetaContent(html, "property", "og:description")
  );
  const canonical = normalizeAbsoluteUrl(url, extractCanonical(html));
  const robotsMeta = decodeHtmlEntities(extractMetaContent(html, "name", "robots"));
  const googlebotRobotsMeta = decodeHtmlEntities(extractMetaContent(html, "name", "googlebot"));
  const xRobotsTag = headers?.get?.("x-robots-tag") || "";
  const headings = extractHeadingsFromHtml(html);
  const images = extractImagesFromHtml(html);
  const internalLinks = extractInternalLinks(url, html);
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const bodyText = extractBodyText(html, { stripHeadingLevels: [1, 2] });
  const content = buildMarkdownContent({
    title,
    description,
    headings,
    bodyText,
  });

  return {
    url,
    title,
    description,
    content,
    links: internalLinks,
    images,
    internalLinks,
    source,
    meta: {
      canonical,
      robotsMeta,
      googlebotRobotsMeta,
      xRobotsTag,
      indexability: extractIndexability({
        pageUrl: url,
        canonicalUrl: canonical,
        robotsMeta,
        googlebotRobotsMeta,
        xRobotsTag,
      }),
      openGraphTitle: decodeHtmlEntities(extractMetaContent(html, "property", "og:title")),
      openGraphDescription: decodeHtmlEntities(extractMetaContent(html, "property", "og:description")),
      jsonLdBlocks,
    },
    htmlSignals: {
      headings,
      listItemCount: countTag(html, "li"),
      tableCount: countTag(html, "table"),
      imageCount: images.length,
      imagesWithoutAlt: images.filter((image) => !image.alt).length,
      hasJsonLd: jsonLdBlocks.length > 0,
      hasOpenGraph: Boolean(
        extractMetaContent(html, "property", "og:title") ||
          extractMetaContent(html, "property", "og:description")
      ),
    },
  };
}

function normalizeJinaPage(url, data) {
  const content = data?.content || "";
  const headings = extractHeadingsFromMarkdown(content);
  const images = normalizeJinaImages(data?.images, content);
  const internalLinks = normalizeJinaLinks(url, data?.links);

  return {
    url,
    title: data?.title || "",
    description: data?.description || "",
    content,
    links: data?.links || [],
    images,
    internalLinks,
    source: "jina",
    meta: {
      canonical: "",
      robotsMeta: "",
      googlebotRobotsMeta: "",
      xRobotsTag: "",
      indexability: {
        status: "unknown",
        allowsIndexing: null,
        canonicalMatchesUrl: null,
        canonicalSameOrigin: null,
        reasons: ["렌더링 fallback에서는 indexability 신호를 확인하지 못했습니다."],
      },
      openGraphTitle: "",
      openGraphDescription: "",
      jsonLdBlocks: [],
    },
    htmlSignals: {
      headings,
      listItemCount: (content.match(/^[-*] .+$/gm) || []).length,
      tableCount: Math.floor(((content.match(/\|.+\|/g) || []).length || 0) / 3),
      imageCount: images.length,
      imagesWithoutAlt: images.filter((image) => !image.alt).length,
      hasJsonLd:
        content.includes("json-ld") ||
        content.includes("schema.org") ||
        content.includes("application/ld+json"),
      hasOpenGraph: content.includes("og:") || content.includes("Open Graph"),
    },
  };
}

function buildCrawlSnapshot(requestedUrl, pages) {
  const primaryPage = pages[0];
  const mergedContent = pages
    .map((page, index) => {
      if (index === 0) return page.content;
      const label = new URL(page.url).pathname || "/";
      return `\n\n---\n[추가 페이지: ${label}]\n${page.content}`;
    })
    .filter(Boolean)
    .join("");

  const mergedSignals = mergeSignals(pages);
  const metadata = extractMetadata({
    content: mergedContent,
    pages,
    mergedSignals,
  });

  return {
    url: requestedUrl,
    title: primaryPage?.title || "",
    description: primaryPage?.description || "",
    content: mergedContent,
    links: primaryPage?.links || [],
    images: mergedSignals.images,
    metadata,
    crawledPages: pages.map((page) => page.url),
    crawlSource: pages.map((page) => `${page.source}:${page.url}`),
    crawlConfidence: computeCrawlConfidence(metadata),
    jsonLdBlocks: primaryPage?.meta?.jsonLdBlocks || [],
  };
}

function analyzeGap(main, extras, combined) {
  const hiddenPages = extras.map((page) => page.url);
  const mainH1 = new Set(main.metadata.headingStructure.h1Texts || []);
  const mainH2 = new Set(main.metadata.headingStructure.h2Texts || []);
  const extraHeadings = extras.flatMap((page) => [
    ...(page.metadata.headingStructure.h1Texts || []),
    ...(page.metadata.headingStructure.h2Texts || []),
  ]);
  const newlyDiscoveredHeadings = dedupeTexts(extraHeadings).filter(
    (heading) => !mainH1.has(heading) && !mainH2.has(heading)
  );
  const addedWordCount = Math.max(
    0,
    (combined.metadata.totalWordCount || 0) - (main.metadata.totalWordCount || 0)
  );
  const meaningfulExtraContent = hiddenPages.length > 0 && addedWordCount >= 50;
  const addedStructuredData = !main.metadata.hasJsonLd && combined.metadata.hasJsonLd;
  const addedOpenGraph = !main.metadata.hasOpenGraph && combined.metadata.hasOpenGraph;

  const actions = [];
  const promotedSnippets = buildPromotedSnippets(extras, main);
  if (meaningfulExtraContent) {
    actions.push("서브페이지에만 있는 회사 설명과 서비스 요약을 메인 페이지 상단으로 끌어올리세요.");
  }
  if (addedStructuredData) {
    actions.push("서브페이지에서만 확인된 구조화 데이터를 메인 페이지에도 추가하세요.");
  }
  if (newlyDiscoveredHeadings.length > 0) {
    actions.push("메인 페이지에 핵심 섹션 제목을 명시해 AI가 중요한 정보를 빠르게 찾게 하세요.");
  }
  if (actions.length === 0 && hiddenPages.length > 0) {
    actions.push("메인 페이지에서 회사/서비스 정보를 더 직접적으로 드러내도록 정보 배치를 조정하세요.");
  }

  return {
    hasMeaningfulExtraContent: meaningfulExtraContent,
    hiddenPages,
    addedWordCount,
    newlyDiscoveredHeadings: newlyDiscoveredHeadings.slice(0, 8),
    addedStructuredData,
    addedOpenGraph,
    summary: meaningfulExtraContent
      ? "정보는 사이트 안에 있지만 메인 페이지에서 충분히 드러나지 않습니다."
      : "서브페이지 보강으로도 메인 페이지 대비 큰 정보 증가는 확인되지 않았습니다.",
    actions,
    promotedSnippets,
  };
}

function buildPromotedSnippets(extras, main) {
  const mainContent = (main?.content || "").toLowerCase();
  const snippets = [];

  for (const page of extras) {
    const pathname = new URL(page.url).pathname || "/";
    const candidates = splitIntoSentences(page.content || "")
      .map((sentence) => sentence.trim())
      .filter((sentence) => isUsefulPromotedSentence(sentence, mainContent));

    for (const sentence of candidates.slice(0, 2)) {
      snippets.push({
        sourceUrl: page.url,
        sourcePath: pathname,
        text: sentence,
      });
    }
  }

  return snippets.slice(0, 4);
}

function splitIntoSentences(content) {
  return content
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?。]|다\.|요\.)\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isUsefulPromotedSentence(sentence, mainContent) {
  if (!sentence) return false;
  if (sentence.length < 40 || sentence.length > 180) return false;
  if (sentence.startsWith("#")) return false;
  if (/^q[.:]/i.test(sentence) || /^a[.:]/i.test(sentence)) return false;
  if (!/[가-힣A-Za-z]/.test(sentence)) return false;
  if (mainContent.includes(sentence.toLowerCase())) return false;

  const usefulSignals = [
    "입니다",
    "제공",
    "진단",
    "서비스",
    "플랫폼",
    "설립",
    "대표",
    "고객",
    "기업",
    "ai",
    "profile",
    "optimization",
  ];

  return usefulSignals.some((signal) => sentence.toLowerCase().includes(signal));
}

function mergeSignals(pages) {
  const headingStructure = {
    h1Texts: [],
    h2Texts: [],
    h3Texts: [],
  };
  let listItemCount = 0;
  let tableCount = 0;
  let imageCount = 0;
  let imagesWithoutAlt = 0;
  let hasJsonLd = false;
  let hasOpenGraph = false;
  const images = [];

  for (const page of pages) {
    const signals = page.htmlSignals || {};
    const headings = signals.headings || {};

    headingStructure.h1Texts.push(...(headings.h1Texts || []));
    headingStructure.h2Texts.push(...(headings.h2Texts || []));
    headingStructure.h3Texts.push(...(headings.h3Texts || []));
    listItemCount += signals.listItemCount || 0;
    tableCount += signals.tableCount || 0;
    imageCount += signals.imageCount || 0;
    imagesWithoutAlt += signals.imagesWithoutAlt || 0;
    hasJsonLd = hasJsonLd || Boolean(signals.hasJsonLd);
    hasOpenGraph = hasOpenGraph || Boolean(signals.hasOpenGraph);
    images.push(...(page.images || []));
  }

  return {
    headingStructure,
    listItemCount,
    tableCount,
    imageCount,
    imagesWithoutAlt,
    hasJsonLd,
    hasOpenGraph,
    images,
  };
}

function extractMetadata({ content, pages, mergedSignals }) {
  const primaryMeta = pages[0]?.meta || {};
  const canonicalUrl = primaryMeta.canonical || "";
  const indexability = primaryMeta.indexability || {
    status: "unknown",
    allowsIndexing: null,
    canonicalMatchesUrl: null,
    canonicalSameOrigin: null,
    reasons: [],
  };
  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  const longBlocks = paragraphs.filter((paragraph) => paragraph.length > LONG_TEXT_BLOCK_CHAR_THRESHOLD);
  const totalLength = content.length;
  const textOnly = content.replace(/[#*\-|>\[\]()!`]/g, "").trim();
  const textRatio = textOnly.length / Math.max(totalLength, 1);

  return {
    headingStructure: {
      h1Count: dedupeTexts(mergedSignals.headingStructure.h1Texts).length,
      h2Count: dedupeTexts(mergedSignals.headingStructure.h2Texts).length,
      h3Count: dedupeTexts(mergedSignals.headingStructure.h3Texts).length,
      h1Texts: dedupeTexts(mergedSignals.headingStructure.h1Texts).slice(0, 10),
      h2Texts: dedupeTexts(mergedSignals.headingStructure.h2Texts).slice(0, 10),
    },
    listItemCount: mergedSignals.listItemCount,
    tableCount: mergedSignals.tableCount,
    longTextBlocks: longBlocks.length,
    longTextBlockThresholdChars: LONG_TEXT_BLOCK_CHAR_THRESHOLD,
    totalWordCount: countWords(content),
    imageCount: mergedSignals.imageCount,
    imagesWithoutAlt: mergedSignals.imagesWithoutAlt,
    textContentRatio: Math.round(textRatio * 100),
    hasJsonLd: mergedSignals.hasJsonLd,
    hasOpenGraph: mergedSignals.hasOpenGraph,
    pageCount: pages.length,
    sources: pages.map((page) => page.source),
    canonicalUrl,
    canonicalMatchesUrl: indexability.canonicalMatchesUrl ?? null,
    canonicalSameOrigin: indexability.canonicalSameOrigin ?? null,
    robotsMeta: primaryMeta.robotsMeta || "",
    googlebotRobotsMeta: primaryMeta.googlebotRobotsMeta || "",
    xRobotsTag: primaryMeta.xRobotsTag || "",
    indexability,
  };
}

function computeCrawlConfidence(metadata) {
  let score = 0;
  if (metadata.totalWordCount >= 150) score += 35;
  else if (metadata.totalWordCount >= 50) score += 20;
  else if (metadata.totalWordCount >= 15) score += 10;

  if (metadata.headingStructure.h1Count > 0) score += 15;
  if (metadata.headingStructure.h2Count > 0) score += 10;
  if (metadata.hasJsonLd) score += 10;
  if (metadata.hasOpenGraph) score += 10;
  if (metadata.pageCount > 1) score += 10;
  if (metadata.textContentRatio >= 60) score += 10;

  return Math.min(score, 100);
}

function normalizeUrlForDedupe(url) {
  try {
    const u = new URL(url);
    u.hash = "";

    for (const key of [...u.searchParams.keys()]) {
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
        u.searchParams.delete(key);
      }
    }

    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch { return url; }
}

function buildCandidateUrls(rootUrl, discoveredLinks) {
  const origin = new URL(rootUrl).origin;
  const seen = new Set([normalizeUrlForDedupe(rootUrl)]);
  const candidates = [];

  for (const href of discoveredLinks || []) {
    const normalized = toSameOriginUrl(rootUrl, href);
    if (!normalized) continue;
    const dedupeKey = normalizeUrlForDedupe(normalized);
    if (seen.has(dedupeKey)) continue;

    const pathname = new URL(normalized).pathname.toLowerCase();
    if (!isUsefulPath(pathname)) continue;

    seen.add(dedupeKey);
    candidates.push(normalized);
  }

  for (const path of EXTRA_PAGE_CANDIDATES) {
    const candidate = `${origin}${path}`;
    const dedupeKey = normalizeUrlForDedupe(candidate);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    candidates.push(candidate);
  }

  return candidates.sort((a, b) => scorePath(new URL(b).pathname) - scorePath(new URL(a).pathname));
}

function isUsefulPath(pathname) {
  if (!pathname || pathname === "/") return false;
  if (pathname.split("/").length > 4) return false;

  const usefulKeywords = [
    "about",
    "company",
    "service",
    "product",
    "contact",
    "who-we-are",
    "회사",
    "소개",
    "서비스",
    "제품",
    "문의",
  ];

  return usefulKeywords.some((keyword) => pathname.includes(keyword));
}

function scorePath(pathname) {
  const path = pathname.toLowerCase();
  let score = 0;

  if (path.includes("about") || path.includes("회사") || path.includes("소개")) score += 30;
  if (path.includes("service") || path.includes("서비스")) score += 25;
  if (path.includes("product") || path.includes("제품")) score += 20;
  if (path.includes("company")) score += 20;
  if (path.includes("contact") || path.includes("문의")) score += 15;
  score -= path.length;

  return score;
}

function pickBetterPage(directPage, jinaPage) {
  const directScore = scorePage(directPage);
  const jinaScore = scorePage(jinaPage);

  return directScore >= jinaScore ? directPage : jinaPage;
}

function scorePage(page) {
  if (!page) return 0;

  let score = 0;
  const wordCount = countWords(page.content || "");
  if (wordCount >= 150) score += 60;
  else if (wordCount >= 50) score += 35;
  else if (wordCount >= 15) score += 15;

  if (page.title) score += 10;
  if (page.description) score += 10;
  if ((page.htmlSignals?.headings?.h1Texts || []).length > 0) score += 10;
  if (page.htmlSignals?.hasJsonLd) score += 5;
  if (page.htmlSignals?.hasOpenGraph) score += 5;

  return score;
}

function hasStrongContent(page) {
  if (!page) return false;
  // 본문 단어 수가 150 이상이어야 "강한 콘텐츠"로 간주 (nav/title만으로 통과 방지)
  const wordCount = countWords(page.content || "");
  return wordCount >= 150 && scorePage(page) >= 55;
}

function hasUsableContent(page) {
  return Boolean(page && countWords(page.content || "") >= 15 && (page.title || page.description || page.content));
}

function buildMarkdownContent({ title, description, headings, bodyText }) {
  const parts = [];

  if (title) parts.push(`# ${title}`);
  if (description) parts.push(description);

  for (const heading of headings.h1Texts.slice(0, 3)) {
    parts.push(`## ${heading}`);
  }

  for (const heading of headings.h2Texts.slice(0, 8)) {
    parts.push(`### ${heading}`);
  }

  if (bodyText) parts.push(bodyText);

  return parts.filter(Boolean).join("\n\n").trim();
}

function extractBodyText(html, { stripHeadingLevels = [] } = {}) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let source = bodyMatch ? bodyMatch[1] : html;

  for (const level of stripHeadingLevels) {
    source = source.replace(new RegExp(`<h${level}[^>]*>[\\s\\S]*?<\\/h${level}>`, "gi"), " ");
  }

  return normalizeWhitespace(
    decodeHtmlEntities(
      source
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  ).slice(0, 16000);
}

function extractHeadingsFromHtml(html) {
  return {
    h1Texts: extractTagTexts(html, "h1"),
    h2Texts: extractTagTexts(html, "h2"),
    h3Texts: extractTagTexts(html, "h3"),
  };
}

function extractHeadingsFromMarkdown(content) {
  return {
    h1Texts: (content.match(/^# .+$/gm) || []).map((line) => line.replace(/^# /, "").trim()),
    h2Texts: (content.match(/^## .+$/gm) || []).map((line) => line.replace(/^## /, "").trim()),
    h3Texts: (content.match(/^### .+$/gm) || []).map((line) => line.replace(/^### /, "").trim()),
  };
}

function extractImagesFromHtml(html) {
  const images = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html))) {
    const tag = match[0];
    const src = extractAttribute(tag, "src") || "";
    const alt = decodeHtmlEntities(extractAttribute(tag, "alt") || "");
    images.push({ src, alt });
  }

  return images;
}

function normalizeJinaImages(images, content) {
  if (Array.isArray(images) && images.length > 0) {
    return images.map((image) => ({
      src: typeof image === "string" ? image : image?.src || image?.url || "",
      alt: typeof image === "string" ? "" : image?.alt || "",
    }));
  }

  const markdownImages = content.match(/!\[(.*?)\]\((.+?)\)/g) || [];
  return markdownImages.map((image) => {
    const [, alt = "", src = ""] = image.match(/!\[(.*?)\]\((.+?)\)/) || [];
    return { src, alt };
  });
}

function normalizeJinaLinks(baseUrl, links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (typeof link === "string") return link;
      return link?.url || link?.href || "";
    })
    .filter(Boolean)
    .map((link) => toSameOriginUrl(baseUrl, link) || "")
    .filter(Boolean);
}

function extractInternalLinks(baseUrl, html) {
  const links = new Set();
  const hrefRegex = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html))) {
    const normalized = toSameOriginUrl(baseUrl, match[1]);
    if (normalized) links.add(normalized);
  }

  return Array.from(links);
}

function toSameOriginUrl(baseUrl, href) {
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return null;
    }

    const url = new URL(href, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.origin !== new URL(baseUrl).origin) return null;

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractTagText(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(regex);
  return match ? normalizeWhitespace(decodeHtmlEntities(stripTags(match[1]))) : "";
}

function extractTagTexts(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const matches = [];
  let match;

  while ((match = regex.exec(html))) {
    const text = normalizeWhitespace(decodeHtmlEntities(stripTags(match[1])));
    if (text) matches.push(text);
  }

  return dedupeTexts(matches).slice(0, 20);
}

function extractMetaContent(html, attrName, attrValue) {
  const regex = new RegExp(
    `<meta[^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const reverseRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*>`,
    "i"
  );

  return html.match(regex)?.[1] || html.match(reverseRegex)?.[1] || "";
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  const reverseMatch = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match?.[1] || reverseMatch?.[1] || "";
}

function normalizeAbsoluteUrl(baseUrl, value) {
  const candidate = normalizeWhitespace(decodeHtmlEntities(value || ""));
  if (!candidate) return "";

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeComparableUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${pathname}${url.search}`;
  } catch {
    return "";
  }
}

function parseDirectiveTokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[;,]/)
    .flatMap((chunk) => chunk.split(/\s+/))
    .map((token) => token.trim())
    .filter(Boolean);
}

function hasNoindexDirective(tokens) {
  return tokens.includes("noindex") || tokens.includes("none");
}

function extractIndexability({
  pageUrl,
  canonicalUrl,
  robotsMeta,
  googlebotRobotsMeta,
  xRobotsTag,
}) {
  const robotsTokens = parseDirectiveTokens(robotsMeta);
  const googlebotTokens = parseDirectiveTokens(googlebotRobotsMeta);
  const xRobotsTokens = parseDirectiveTokens(xRobotsTag);
  const noindexSources = [];

  if (hasNoindexDirective(robotsTokens)) noindexSources.push("robots meta");
  if (hasNoindexDirective(googlebotTokens)) noindexSources.push("googlebot meta");
  if (hasNoindexDirective(xRobotsTokens)) noindexSources.push("x-robots-tag");

  const canonicalComparable = normalizeComparableUrl(canonicalUrl);
  const pageComparable = normalizeComparableUrl(pageUrl);

  let canonicalMatchesUrl = null;
  let canonicalSameOrigin = null;

  if (canonicalUrl) {
    canonicalMatchesUrl = Boolean(
      canonicalComparable &&
        pageComparable &&
        canonicalComparable === pageComparable
    );

    try {
      canonicalSameOrigin = new URL(canonicalUrl).origin === new URL(pageUrl).origin;
    } catch {
      canonicalSameOrigin = null;
    }
  }

  const reasons = [];
  let status = "unknown";
  let allowsIndexing = null;

  if (noindexSources.length > 0) {
    status = "noindex";
    allowsIndexing = false;
    reasons.push(`명시적 noindex 신호 감지 (${noindexSources.join(", ")})`);
  } else if (robotsTokens.length || googlebotTokens.length || xRobotsTokens.length) {
    status = "indexable";
    allowsIndexing = true;
    reasons.push("명시적 noindex 지시문은 감지되지 않았습니다.");
  } else {
    status = "likely_indexable";
    allowsIndexing = true;
    reasons.push("index 관련 지시문은 없지만 명시적 차단 신호도 없습니다.");
  }

  if (canonicalUrl) {
    if (canonicalMatchesUrl === true) {
      reasons.push("self-canonical이 확인되었습니다.");
    } else if (canonicalMatchesUrl === false) {
      reasons.push("canonical이 현재 페이지와 다른 URL을 가리킵니다.");
    }

    if (canonicalSameOrigin === false) {
      reasons.push("canonical이 다른 도메인을 가리킵니다.");
    }
  } else {
    reasons.push("canonical link는 확인되지 않았습니다.");
  }

  return {
    status,
    allowsIndexing,
    canonicalMatchesUrl,
    canonicalSameOrigin,
    reasons,
  };
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const text = match[1]?.trim();
    if (text) blocks.push(text);
  }

  return blocks;
}

function extractAttribute(tag, name) {
  const regex = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return tag.match(regex)?.[1] || "";
}

function countTag(html, tagName) {
  return (html.match(new RegExp(`<${tagName}\\b`, "gi")) || []).length;
}

function stripTags(input) {
  return input.replace(/<[^>]+>/g, " ");
}

function countWords(text) {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
}

function dedupeTexts(texts) {
  return Array.from(new Set((texts || []).map((text) => normalizeWhitespace(text)).filter(Boolean)));
}

function normalizeWhitespace(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text) {
  return (text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
