import crypto from "node:crypto";
import path from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

export const WIKI_PILOT_TOTAL = 100;
export const WIKI_PILOT_BATCH_SIZE = 10;
export const WIKI_PILOT_OUTPUT_ROOT = path.resolve(process.cwd(), "artifacts", "wiki-benchmark", "pilot-100");
export const WIKI_PILOT_RUN_VERSION = "pilot-100-v1";
export const WIKI_RATE_LIMIT_MS = Number(process.env.WIKI_BENCHMARK_WIKI_RATE_LIMIT_MS || 2000);
export const ENGINE_DELAY_MS = {
  gpt: 1000,
  gemini: 1000,
  perplexity: 3000,
};
export const ENGINE_RESULT_FILE = {
  gpt: "extraction_results_gpt.json",
  gemini: "extraction_results_gemini.json",
  perplexity: "extraction_results_perplexity.json",
};
export const EXTRACTION_FIELDS = [
  "entity_name",
  "entity_type",
  "founded",
  "headquarters",
  "key_products",
  "description",
  "ceo_or_leader",
  "employee_count",
  "revenue",
  "parent_company",
  "competitors",
  "unique_value",
];
export const ARRAY_FIELDS = new Set(["key_products", "competitors"]);
export const INFObOX_KEY_MAP = {
  entity_type: ["산업 분야", "서비스", "업종", "형태", "Industry", "Services", "Type"],
  founded: ["창립", "설립", "설립일", "Founded"],
  headquarters: ["본사 소재지", "본사", "본부", "Headquarters"],
  key_products: ["제품", "서비스", "Products", "Services"],
  ceo_or_leader: ["핵심 인물", "대표", "대표이사", "CEO", "Key people"],
  employee_count: ["직원 수", "종업원 수", "사원수", "Employees"],
  revenue: ["매출액", "Revenue"],
  parent_company: ["모회사", "Parent", "Parent company"],
};
export const DEFAULT_OPENAI_MODEL = process.env.WIKI_BENCHMARK_OPENAI_MODEL?.trim()
  || process.env.AI_CHECK_OPENAI_MODEL?.trim()
  || process.env.OPENAI_MODEL?.trim()
  || "gpt-5-mini";
export const DEFAULT_GEMINI_MODEL = process.env.WIKI_BENCHMARK_GEMINI_MODEL?.trim()
  || process.env.GEMINI_MODEL?.trim()
  || "gemini-3.1-flash-lite-preview";
export const DEFAULT_PERPLEXITY_MODEL = process.env.WIKI_BENCHMARK_PERPLEXITY_MODEL?.trim()
  || "sonar";
export const DEFAULT_MAX_INPUT_CHARS = Number(process.env.WIKI_BENCHMARK_MAX_INPUT_CHARS || 24000);
export const WIKI_GROUND_TRUTH_VERSION = "wiki-ground-truth-v2";
export const WIKI_GROUND_TRUTH_SCHEMA = "wiki_declared_sources";
export const OFFICIAL_GROUND_TRUTH_VERSION = "official-ground-truth-v1";
export const OFFICIAL_GROUND_TRUTH_SCHEMA = "official_declared_sources";

export const PILOT_SELECTION_PLAN = [
  { lang: "ko", tier: "global_large", count: 5 },
  { lang: "ko", tier: "national_mid", count: 25 },
  { lang: "ko", tier: "small_startup", count: 20 },
  { lang: "ko", tier: "sparse_stub", count: 25 },
  { lang: "en", tier: "global_large", count: 5 },
  { lang: "en", tier: "national_mid", count: 5 },
  { lang: "en", tier: "small_startup", count: 5 },
  { lang: "en", tier: "sparse_stub", count: 10 },
];

export const WIKI_CATEGORY_SEEDS = {
  ko: {
    global_large: [
      "분류:대한민국의 다국적 기업",
      "분류:대한민국의 전자 기업",
      "분류:대한민국의 상장 기업",
      "분류:일본의 상장 기업",
    ],
    national_mid: [
      "분류:대한민국의 기업",
      "분류:대한민국의 제조 기업",
      "분류:대한민국의 IT 기업",
      "분류:일본의 기업",
      "분류:미국의 기업",
    ],
    small_startup: [
      "분류:대한민국의 스타트업",
      "분류:대한민국의 소프트웨어 기업",
      "분류:대한민국의 벤처 기업",
      "분류:인터넷 기업",
    ],
    sparse_stub: [
      "분류:기업에 관한 토막글",
      "분류:대한민국의 기업에 관한 토막글",
      "분류:일본의 기업에 관한 토막글",
    ],
  },
  en: {
    global_large: [
      "Category:Companies_in_the_Dow_Jones_Industrial_Average",
      "Category:Companies_listed_on_the_New_York_Stock_Exchange",
      "Category:Companies_listed_on_the_Tokyo_Stock_Exchange",
      "Category:Companies_listed_on_the_Korea_Exchange",
    ],
    national_mid: [
      "Category:Companies_of_South_Korea",
      "Category:Companies_of_Japan",
      "Category:Companies_of_the_United_States",
      "Category:Companies_of_Germany",
    ],
    small_startup: [
      "Category:Start-up_companies",
      "Category:Software_companies",
      "Category:Technology_companies",
      "Category:Internet_properties",
    ],
    sparse_stub: [
      "Category:Company_stubs",
      "Category:Business_stubs",
      "Category:Technology_company_stubs",
    ],
  },
};

const HTML_ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  middot: "·",
};

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const [rawKey, inlineValue] = token.slice(2).split("=");
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[rawKey] = true;
      continue;
    }

    args[rawKey] = next;
    index += 1;
  }
  return args;
}

export function resolvePilotOptions(rawArgs = {}) {
  const totalPages = coerceNumber(rawArgs.total, WIKI_PILOT_TOTAL);
  const batchSize = coerceNumber(rawArgs.batchSize, WIKI_PILOT_BATCH_SIZE);
  const maxDepth = coerceNumber(rawArgs.maxDepth, 2);
  const maxInputChars = coerceNumber(rawArgs.maxInputChars, DEFAULT_MAX_INPUT_CHARS);
  const limitPerSeed = coerceNumber(rawArgs.limitPerSeed, 160);
  const outputRoot = path.resolve(process.cwd(), rawArgs.outputRoot || WIKI_PILOT_OUTPUT_ROOT);
  return {
    totalPages,
    batchSize,
    maxDepth,
    maxInputChars,
    limitPerSeed,
    refresh: Boolean(rawArgs.refresh),
    outputRoot,
  };
}

export function resolveOutputPaths(options) {
  return {
    root: options.outputRoot,
    partialsDir: path.join(options.outputRoot, "partials"),
    urls: path.join(options.outputRoot, "urls_100.json"),
    selectionSummary: path.join(options.outputRoot, "selection_summary.json"),
    crawlResults: path.join(options.outputRoot, "crawl_results_100.json"),
    crawlErrors: path.join(options.outputRoot, "crawl_errors.json"),
    extractionErrors: path.join(options.outputRoot, "extraction_errors.json"),
    extractionSummary: path.join(options.outputRoot, "extraction_summary.json"),
    classificationResults: path.join(options.outputRoot, "classification_results.json"),
    featureImpactRanking: path.join(options.outputRoot, "feature_impact_ranking.json"),
    engineConsistency: path.join(options.outputRoot, "engine_consistency.json"),
    fieldDifficulty: path.join(options.outputRoot, "field_difficulty.json"),
    analysisSummary: path.join(options.outputRoot, "analysis_summary.json"),
    blockageCatalog: path.join(options.outputRoot, "blockage_catalog_v1.json"),
    blockageCatalogSummary: path.join(options.outputRoot, "blockage_catalog_summary.json"),
    modificationTargets: path.join(options.outputRoot, "modification_targets_30.json"),
    modificationTargetSummary: path.join(options.outputRoot, "modification_targets_summary.json"),
    modificationResults: path.join(options.outputRoot, "modification_results.json"),
    stepEffectiveness: path.join(options.outputRoot, "step_effectiveness.json"),
    pageProgression: path.join(options.outputRoot, "page_progression.json"),
    calibrationData: path.join(options.outputRoot, "calibration_data.json"),
    experimentSummary: path.join(options.outputRoot, "experiment_summary.json"),
  };
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function coerceNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function hashString(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex");
}

export function stableRank(value) {
  return hashString(value).slice(0, 12);
}

export async function withRetries(task, { retries = 3, label = "task", onRetry } = {}) {
  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    try {
      return await task(attempt);
    } catch (error) {
      attempt += 1;
      lastError = error;
      if (attempt >= retries) break;
      if (typeof onRetry === "function") {
        await onRetry(error, attempt);
      }
      console.warn(`[wiki-benchmark] retry ${attempt}/${retries - 1}: ${label} - ${error.message}`);
      await sleep(750 * attempt);
    }
  }

  throw lastError;
}

export function buildWikiPageUrl(lang, title) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function createRateLimitedRunner(minDelayMs) {
  let lastStartedAt = 0;
  return async function run(task) {
    const now = Date.now();
    const waitMs = Math.max(0, lastStartedAt + minDelayMs - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastStartedAt = Date.now();
    return task();
  };
}

export function createWikiApiClient({ lang, minDelayMs = WIKI_RATE_LIMIT_MS }) {
  const run = createRateLimitedRunner(minDelayMs);

  async function request(params) {
    return run(async () => {
      const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
      const finalParams = {
        format: "json",
        origin: "*",
        redirects: "1",
        ...params,
      };

      for (const [key, value] of Object.entries(finalParams)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": "AAO-Wiki-Benchmark/1.0 (research automation)",
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Wikipedia API ${response.status}: ${body.slice(0, 180)}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Wikipedia API error: ${JSON.stringify(data.error)}`);
      }

      return data;
    });
  }

  return { lang, request };
}

export function normalizeCategoryTitle(lang, title) {
  if (!title) return "";
  if (title.includes(":")) return title;
  return lang === "ko" ? `분류:${title}` : `Category:${title}`;
}

export function normalizePageTitle(title = "") {
  return title.replace(/_/g, " ").trim();
}

export function shouldKeepArticleTitle(title = "") {
  if (!title) return false;
  if (/^List of /i.test(title)) return false;
  if (/^분류:/i.test(title)) return false;
  if (/^Category:/i.test(title)) return false;
  if (/^Template:/i.test(title)) return false;
  if (/^틀:/i.test(title)) return false;
  if (/^\d{4}$/.test(title)) return false;
  if (/^\d/.test(title) && /companies?/i.test(title)) return false;
  return true;
}

export async function collectCategoryPages({
  client,
  lang,
  tier,
  seeds,
  maxDepth,
  limitPerSeed,
}) {
  const pages = [];
  const seenPages = new Set();
  const seenCategories = new Set();
  let visitedCategoryCount = 0;

  async function walkCategory(categoryTitle, depth, seedCategory) {
    if (depth > maxDepth) return;
    const normalizedCategory = normalizeCategoryTitle(lang, categoryTitle);
    if (seenCategories.has(normalizedCategory)) return;
    if (visitedCategoryCount >= 48) return;
    seenCategories.add(normalizedCategory);
    visitedCategoryCount += 1;

    let continueToken = null;
    do {
      const data = await client.request({
        action: "query",
        list: "categorymembers",
        cmtitle: normalizedCategory,
        cmlimit: "500",
        cmtype: "page|subcat",
        cmcontinue: continueToken,
      });

      const members = data.query?.categorymembers || [];
      const queuedSubcategories = [];
      for (const member of members) {
        if (member.ns === 0) {
          const pageTitle = normalizePageTitle(member.title);
          const pageKey = `${lang}:${pageTitle}`;
          if (!shouldKeepArticleTitle(pageTitle) || seenPages.has(pageKey)) continue;
          seenPages.add(pageKey);
          pages.push({
            lang,
            tier,
            title: pageTitle,
            seed_category: normalizedCategory,
            selection_rank: stableRank(pageKey),
          });
          if (pages.length >= limitPerSeed) {
            continueToken = null;
            break;
          }
        } else if (member.ns === 14 && depth < maxDepth) {
          queuedSubcategories.push(member.title);
        }
      }

      if (pages.length < limitPerSeed && depth < maxDepth) {
        for (const subcategory of queuedSubcategories.slice(0, 16)) {
          if (pages.length >= limitPerSeed) break;
          await walkCategory(subcategory, depth + 1, seedCategory);
        }
      }

      continueToken = data.continue?.cmcontinue || null;
    } while (continueToken);
  }

  for (const seed of seeds) {
    if (pages.length >= limitPerSeed) break;
    await withRetries(
      () => walkCategory(seed, 0, seed),
      { label: `collect ${lang}/${tier}/${seed}` }
    );
  }

  return pages.sort((left, right) => left.selection_rank.localeCompare(right.selection_rank));
}

export async function enrichSelectedWikiPages(selectedPages, options) {
  const clients = {
    ko: createWikiApiClient({ lang: "ko" }),
    en: createWikiApiClient({ lang: "en" }),
  };

  const enriched = [];
  for (const [index, page] of selectedPages.entries()) {
    const client = clients[page.lang];
    let pageInfo = {};
    let categories = page.categories || [];
    let sectionCount = page.section_count || 0;

    try {
      const infoData = await withRetries(
        () => client.request({
          action: "query",
          prop: "info|categories",
          inprop: "url",
          cllimit: "max",
          titles: page.title,
        }),
        { label: `page info ${page.lang}:${page.title}` }
      );
      pageInfo = Object.values(infoData.query?.pages || {})[0] || {};
      categories = (pageInfo.categories || []).map((item) => normalizePageTitle(item.title));
    } catch (error) {
      console.warn(`[wiki-benchmark] enrich info fallback for ${page.lang}:${page.title} - ${error.message}`);
    }

    try {
      const sectionsData = await withRetries(
        () => client.request({
          action: "parse",
          page: page.title,
          prop: "sections",
        }),
        { label: `page sections ${page.lang}:${page.title}` }
      );
      sectionCount = Array.isArray(sectionsData.parse?.sections) ? sectionsData.parse.sections.length : sectionCount;
    } catch (error) {
      console.warn(`[wiki-benchmark] enrich sections fallback for ${page.lang}:${page.title} - ${error.message}`);
    }

    const stub = categories.some((name) => /stub|토막글/i.test(name)) || sectionCount <= 2;

    enriched.push({
      id: `wiki_${String(index + 1).padStart(3, "0")}`,
      url: pageInfo.fullurl || buildWikiPageUrl(page.lang, page.title),
      lang: page.lang,
      title: page.title,
      page_length_bytes: pageInfo.length ?? null,
      category_tier: page.tier,
      stub,
      section_count: sectionCount,
      seed_category: page.seed_category,
      categories,
    });
  }

  return enriched;
}

export async function batchHydrateCandidateSelectionSignals(candidates, { batchSize = 20 } = {}) {
  const grouped = new Map();
  for (const candidate of candidates) {
    const bucket = grouped.get(candidate.lang) || [];
    bucket.push(candidate);
    grouped.set(candidate.lang, bucket);
  }

  const hydrated = [];
  for (const [lang, bucket] of grouped.entries()) {
    const client = createWikiApiClient({ lang });
    const batches = chunk(bucket, batchSize);

    for (const batchItems of batches) {
      const titleMap = new Map(batchItems.map((item) => [item.title, item]));
      const titles = batchItems.map((item) => item.title).join("|");

      let pagesByTitle = {};
      try {
        const infoData = await withRetries(
          () => client.request({
            action: "query",
            prop: "info|categories",
            inprop: "url",
            cllimit: "max",
            titles,
          }),
          { label: `hydrate batch ${lang} (${batchItems.length})` }
        );

        for (const page of Object.values(infoData.query?.pages || {})) {
          if (!page?.title) continue;
          pagesByTitle[normalizePageTitle(page.title)] = page;
        }
      } catch (error) {
        console.warn(`[wiki-benchmark] hydrate batch fallback for ${lang} - ${error.message}`);
      }

      for (const item of batchItems) {
        const pageInfo = pagesByTitle[item.title] || {};
        const categories = (pageInfo.categories || []).map((entry) => normalizePageTitle(entry.title));
        const pageLengthBytes = pageInfo.length ?? null;
        const stub = categories.some((name) => /stub|토막글/i.test(name));
        hydrated.push({
          ...item,
          url: pageInfo.fullurl || buildWikiPageUrl(item.lang, item.title),
          page_length_bytes: pageLengthBytes,
          categories,
          stub,
          weak_selection_score: computeWeakSelectionScore({
            ...item,
            page_length_bytes: pageLengthBytes,
            categories,
            stub,
          }),
        });
      }
    }
  }

  return hydrated;
}

export function computeWeakSelectionScore(candidate) {
  let score = 0;
  const length = Number(candidate.page_length_bytes || 0);
  const categories = Array.isArray(candidate.categories) ? candidate.categories : [];
  const title = String(candidate.title || "");

  if (candidate.category_tier === "sparse_stub") score += 20;
  if (candidate.category_tier === "small_startup") score += 8;
  if (candidate.category_tier === "national_mid") score += 5;
  if (candidate.stub) score += 24;

  if (length > 0 && length <= 700) score += 28;
  else if (length <= 1200) score += 22;
  else if (length <= 2200) score += 16;
  else if (length <= 4000) score += 10;
  else if (length <= 8000) score += 4;

  if (categories.some((name) => /출처가 필요한|전체에 출처가 필요한|unsourced|lacking reliable references/i.test(name))) {
    score += 12;
  }
  if (categories.some((name) => /광고처럼 작성된|advertising|cleanup|정리가 필요한/i.test(name))) {
    score += 8;
  }
  if (categories.some((name) => /stub|토막글/i.test(name))) {
    score += 10;
  }
  if (categories.length <= 3) {
    score += 6;
  }
  if (/[A-Z]{2,}/.test(title) || /\b[A-Z]{2,}\b/.test(title)) {
    score += 4;
  }

  return score;
}

export function summarizeSelection(records) {
  const summary = {
    run_version: WIKI_PILOT_RUN_VERSION,
    total: records.length,
    by_lang: {},
    by_tier: {},
  };

  for (const record of records) {
    summary.by_lang[record.lang] = (summary.by_lang[record.lang] || 0) + 1;
    summary.by_tier[record.category_tier] = (summary.by_tier[record.category_tier] || 0) + 1;
  }

  return summary;
}

export function decodeHtmlEntities(text = "") {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, entity) => HTML_ENTITY_MAP[entity.toLowerCase()] || `&${entity};`);
}

export function stripHtml(html = "") {
  return decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
      .replace(/<table class="metadata[\s\S]*?<\/table>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFirstParagraph(html = "") {
  const matches = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  for (const paragraph of matches) {
    const text = stripHtml(paragraph);
    if (text.length >= 30) {
      return text;
    }
  }
  return "";
}

export function extractSectionHeadings(html = "") {
  const headings = [];
  const regex = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match = regex.exec(html);
  while (match) {
    const heading = stripHtml(match[2]).replace(/\[편집\]|\[edit\]/gi, "").trim();
    if (heading) headings.push(heading);
    match = regex.exec(html);
  }
  return headings;
}

export function extractInfobox(html = "") {
  const tableMatch = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) return {};

  const rows = tableMatch[0].match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const infobox = {};
  for (const row of rows) {
    const keyMatch = row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i);
    const valueMatch = row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
    if (!keyMatch || !valueMatch) continue;
    const key = stripHtml(keyMatch[1]).replace(/:$/, "").trim();
    const value = stripHtml(valueMatch[1]).trim();
    if (key && value) {
      infobox[key] = value;
    }
  }
  return infobox;
}

export function extractLinks(html = "", lang = "ko") {
  const internal = [];
  const external = [];
  const linkRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match = linkRegex.exec(html);
  while (match) {
    const href = decodeHtmlEntities(match[1]);
    const anchor = stripHtml(match[2]).trim();
    if (!anchor) {
      match = linkRegex.exec(html);
      continue;
    }
    if (href.startsWith("/wiki/")) {
      internal.push({
        href: `https://${lang}.wikipedia.org${href}`,
        anchor,
      });
    } else if (/^https?:\/\//i.test(href)) {
      external.push({ href, anchor });
    }
    match = linkRegex.exec(html);
  }
  return { internal, external };
}

export function countReferences(html = "") {
  const byId = html.match(/id="cite_note/gi)?.length || 0;
  const byReferenceList = html.match(/class="reference-text"/gi)?.length || 0;
  return Math.max(byId, byReferenceList);
}

export function countWords(text = "") {
  return text.split(/\s+/).filter(Boolean).length;
}

export function averageParagraphLength(text = "") {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!paragraphs.length) return 0;
  const total = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
  return Math.round(total / paragraphs.length);
}

export function buildStructuralFeatures(page) {
  const entityName = page.title;
  const firstSentence = page.first_paragraph.split(/[.!?。]/)[0] || page.first_paragraph;
  const wordCount = countWords(page.plain_text);
  const linkCount = page.internal_link_count + page.external_link_count;
  const firstParagraphDefinition = /은\s.+(기업|회사|브랜드|제조사|서비스)|is\s+(an?|the)\s.+(company|corporation|business|brand)/i
    .test(page.first_paragraph);

  return {
    has_infobox: Object.keys(page.infobox).length > 0,
    infobox_field_count: Object.keys(page.infobox).length,
    first_paragraph_has_entity_definition: firstParagraphDefinition,
    entity_name_in_first_sentence: firstSentence.toLowerCase().includes(entityName.toLowerCase()),
    section_count: page.section_headings.length,
    word_count: wordCount,
    avg_paragraph_length: averageParagraphLength(page.plain_text),
    has_bullet_lists: /<ul\b|<ol\b/i.test(page.raw_html),
    reference_count: page.reference_count,
    internal_link_count: page.internal_link_count,
    external_link_count: page.external_link_count,
    categories_count: page.categories.length,
    text_to_link_ratio: Number((wordCount / Math.max(1, linkCount)).toFixed(2)),
  };
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractInfoboxValue(infobox = {}, field) {
  for (const key of INFObOX_KEY_MAP[field] || []) {
    const raw = infobox[key];
    if (raw === undefined || raw === null) continue;
    if (ARRAY_FIELDS.has(field)) {
      const items = String(raw)
        .split(/,|·|\/|\n|;| 및 | and /)
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length) return items.slice(0, 6);
      continue;
    }
    const normalized = String(raw).trim();
    if (normalized) return normalized;
  }
  return null;
}

function extractYearLikeValue(text = "") {
  const match = String(text).match(/\b(18|19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function hasFirstParagraphEntityDefinition(paragraph = "", lang = "ko") {
  const text = String(paragraph || "").trim();
  if (!text) return false;
  if (lang === "en") {
    return /\bis\s+(?:an?|the)\s+.+(?:company|corporation|brand|business)\b/i.test(text);
  }
  return /(?:은|는)\s+.+(?:기업|회사|브랜드|제조사|서비스)(?:이다|입니다|였다|이다\.)?/i.test(text);
}

function extractEntityTypeFromParagraph(paragraph = "", lang = "ko") {
  const text = String(paragraph || "").trim();
  if (!text) return null;
  if (lang === "en") {
    const match = text.match(/\bis\s+(?:an?|the)\s+(.{1,60}?)(?:company|corporation|brand|business)\b/i);
    return match?.[1]?.trim() || null;
  }
  const match = text.match(/(?:은|는)\s+(.{1,60}?)(?:기업|회사|브랜드|제조사|서비스)(?:이다|입니다|였다|이다\.)?/);
  return match?.[1]?.trim() || null;
}

function extractHeadquartersFromParagraph(paragraph = "", lang = "ko") {
  const text = String(paragraph || "").trim();
  if (!text) return null;
  if (lang === "en") {
    const match = text.match(/\bbased in ([A-Z][^.,;]+)/i);
    return match?.[1]?.trim() || null;
  }
  const match = text.match(/([가-힣A-Za-z0-9·\s]+)에 본사를 둔/);
  return match?.[1]?.trim() || null;
}

function extractCompetitorsFromText(text = "") {
  const normalized = String(text || "");
  const match = normalized.match(/(?:경쟁사|competitors?)[:\s]+([^\n.]+)/i);
  if (!match?.[1]) return null;
  const items = match[1]
    .split(/,|·|\/| 및 | and /)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items.slice(0, 6) : null;
}

function extractUniqueValueFromText(text = "") {
  const normalized = String(text || "");
  const match = normalized.match(/(?:차별화(?: 포인트)?|핵심 역량|강점|known for|best known for)[:\s]+([^\n.]+)/i);
  return match?.[1]?.trim() || null;
}

export function buildGroundTruthFromWikiPage(page = {}) {
  const infobox = page.infobox || {};
  const firstParagraph = String(page.first_paragraph || "").trim();
  const lang = page.lang || "ko";
  const hasDefinition = hasFirstParagraphEntityDefinition(firstParagraph, lang);
  const infoboxEntityType = extractInfoboxValue(infobox, "entity_type");
  const paragraphEntityType = hasDefinition
    ? extractEntityTypeFromParagraph(firstParagraph, lang)
    : null;

  const candidateFacts = {
    entity_name: {
      value: String(page.title || "").trim() || null,
      source: "title",
    },
    entity_type: {
      value: firstNonEmpty([
        infoboxEntityType,
        paragraphEntityType,
      ]),
      source: infoboxEntityType ? "infobox" : (paragraphEntityType ? "first_paragraph_definition" : null),
    },
    founded: {
      value: extractYearLikeValue(extractInfoboxValue(infobox, "founded") || ""),
      source: extractInfoboxValue(infobox, "founded") ? "infobox" : null,
    },
    headquarters: {
      value: extractInfoboxValue(infobox, "headquarters"),
      source: extractInfoboxValue(infobox, "headquarters") ? "infobox" : null,
    },
    key_products: {
      value: extractInfoboxValue(infobox, "key_products"),
      source: extractInfoboxValue(infobox, "key_products") ? "infobox" : null,
    },
    description: {
      value: hasDefinition ? firstParagraph : null,
      source: hasDefinition ? "first_paragraph_definition" : null,
    },
    ceo_or_leader: {
      value: extractInfoboxValue(infobox, "ceo_or_leader"),
      source: extractInfoboxValue(infobox, "ceo_or_leader") ? "infobox" : null,
    },
    employee_count: {
      value: extractInfoboxValue(infobox, "employee_count"),
      source: extractInfoboxValue(infobox, "employee_count") ? "infobox" : null,
    },
    revenue: {
      value: extractInfoboxValue(infobox, "revenue"),
      source: extractInfoboxValue(infobox, "revenue") ? "infobox" : null,
    },
    parent_company: {
      value: extractInfoboxValue(infobox, "parent_company"),
      source: extractInfoboxValue(infobox, "parent_company") ? "infobox" : null,
    },
  };

  const groundTruth = {};
  for (const field of EXTRACTION_FIELDS) {
    const entry = candidateFacts[field];
    if (!entry) continue;
    const hasValue = ARRAY_FIELDS.has(field)
      ? Array.isArray(entry.value) && entry.value.length > 0
      : Boolean(String(entry.value || "").trim());
    if (!hasValue) continue;
    groundTruth[field] = entry;
  }

  return {
    version: WIKI_GROUND_TRUTH_VERSION,
    source_schema: WIKI_GROUND_TRUTH_SCHEMA,
    fields: groundTruth,
    field_count: Object.keys(groundTruth).length,
    field_names: Object.keys(groundTruth),
  };
}

function extractOfficialFactsBlockFromContent(content = "") {
  const lines = String(content || "")
    .slice(0, 2000)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fields = {};
  const factLabelMap = {
    entity_name: ["회사명", "서비스명", "브랜드명", "name"],
    entity_type: ["업종", "산업", "분류", "type", "industry"],
    founded: ["설립", "창립", "founded"],
    headquarters: ["본사", "위치", "headquarters", "location"],
    ceo_or_leader: ["대표", "대표자", "ceo", "founder"],
    employee_count: ["직원 수", "임직원", "employees"],
    revenue: ["매출", "revenue"],
    parent_company: ["모회사", "parent"],
    key_products: ["서비스", "제품", "products", "services"],
    description: ["한 줄 소개", "설명", "description"],
  };

  for (const line of lines) {
    const match = line.match(/^[-*]?\s*([^:]{1,30})\s*:\s*(.+)$/);
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (!value) continue;

    for (const [field, aliases] of Object.entries(factLabelMap)) {
      if (!aliases.some((alias) => label === alias.toLowerCase())) continue;
      fields[field] = {
        value: ARRAY_FIELDS.has(field)
          ? value.split(/,|·|\/| 및 | and /).map((item) => item.trim()).filter(Boolean)
          : value,
        source: "official_facts_block",
      };
    }
  }

  return fields;
}

function parseJsonLdDocuments(blocks = []) {
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

export function buildGroundTruthFromOfficialPage(page = {}) {
  const documents = parseJsonLdDocuments(page.jsonLdBlocks || []);
  const fields = extractOfficialFactsBlockFromContent(page.content || "");

  for (const document of documents) {
    if (!fields.entity_name && document?.name) {
      fields.entity_name = { value: String(document.name).trim(), source: "jsonld" };
    }
    if (!fields.description && document?.description) {
      fields.description = { value: String(document.description).trim(), source: "jsonld" };
    }
    if (!fields.founded && document?.foundingDate) {
      fields.founded = { value: String(document.foundingDate).trim(), source: "jsonld" };
    }
    if (!fields.ceo_or_leader && document?.founder?.name) {
      fields.ceo_or_leader = { value: String(document.founder.name).trim(), source: "jsonld" };
    }
    if (!fields.entity_type && document?.serviceType) {
      fields.entity_type = { value: String(document.serviceType).trim(), source: "jsonld" };
    }
    if (!fields.headquarters && document?.address?.addressLocality) {
      fields.headquarters = { value: String(document.address.addressLocality).trim(), source: "jsonld" };
    }
  }

  const filtered = {};
  for (const field of EXTRACTION_FIELDS) {
    const entry = fields[field];
    if (!entry) continue;
    const hasValue = ARRAY_FIELDS.has(field)
      ? Array.isArray(entry.value) && entry.value.length > 0
      : Boolean(String(entry.value || "").trim());
    if (!hasValue) continue;
    filtered[field] = entry;
  }

  return {
    version: OFFICIAL_GROUND_TRUTH_VERSION,
    source_schema: OFFICIAL_GROUND_TRUTH_SCHEMA,
    fields: filtered,
    field_count: Object.keys(filtered).length,
    field_names: Object.keys(filtered),
  };
}

export function resolveGroundTruth(page = {}, { kind = "wiki" } = {}) {
  const current = page?.ground_truth;

  if (
    kind === "wiki"
    && current?.version === WIKI_GROUND_TRUTH_VERSION
    && current?.source_schema === WIKI_GROUND_TRUTH_SCHEMA
  ) {
    return current;
  }

  if (
    kind === "official"
    && current?.version === OFFICIAL_GROUND_TRUTH_VERSION
    && current?.source_schema === OFFICIAL_GROUND_TRUTH_SCHEMA
  ) {
    return current;
  }

  return kind === "official"
    ? buildGroundTruthFromOfficialPage(page)
    : buildGroundTruthFromWikiPage(page);
}

export function buildExtractionPrompt(text) {
  return `아래 텍스트는 특정 기업에 대한 웹페이지 내용이다.

규칙:
1. 이 텍스트에 포함된 정보만을 사용하여 추출하라.
2. 텍스트에 명시적으로 언급되지 않은 정보는 반드시 null로 표시하라.
3. 네가 학습 데이터에서 이미 알고 있는 정보라도, 이 텍스트에 없으면 null이다.
4. 추측하지 마라. 텍스트에 있는 것만 추출하라.
5. JSON만 출력하라. 다른 텍스트는 출력하지 마라.

JSON 스키마:
{
  "entity_name": "string or null",
  "entity_type": "string or null",
  "founded": "string or null",
  "headquarters": "string or null",
  "key_products": ["string"] or null,
  "description": "string or null",
  "ceo_or_leader": "string or null",
  "employee_count": "string or null",
  "revenue": "string or null",
  "parent_company": "string or null",
  "competitors": ["string"] or null,
  "unique_value": "string or null"
}

[텍스트 시작]
${text}
[텍스트 끝]`;
}

export function requireEnvKey(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} 환경변수가 필요합니다.`);
  }
  return value;
}

export function resolveEngineModel(engine) {
  if (engine === "gpt") return DEFAULT_OPENAI_MODEL;
  if (engine === "gemini") return DEFAULT_GEMINI_MODEL;
  if (engine === "perplexity") return DEFAULT_PERPLEXITY_MODEL;
  throw new Error(`지원하지 않는 엔진입니다: ${engine}`);
}

export function buildBenchmarkInputText(source, maxInputChars = DEFAULT_MAX_INPUT_CHARS) {
  const rawText = typeof source === "string"
    ? source
    : String(source?.plain_text || "");
  const text = rawText.trim();
  if (text.length <= maxInputChars) {
    return {
      text,
      input_text_length: text.length,
      input_truncated: false,
    };
  }

  return {
    text: `${text.slice(0, maxInputChars)}\n\n[TRUNCATED]`,
    input_text_length: text.length,
    input_truncated: true,
  };
}

export function getExtractionJsonSchema() {
  const stringOrNull = { anyOf: [{ type: "string" }, { type: "null" }] };
  const stringArrayOrNull = {
    anyOf: [
      {
        type: "array",
        items: { type: "string" },
      },
      { type: "null" },
    ],
  };

  const properties = {};
  for (const field of EXTRACTION_FIELDS) {
    properties[field] = ARRAY_FIELDS.has(field) ? stringArrayOrNull : stringOrNull;
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: [...EXTRACTION_FIELDS],
  };
}

export function getGeminiExtractionSchema() {
  const properties = {};
  for (const field of EXTRACTION_FIELDS) {
    properties[field] = ARRAY_FIELDS.has(field)
      ? {
          type: "ARRAY",
          nullable: true,
          items: { type: "STRING" },
        }
      : {
          type: "STRING",
          nullable: true,
        };
  }

  return {
    type: "OBJECT",
    properties,
    required: [...EXTRACTION_FIELDS],
  };
}

export function parseJsonObjectFromText(text = "") {
  const normalized = (text || "").replace(/```json\s*|```/gi, "").trim();
  if (!normalized) return null;
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? normalized.slice(firstBrace, lastBrace + 1)
    : normalized;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export function normalizeExtractionValue(field, rawValue) {
  if (rawValue === undefined || rawValue === null) return null;
  if (ARRAY_FIELDS.has(field)) {
    const items = Array.isArray(rawValue)
      ? rawValue.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    return items.length ? items : null;
  }

  const value = String(rawValue).trim();
  return value || null;
}

export function extractParsedValueMap(parsed = {}) {
  const values = {};
  for (const field of EXTRACTION_FIELDS) {
    const rawValue = parsed?.[field];
    if (
      rawValue
      && typeof rawValue === "object"
      && !Array.isArray(rawValue)
      && Object.prototype.hasOwnProperty.call(rawValue, "value")
    ) {
      values[field] = rawValue.value;
      continue;
    }
    values[field] = rawValue;
  }
  return values;
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\[\](),.:;'"`"]/g, " ")
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

function compareArrayField(groundTruthValue, extractedValue) {
  if (!Array.isArray(groundTruthValue) || !groundTruthValue.length) return false;
  const extractedItems = Array.isArray(extractedValue) ? extractedValue : [];
  for (const left of groundTruthValue) {
    for (const right of extractedItems) {
      if (valuesContainEachOther(left, right)) return true;
      if (overlapRatio(left, right) >= 0.4) return true;
    }
  }
  return false;
}

function compareScalarField(field, groundTruthValue, extractedValue) {
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

export function evaluateDeliveryAgainstGroundTruth(parsed, groundTruth = null) {
  const parsedValues = extractParsedValueMap(parsed);
  const truthFields = groundTruth?.fields || {};
  const fieldNames = Object.keys(truthFields);
  const evaluation = {};
  let matchedCount = 0;

  for (const field of fieldNames) {
    const truthEntry = truthFields[field];
    const extractedValue = normalizeExtractionValue(field, parsedValues?.[field]);
    const matched = ARRAY_FIELDS.has(field)
      ? compareArrayField(truthEntry.value, extractedValue)
      : compareScalarField(field, truthEntry.value, extractedValue);

    evaluation[field] = {
      matched,
      source: truthEntry.source || null,
      ground_truth: truthEntry.value,
      extracted: extractedValue,
    };
    if (matched) matchedCount += 1;
  }

  const total = fieldNames.length;
  return {
    ground_truth_fields: fieldNames,
    ground_truth_count: total,
    matched_fields: fieldNames.filter((field) => evaluation[field]?.matched),
    missed_fields: fieldNames.filter((field) => !evaluation[field]?.matched).map((field) => ({
      field,
      source: evaluation[field]?.source || null,
      ground_truth: evaluation[field]?.ground_truth ?? null,
      extracted: evaluation[field]?.extracted ?? null,
    })),
    delivery_evaluation: evaluation,
    delivery_field_count_matched: matchedCount,
    delivery_field_count_missed: Math.max(0, total - matchedCount),
    delivery_rate: total ? Number((matchedCount / total).toFixed(3)) : null,
  };
}

export function normalizeExtractionResult(parsed, groundTruth = null) {
  const parsedValues = extractParsedValueMap(parsed);
  const parsedExtraction = {};
  let present = 0;

  for (const field of EXTRACTION_FIELDS) {
    const value = normalizeExtractionValue(field, parsedValues?.[field]);
    const hasValue = ARRAY_FIELDS.has(field)
      ? Array.isArray(value) && value.length > 0
      : Boolean(value);
    parsedExtraction[field] = {
      value,
      status: hasValue ? "present" : "missing",
    };
    if (hasValue) present += 1;
  }

  const result = {
    parsed_extraction: parsedExtraction,
    field_count_present: present,
    field_count_missing: EXTRACTION_FIELDS.length - present,
    extraction_rate: Number((present / EXTRACTION_FIELDS.length).toFixed(3)),
  };

  if (groundTruth) {
    return {
      ...result,
      ...evaluateDeliveryAgainstGroundTruth(parsed, groundTruth),
    };
  }

  return result;
}

export function extractOpenAiText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const fragments = [];
  for (const item of outputs) {
    if (Array.isArray(item?.content)) {
      for (const content of item.content) {
        if (content?.type === "output_text" && content.text) {
          fragments.push(content.text);
        }
      }
    }
  }
  return fragments.join("\n").trim();
}

export function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((part) => part.text || "").join("").trim();
  }
  return "";
}

export function extractPerplexityText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || "").join("").trim();
  }
  return String(content || "").trim();
}

export function createOpenAiExtractionBody({ model, prompt }) {
  return {
    model,
    max_output_tokens: 2200,
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "wiki_company_extraction",
        strict: true,
        schema: getExtractionJsonSchema(),
      },
    },
  };
}

export function createGeminiExtractionBody({ prompt }) {
  return {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2200,
      responseMimeType: "application/json",
      responseSchema: getGeminiExtractionSchema(),
    },
  };
}

export function createPerplexityExtractionBody({ model, prompt }) {
  return {
    model,
    max_tokens: 2200,
    messages: [
      {
        role: "system",
        content: "Return JSON only. Do not use outside knowledge. If a field is not explicitly present in the provided text, return null.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };
}

export function summarizeExtractionResults(engineResults) {
  const summary = {
    total: engineResults.length,
    by_engine: {},
  };

  for (const result of engineResults) {
    const bucket = summary.by_engine[result.engine] ||= {
      count: 0,
      success: 0,
      error: 0,
      avg_extraction_rate: 0,
      avg_delivery_rate: 0,
    };
    bucket.count += 1;
    if (result.status === "success") {
      bucket.success += 1;
      bucket.avg_extraction_rate += result.extraction_rate;
      if (Number.isFinite(result.delivery_rate)) {
        bucket.avg_delivery_rate += result.delivery_rate;
      }
    } else {
      bucket.error += 1;
    }
  }

  for (const bucket of Object.values(summary.by_engine)) {
    bucket.avg_extraction_rate = bucket.success
      ? Number((bucket.avg_extraction_rate / bucket.success).toFixed(3))
      : 0;
    bucket.avg_delivery_rate = bucket.success
      ? Number((bucket.avg_delivery_rate / bucket.success).toFixed(3))
      : 0;
  }

  return summary;
}

async function runOpenAiExtraction(prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireEnvKey("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify(createOpenAiExtractionBody({
      model: DEFAULT_OPENAI_MODEL,
      prompt,
    })),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  return {
    rawResponse: extractOpenAiText(payload),
    parsed: parseJsonObjectFromText(extractOpenAiText(payload)),
  };
}

async function runGeminiExtraction(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${requireEnvKey("GEMINI_API_KEY")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createGeminiExtractionBody({ prompt })),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  const rawResponse = extractGeminiText(payload);
  return {
    rawResponse,
    parsed: parseJsonObjectFromText(rawResponse),
  };
}

async function runPerplexityExtraction(prompt) {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireEnvKey("PERPLEXITY_API_KEY")}`,
    },
    body: JSON.stringify(createPerplexityExtractionBody({
      model: DEFAULT_PERPLEXITY_MODEL,
      prompt,
    })),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Perplexity ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  const rawResponse = extractPerplexityText(payload);
  return {
    rawResponse,
    parsed: parseJsonObjectFromText(rawResponse),
  };
}

export async function extractWikiBenchmarkRecord({
  engine,
  id,
  url,
  text,
  groundTruth = null,
  maxInputChars = DEFAULT_MAX_INPUT_CHARS,
  promptBuilder = buildExtractionPrompt,
  metadata = {},
}) {
  const input = buildBenchmarkInputText(text, maxInputChars);
  const prompt = promptBuilder(input.text);
  const startedAt = Date.now();

  let extraction;
  if (engine === "gpt") {
    extraction = await withRetries(
      () => runOpenAiExtraction(prompt),
      { label: `extract gpt ${id}` }
    );
  } else if (engine === "gemini") {
    extraction = await withRetries(
      () => runGeminiExtraction(prompt),
      { label: `extract gemini ${id}` }
    );
  } else if (engine === "perplexity") {
    extraction = await withRetries(
      () => runPerplexityExtraction(prompt),
      { label: `extract perplexity ${id}` }
    );
  } else {
    throw new Error(`지원하지 않는 엔진입니다: ${engine}`);
  }

  const base = {
    id,
    url,
    engine,
    engine_model: resolveEngineModel(engine),
    timestamp: nowIso(),
    input_text_length: input.input_text_length,
    input_truncated: input.input_truncated,
    raw_response: extraction.rawResponse,
    latency_ms: Date.now() - startedAt,
    ...metadata,
  };

  if (!extraction.parsed) {
    return {
      ...base,
      status: "error",
      error: "JSON parse failed",
      ...normalizeExtractionResult({}, groundTruth),
      parsed_extraction: Object.fromEntries(
        EXTRACTION_FIELDS.map((field) => [field, { value: null, status: "error" }])
      ),
    };
  }

  return {
    ...base,
    status: "success",
    ...normalizeExtractionResult(extraction.parsed, groundTruth),
  };
}

export function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function pearsonCorrelation(xs, ys) {
  const paired = xs
    .map((x, index) => [x, ys[index]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (paired.length < 3) {
    return { r: 0, pValue: 1 };
  }

  const xValues = paired.map(([x]) => x);
  const yValues = paired.map(([, y]) => y);
  const xMean = average(xValues);
  const yMean = average(yValues);

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let index = 0; index < paired.length; index += 1) {
    const xDelta = xValues[index] - xMean;
    const yDelta = yValues[index] - yMean;
    numerator += xDelta * yDelta;
    xVariance += xDelta ** 2;
    yVariance += yDelta ** 2;
  }

  if (!xVariance || !yVariance) {
    return { r: 0, pValue: 1 };
  }

  const r = numerator / Math.sqrt(xVariance * yVariance);
  const fisherZ = 0.5 * Math.log((1 + Math.min(0.999999, Math.max(-0.999999, r))) / (1 - Math.min(0.999999, Math.max(-0.999999, r))));
  const zScore = Math.abs(fisherZ) * Math.sqrt(Math.max(1, paired.length - 3));
  const pValue = 2 * (1 - normalCdf(zScore));

  return {
    r: Number(r.toFixed(4)),
    pValue: Number(Math.max(0, Math.min(1, pValue)).toFixed(6)),
  };
}

export function normalCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-(absX ** 2));
  return 0.5 * (1 + sign * erf);
}

export function classifyExtractionRate(rate) {
  if (rate >= 0.75) return "A";
  if (rate >= 0.4) return "B";
  return "C";
}

export function pickPresentValue(fieldEntry) {
  return fieldEntry?.status === "present" ? fieldEntry.value : null;
}

export async function loadLocalEnv() {
  const envFiles = [".env.local", ".env"];
  for (const fileName of envFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    const content = await readJsonAsText(filePath);
    if (!content) continue;

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) continue;
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

async function readJsonAsText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
