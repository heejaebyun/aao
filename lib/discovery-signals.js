// lib/discovery-signals.js — LLM bot access signals (robots.txt + llms.txt)
import { fetchWithSafeRedirects } from "./url-safety";

const LLM_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
];

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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

function normalizeSitemapUrl(origin, value) {
  try {
    return new URL(value, origin).toString();
  } catch {
    return "";
  }
}

// MVP-level robots.txt parser
// Handles: User-agent, Allow, Disallow, blank-line group separation, wildcard (*)
function parseRobotsTxt(text) {
  const lines = text.split("\n");
  const rules = {}; // agentName -> { allows: string[], disallows: string[] }
  let currentAgents = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      currentAgents = []; // blank line ends the current group
      continue;
    }
    if (line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;

    const field = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    if (field === "user-agent") {
      currentAgents.push(value);
      if (!rules[value]) rules[value] = { allows: [], disallows: [] };
    } else if (field === "disallow") {
      for (const agent of currentAgents) {
        if (!rules[agent]) rules[agent] = { allows: [], disallows: [] };
        if (value) rules[agent].disallows.push(value);
      }
    } else if (field === "allow") {
      for (const agent of currentAgents) {
        if (!rules[agent]) rules[agent] = { allows: [], disallows: [] };
        if (value) rules[agent].allows.push(value);
      }
    }
  }

  return rules;
}

function parseSitemapUrlsFromRobots(text, origin) {
  const sitemapUrls = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;

    const field = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    if (field !== "sitemap" || !value) continue;

    const normalized = normalizeSitemapUrl(origin, value);
    if (normalized) sitemapUrls.push(normalized);
  }

  return uniqueStrings(sitemapUrls);
}

// Bot-specific rules take priority over wildcard (*).
// If Disallow: / with no Allow: / override → disallow. Otherwise → allow.
function classifyBot(botName, rules) {
  const botRules = rules[botName];
  const wildcardRules = rules["*"];
  const effectiveRules = botRules || wildcardRules;

  if (!effectiveRules) return "unknown";

  const hasRootDisallow = effectiveRules.disallows.some((p) => p === "/" || p === "/*");
  const hasRootAllow = effectiveRules.allows.some((p) => p === "/" || p === "/*");

  if (hasRootDisallow && !hasRootAllow) return "disallow";
  return "allow";
}

export async function fetchRobotsSignal(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return {
      fetched: false,
      bots: Object.fromEntries(LLM_BOTS.map((b) => [b, "unknown"])),
      summary: { allowedCount: 0, deniedCount: 0, unknownCount: LLM_BOTS.length },
    };
  }

  const robotsUrl = `${origin}/robots.txt`;

  try {
    const res = await fetchWithSafeRedirects(robotsUrl, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AAO-Checker/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return {
        fetched: false,
        url: robotsUrl,
        bots: Object.fromEntries(LLM_BOTS.map((b) => [b, "unknown"])),
        summary: { allowedCount: 0, deniedCount: 0, unknownCount: LLM_BOTS.length },
      };
    }

    const text = await res.text();
    const rules = parseRobotsTxt(text);
    const sitemapUrls = parseSitemapUrlsFromRobots(text, origin);

    const bots = {};
    for (const bot of LLM_BOTS) {
      bots[bot] = classifyBot(bot, rules);
    }

    const allowedCount = Object.values(bots).filter((v) => v === "allow").length;
    const deniedCount = Object.values(bots).filter((v) => v === "disallow").length;
    const unknownCount = Object.values(bots).filter((v) => v === "unknown").length;

    return {
      fetched: true,
      url: robotsUrl,
      bots,
      sitemapUrls,
      summary: { allowedCount, deniedCount, unknownCount },
    };
  } catch {
    return {
      fetched: false,
      url: robotsUrl,
      bots: Object.fromEntries(LLM_BOTS.map((b) => [b, "unknown"])),
      sitemapUrls: [],
      summary: { allowedCount: 0, deniedCount: 0, unknownCount: LLM_BOTS.length },
    };
  }
}

export async function fetchLlmsTxtSignal(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return { fetched: false, exists: false, contentLength: 0 };
  }

  const llmsUrl = `${origin}/llms.txt`;

  try {
    const res = await fetchWithSafeRedirects(llmsUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return { fetched: true, exists: false, url: llmsUrl, contentLength: 0 };
    }

    const text = await res.text();
    const exists = text.trim().length >= 20;

    return { fetched: true, exists, url: llmsUrl, contentLength: text.length };
  } catch {
    return { fetched: false, exists: false, url: llmsUrl, contentLength: 0 };
  }
}

function parseSitemapDocument(text, requestedUrl) {
  const normalizedText = String(text || "");
  const locs = Array.from(normalizedText.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)).map((match) =>
    decodeXmlEntities(match[1] || "").trim()
  );
  const urlCount = (normalizedText.match(/<url\b/gi) || []).length;
  const sitemapCount = (normalizedText.match(/<sitemap\b/gi) || []).length;
  const normalizedRequestedUrl = normalizeComparableUrl(requestedUrl);

  let requestedPath = "";
  try {
    const requested = new URL(requestedUrl);
    requestedPath = requested.pathname.replace(/\/+$/, "") || "/";
  } catch {
    requestedPath = "";
  }

  const containsRequestedUrl = Boolean(
    normalizedRequestedUrl &&
      locs.some((loc) => normalizeComparableUrl(loc) === normalizedRequestedUrl)
  );
  const containsRequestedPath = Boolean(
    requestedPath &&
      locs.some((loc) => {
        try {
          const locPath = new URL(loc).pathname.replace(/\/+$/, "") || "/";
          return locPath === requestedPath;
        } catch {
          return false;
        }
      })
  );

  return {
    exists: urlCount > 0 || sitemapCount > 0 || locs.length > 0,
    format: sitemapCount > 0 ? "index" : urlCount > 0 ? "urlset" : "unknown",
    urlCount,
    sitemapCount,
    locCount: locs.length,
    containsRequestedUrl,
    containsRequestedPath,
  };
}

export async function fetchSitemapSignal(url, robotsSignal = null) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return {
      fetched: false,
      exists: false,
      url: "",
      format: "unknown",
      urlCount: 0,
      sitemapCount: 0,
      locCount: 0,
      containsRequestedUrl: false,
      containsRequestedPath: false,
      contentLength: 0,
    };
  }

  const candidates = uniqueStrings([...(robotsSignal?.sitemapUrls || []), `${origin}/sitemap.xml`]);

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetchWithSafeRedirects(sitemapUrl, {
        method: "GET",
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AAO-Checker/1.0)" },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const text = await res.text();
      const parsed = parseSitemapDocument(text, url);

      return {
        fetched: true,
        exists: parsed.exists,
        url: sitemapUrl,
        format: parsed.format,
        urlCount: parsed.urlCount,
        sitemapCount: parsed.sitemapCount,
        locCount: parsed.locCount,
        containsRequestedUrl: parsed.containsRequestedUrl,
        containsRequestedPath: parsed.containsRequestedPath,
        contentLength: text.length,
      };
    } catch {
      continue;
    }
  }

  return {
    fetched: false,
    exists: false,
    url: candidates[0] || `${origin}/sitemap.xml`,
    format: "unknown",
    urlCount: 0,
    sitemapCount: 0,
    locCount: 0,
    containsRequestedUrl: false,
    containsRequestedPath: false,
    contentLength: 0,
  };
}

export async function collectDiscoverySignals(url) {
  const robotsSignal =
    await fetchRobotsSignal(url).catch(() => ({
      fetched: false,
      bots: Object.fromEntries(LLM_BOTS.map((b) => [b, "unknown"])),
      sitemapUrls: [],
      summary: { allowedCount: 0, deniedCount: 0, unknownCount: LLM_BOTS.length },
    }));
  const [llmsResult, sitemapResult] = await Promise.allSettled([
    fetchLlmsTxtSignal(url),
    fetchSitemapSignal(url, robotsSignal),
  ]);

  return {
    robots: robotsSignal,
    llmsTxt:
      llmsResult.status === "fulfilled"
        ? llmsResult.value
        : { fetched: false, exists: false, contentLength: 0 },
    sitemap:
      sitemapResult.status === "fulfilled"
        ? sitemapResult.value
        : {
            fetched: false,
            exists: false,
            url: "",
            format: "unknown",
            urlCount: 0,
            sitemapCount: 0,
            locCount: 0,
            containsRequestedUrl: false,
            containsRequestedPath: false,
            contentLength: 0,
          },
  };
}
