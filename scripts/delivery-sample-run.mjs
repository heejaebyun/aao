#!/usr/bin/env node
// scripts/delivery-sample-run.mjs
// URL 목록을 받아서 /api/diagnose → /api/ai-check API를 HTTP 호출하여 delivery 로그를 수집합니다.
//
// 사전 조건: Next.js dev 서버가 실행 중이어야 합니다.
//   1. AAO_DEBUG_LOG=1 npm run dev   (터미널 1)
//   2. npm run delivery:run -- [urls-file]   (터미널 2)
//
// ── 표준 실행 템플릿 ──
//   운영군:  npm run delivery:run -- scripts/urls-aao-self.txt
//   실험군:  npm run delivery:run -- scripts/urls-aao-root-experiments.txt
//   리뷰:    npm run delivery:review
//
// urls-file: 한 줄에 URL 하나. #으로 시작하면 주석. 없으면 기본 샘플 사용.
// 결과: /tmp/aao-delivery-logs/ 에 JSON 파일 생성 (서버 측에서 저장)

import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.env.AAO_BASE_URL || "http://localhost:3000";
const LOCAL_RETRYABLE_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

const DEFAULT_URLS = [
  // AAO 자체 페이지
  "https://aao.co.kr",
  "https://aao.co.kr/ai-profile",

  // 한국 기업 — 정적 HTML + JSON-LD 있음
  "https://www.samsung.com/sec/aboutsamsung/company/history/",
  "https://www.hyundai.com/kr/ko/brand/brand-story",
  "https://www.kakaocorp.com/page/company/main",

  // 한국 스타트업/SaaS — 구조화 데이터 다양
  "https://toss.im",
  "https://www.baemin.com",
  "https://www.wanted.co.kr",

  // 글로벌 — JSON-LD 잘 갖춰진 대표 사례
  "https://stripe.com",
  "https://www.notion.so",
  "https://linear.app",

  // SPA/JS 렌더링 강한 사이트 — noStaticHtml/jsRendered 시그널 테스트
  "https://www.musinsa.com",               // React SPA, 상품 데이터 JS 렌더링
  "https://www.coupang.com",               // React, 대부분 JS 렌더링
  "https://www.29cm.co.kr",                // SPA, 콘텐츠 JS 의존
  "https://www.kurly.com",                 // Next.js 기반이나 동적 렌더링 많음
  "https://brunch.co.kr",                  // Kakao SPA, 콘텐츠 JS 로딩

  // 서브페이지 많은 사이트 — subpage 도달/허브 구조 테스트
  "https://www.korcham.net",               // 대한상공회의소, 서브섹션 다수
  "https://www.seoul.go.kr",               // 서울시, 부서별 서브페이지 수백개
  "https://www.samsunglife.com",           // 삼성생명, 상품/서비스/고객센터 다층
  "https://www.lge.co.kr",                 // LG전자, 제품군별 서브페이지 다수
  "https://www.saramin.co.kr",             // 사람인, 채용/기업정보 서브페이지 풍부
];

function loadUrls() {
  const file = process.argv[2];
  if (file) {
    return readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }
  return DEFAULT_URLS;
}

function normalizeSourceTokens(crawlSource) {
  if (Array.isArray(crawlSource)) {
    return crawlSource
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return String(crawlSource || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSubpageUrl(url) {
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

function isLocalBaseUrl() {
  try {
    const parsed = new URL(BASE);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryResponse(status, contentType, rawText) {
  if (!isLocalBaseUrl()) return false;
  if (!LOCAL_RETRYABLE_STATUSES.has(status)) return false;
  if ((contentType || "").includes("application/json")) return true;

  const preview = String(rawText || "").slice(0, 300).toLowerCase();
  return (
    preview.includes("404: this page could not be found") ||
    preview.includes("<!doctype html") ||
    preview.includes("application error") ||
    preview.includes("cannot find module")
  );
}

async function callApi(endpoint, body, attempt = 1) {
  const maxAttempts = isLocalBaseUrl() ? 3 : 1;

  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    let data = null;
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        const preview = rawText.slice(0, 300).replace(/\s+/g, " ").trim();
        throw new Error(
          `Invalid JSON from ${endpoint} (HTTP ${res.status}, content-type: ${contentType}): ${preview}`
        );
      }
    } else if (shouldRetryResponse(res.status, contentType, rawText) && attempt < maxAttempts) {
      console.log(
        `  retrying ${endpoint} after transient ${res.status} HTML response (attempt ${attempt + 1}/${maxAttempts})`
      );
      await sleep(1500);
      return callApi(endpoint, body, attempt + 1);
    } else {
      const preview = rawText.slice(0, 300).replace(/\s+/g, " ").trim();
      const localRouteHint =
        isLocalBaseUrl() &&
        res.status === 404 &&
        preview.toLowerCase().includes("this page could not be found")
          ? " Hint: local Next dev server does not have this API route loaded. Restart `npm run dev` after clearing `.next`."
          : "";
      throw new Error(
        `Non-JSON response from ${endpoint} (HTTP ${res.status}, content-type: ${contentType || "unknown"}): ${preview}${localRouteHint}`
      );
    }

    if (!res.ok) {
      if (shouldRetryResponse(res.status, contentType, rawText) && attempt < maxAttempts) {
        console.log(
          `  retrying ${endpoint} after transient ${res.status} response (attempt ${attempt + 1}/${maxAttempts})`
        );
        await sleep(1500);
        return callApi(endpoint, body, attempt + 1);
      }
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return data;
  } catch (error) {
    if (isLocalBaseUrl() && attempt < maxAttempts) {
      const message = String(error?.message || error);
      if (
        message.includes("fetch failed") ||
        message.includes("Non-JSON response from") ||
        message.includes("Invalid JSON from")
      ) {
        console.log(
          `  retrying ${endpoint} after local dev error (attempt ${attempt + 1}/${maxAttempts})`
        );
        await sleep(1500);
        return callApi(endpoint, body, attempt + 1);
      }
    }
    throw error;
  }
}

async function runOne(url, index, total) {
  const label = `[${index + 1}/${total}]`;
  console.log(`\n${label} ─── ${url} ───`);

  try {
    // Step 1: Diagnose (crawl + lint + ground truth)
    console.log(`${label} Diagnosing...`);
    const diag = await callApi("/api/diagnose", { url });

    const { crawl, lintReport, groundTruth } = diag;
    const lintPasses = [...(lintReport?.coreChecks || []), ...(lintReport?.platformChecks || [])]
      .filter((c) => c.status === "pass").length;
    const lintTotal = (lintReport?.coreChecks?.length || 0) + (lintReport?.platformChecks?.length || 0);
    console.log(`${label} Crawled: "${crawl.title}" (${crawl.contentLength} chars, source: ${crawl.crawlSource})`);
    console.log(`${label} Lint: ${lintPasses}/${lintTotal} pass`);
    console.log(`${label} Ground truth: ${groundTruth?.fieldCount || 0} fields, ${groundTruth?.faqPairs?.length || 0} FAQ pairs`);

    if (!groundTruth?.fieldCount) {
      console.log(`${label} SKIP — no declared fields`);
      return { url, status: "skip", reason: "no_ground_truth" };
    }

    // Step 2: AI Check (engine verification)
    const subpageUrls = [
      ...new Map(
        (crawl.extras || [])
          .map((extra) => [normalizeSubpageUrl(extra.url), normalizeSubpageUrl(extra.url)])
          .filter(([canonicalUrl]) => canonicalUrl),
      ).values(),
    ].slice(0, 5);

    // Derive source counts from crawlSource string (e.g. "direct:https://..." or "jina:...")
    const crawlSourceTokens = normalizeSourceTokens(crawl.crawlSource);
    // Also check crawledPages array if available
    const crawledPages = crawl.crawledPages || [];
    const directFromPages = crawledPages.filter((p) => String(p.source || "").startsWith("direct")).length;
    const jinaFromPages = crawledPages.filter((p) => String(p.source || "").startsWith("jina")).length;
    const directFromSource = crawlSourceTokens.filter((token) => token.startsWith("direct:")).length;
    const jinaFromSource = crawlSourceTokens.filter((token) => token.startsWith("jina:")).length;
    const directSourceCount = directFromPages || directFromSource;
    const jinaSourceCount = jinaFromPages || jinaFromSource;

    const crawlSignals = {
      directSourceCount,
      jinaSourceCount,
      jsRendered: directSourceCount === 0 && jinaSourceCount > 0,
      robotsDenied: crawl.discoverySignals?.robotsTxt?.blocksAI === true,
      wordCount: Math.round(crawl.contentLength / 5),
      factLabelCount: lintReport?.coreChecks?.find((c) => c.id === "facts-source-structure")?.meta?.factLabels || 0,
      entityDefinitionOk: lintReport?.coreChecks?.find((c) => c.id === "entity-definition")?.status === "pass",
    };

    console.log(`${label} Checking AI engines...`);
    const aiResult = await callApi("/api/ai-check", {
      url: diag.url,
      groundTruth,
      crawlSnapshot: {
        title: crawl.title,
        description: crawl.description,
        content: crawl.contentPreview,
        contentPreview: crawl.contentPreview,
        metadata: crawl.metadata,
        jsonLdBlocks: crawl.jsonLdBlocks,
      },
      subpageUrls,
      crawlSignals,
    });

    // Summary
    for (const [engineId, eng] of Object.entries(aiResult.engines || {})) {
      if (eng.status !== "success") {
        console.log(`${label}   ${engineId}: ERROR — ${eng.error || "unknown"}`);
        continue;
      }
      const delivered = eng.deliveredFields?.length || 0;
      const missed = eng.missedFields?.length || 0;
      const rate = eng.deliveryRate != null ? `${(eng.deliveryRate * 100).toFixed(0)}%` : "N/A";
      const citation = eng.citationMatchLevel || "none";
      const subReached = eng.subpageResults?.filter((s) => s.reached === true).length || 0;
      const subTotal = eng.subpageResults?.length || 0;
      console.log(`${label}   ${engineId}: ${delivered}/${delivered + missed} delivered (${rate}), citation: ${citation}, subpages: ${subReached}/${subTotal}`);
    }

    return { url, status: "ok", engines: aiResult.engines };
  } catch (e) {
    console.error(`${label} ERROR: ${e.message}`);
    return { url, status: "error", error: e.message };
  }
}

function setupReportLog(prefix) {
  const projectRoot = resolve(import.meta.dirname, "..");
  const reportDir = join(projectRoot, "reports", "delivery");
  mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[T:]/g, "").replace(/\..+/, "").slice(0, 15).replace(/(\d{8})(\d{6})/, "$1-$2");
  const filePath = join(reportDir, `${prefix}-${ts}.log`);
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => {
    const line = args.map(String).join(" ");
    origLog(...args);
    try { appendFileSync(filePath, line + "\n"); } catch {}
  };
  console.error = (...args) => {
    const line = args.map(String).join(" ");
    origError(...args);
    try { appendFileSync(filePath, "[ERROR] " + line + "\n"); } catch {}
  };
  return filePath;
}

async function main() {
  const reportFile = setupReportLog("run");

  // Check server is running
  try {
    await fetch(`${BASE}/api/diagnose`, { method: "OPTIONS" }).catch(() => null);
  } catch {
    // ignore — will fail on actual POST if server is down
  }

  const urls = loadUrls();
  console.log(`=== AAO Delivery Sample Run ===`);
  console.log(`Server: ${BASE}`);
  console.log(`URLs: ${urls.length}`);
  console.log(`Report → ${reportFile}`);
  console.log(`Debug logs → /tmp/aao-delivery-logs/ (saved by server when AAO_DEBUG_LOG=1)\n`);

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await runOne(urls[i], i, urls.length);
    results.push(result);
    // Rate limit courtesy: 3s between URLs
    if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 3000));
  }

  console.log(`\n=== Summary ===`);
  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`OK: ${ok}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`\nReview logs: node --experimental-default-type=module ./scripts/delivery-log-review.mjs`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
