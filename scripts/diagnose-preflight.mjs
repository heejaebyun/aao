#!/usr/bin/env node
// scripts/diagnose-preflight.mjs
// URL 후보 목록을 받아서 /api/diagnose만 호출하여 GT 상태를 빠르게 분류합니다.
// ai-check를 돌리지 않으므로 API 비용 없이 빠름.
//
// 사전 조건: Next.js dev 서버가 실행 중이어야 합니다.
//   1. npm run dev   (터미널 1)
//   2. node --experimental-default-type=module ./scripts/diagnose-preflight.mjs urls-candidates.txt   (터미널 2)

import { readFileSync } from "node:fs";

const BASE = process.env.AAO_BASE_URL || "http://localhost:3000";

function loadUrls() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node --experimental-default-type=module ./scripts/diagnose-preflight.mjs <urls-file>");
    process.exit(1);
  }
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function callApi(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function diagnoseOne(url, index, total) {
  const label = `[${index + 1}/${total}]`;

  try {
    const diag = await callApi("/api/diagnose", { url });
    const { crawl, lintReport, groundTruth } = diag;

    const fieldCount = groundTruth?.fieldCount || 0;
    const faqCount = groundTruth?.faqPairs?.length || 0;
    const declaredFields = (groundTruth?.declaredFields || []).map((f) => f.field);

    // Detect JSON-LD types
    const jsonLdBlocks = crawl?.jsonLdBlocks || [];
    const jsonLdTypes = [];
    for (const block of jsonLdBlocks) {
      try {
        const parsed = typeof block === "string" ? JSON.parse(block) : block;
        const docs = Array.isArray(parsed) ? parsed : parsed?.["@graph"] || [parsed];
        for (const doc of docs) {
          const t = doc?.["@type"];
          if (t) jsonLdTypes.push(...(Array.isArray(t) ? t : [t]));
        }
      } catch { /* skip */ }
    }

    // Detect facts block
    const factsCheck = lintReport?.coreChecks?.find((c) => c.id === "facts-source-structure");
    const factLabels = factsCheck?.meta?.factLabels || 0;

    const status = fieldCount > 0 ? "gt_positive" : "gt_absent";

    console.log(`${label} ${url}`);
    console.log(`  status: ${status}`);
    console.log(`  fields: ${fieldCount} (${declaredFields.join(", ") || "none"})`);
    console.log(`  jsonld: ${jsonLdTypes.length > 0 ? jsonLdTypes.join(", ") : "none"}`);
    console.log(`  facts_block: ${factLabels} labels`);
    console.log(`  faq: ${faqCount} pairs`);
    console.log(`  crawl: "${crawl?.title}" (${crawl?.contentLength} chars, ${crawl?.crawlSource})`);

    return { url, status, fieldCount, faqCount, declaredFields, jsonLdTypes, factLabels };
  } catch (e) {
    console.log(`${label} ${url}`);
    console.log(`  status: crawl_error`);
    console.log(`  error: ${e.message}`);
    return { url, status: "crawl_error", error: e.message };
  }
}

async function main() {
  const urls = loadUrls();
  console.log(`=== GT Preflight ===`);
  console.log(`Server: ${BASE}`);
  console.log(`URLs: ${urls.length}\n`);

  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await diagnoseOne(urls[i], i, urls.length);
    results.push(result);
    // Rate limit courtesy: 1s between URLs (diagnose only, lighter than full run)
    if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  // Summary
  const positive = results.filter((r) => r.status === "gt_positive");
  const absent = results.filter((r) => r.status === "gt_absent");
  const errors = results.filter((r) => r.status === "crawl_error");

  console.log(`\n=== Summary ===`);
  console.log(`gt_positive: ${positive.length}`);
  console.log(`gt_absent: ${absent.length}`);
  console.log(`crawl_error: ${errors.length}`);

  if (positive.length > 0) {
    console.log(`\n=== GT-Positive URLs (copy to urls-delivery.txt) ===`);
    for (const r of positive) {
      console.log(r.url);
    }
  }

  if (absent.length > 0) {
    console.log(`\n=== GT-Absent URLs ===`);
    for (const r of absent) {
      const types = r.jsonLdTypes?.length > 0 ? r.jsonLdTypes.join(",") : "no-jsonld";
      console.log(`${r.url}  # ${types}`);
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
