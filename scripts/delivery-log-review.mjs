#!/usr/bin/env node
// scripts/delivery-log-review.mjs
// /tmp/aao-delivery-logs/ 의 JSON 로그를 읽어서 오판 후보를 식별합니다.
// 사용법: node --experimental-default-type=module ./scripts/delivery-log-review.mjs [--verbose]
//
// 출력:
//  1. 엔진별 전달률 요약
//  2. 오판 후보 목록 (사람 검토 대상)
//     - delivered인데 의심스러운 것 (citation 없이 delivered)
//     - missed인데 의심스러운 것 (confidence=low)
//     - uncertain 서브페이지
//     - citation level이 host_only인 것

import { readdirSync, readFileSync } from "node:fs";

const LOG_DIR = "/tmp/aao-delivery-logs";
const VERBOSE = process.argv.includes("--verbose");

// Citation이 약한 엔진 — delivered_no_citation을 warn 대신 info로 낮춤
const WEAK_CITATION_ENGINES = new Set(["gemini"]);

function loadLogs() {
  try {
    const files = readdirSync(LOG_DIR).filter((f) => f.endsWith(".json")).sort();
    const allLogs = files.map((f) => {
      const data = JSON.parse(readFileSync(`${LOG_DIR}/${f}`, "utf8"));
      return { file: f, ...data };
    });
    // Dedupe: 같은 URL이면 가장 최신(마지막) 로그만 유지
    const byUrl = new Map();
    for (const log of allLogs) {
      byUrl.set(log.url, log); // 파일 정렬 순서상 나중 것이 덮어씀
    }
    return [...byUrl.values()];
  } catch (e) {
    console.error(`No logs found in ${LOG_DIR}. Run delivery-sample-run.mjs first.`);
    process.exit(1);
  }
}

function main() {
  const logs = loadLogs();
  console.log(`=== Delivery Log Review ===`);
  console.log(`Logs: ${logs.length} files from ${LOG_DIR}\n`);

  // Aggregate stats
  const engineStats = {};
  const reviewItems = [];

  for (const log of logs) {
    const hostname = (() => { try { return new URL(log.url).hostname; } catch { return log.url; } })();

    for (const [engineId, eng] of Object.entries(log.engines || {})) {
      if (!engineStats[engineId]) {
        engineStats[engineId] = { total: 0, success: 0, error: 0, totalFields: 0, deliveredFields: 0, missedFields: 0 };
      }
      const stat = engineStats[engineId];
      stat.total++;

      if (eng.status !== "success") {
        stat.error++;
        continue;
      }
      stat.success++;

      const delivered = eng.deliveredFields || [];
      const missed = eng.missedFields || [];
      stat.totalFields += delivered.length + missed.length;
      stat.deliveredFields += delivered.length;
      stat.missedFields += missed.length;

      // === Review item detection ===

      // 1. Delivered without citation — possible false positive
      if (delivered.length > 0 && eng.citationMatchLevel === "none") {
        // entity_name only + no missed fields → not a real warning, just weak citation
        const entityNameOnly =
          delivered.length === 1 && delivered[0]?.field === "entity_name";
        const noOtherMiss = missed.length === 0;
        const sev = entityNameOnly && noOtherMiss
          ? "info"
          : WEAK_CITATION_ENGINES.has(engineId) ? "info" : "warn";
        reviewItems.push({
          type: "delivered_no_citation",
          severity: sev,
          url: log.url,
          hostname,
          engine: engineId,
          detail: `${delivered.length} fields delivered but no official URL cited`,
          fields: delivered.map((f) => f.field),
        });
      }

      // 2. Citation is host_only — engine cited the domain but not the exact page
      if (eng.citationMatchLevel === "host_only") {
        reviewItems.push({
          type: "citation_host_only",
          severity: "info",
          url: log.url,
          hostname,
          engine: engineId,
          detail: `Cited same domain but different page`,
          citations: eng.citations?.slice(0, 3),
        });
      }

      // 3. Missed fields with low confidence cause
      const lowConfMissed = missed.filter((m) => m.confidence === "low");
      // Separate jsonld_only misses (engine tendency, not judgment error) from real review items
      const jsonldOnlyMissed = lowConfMissed.filter((m) => m.observedSignal === "jsonld_only");
      const realLowConfMissed = lowConfMissed.filter((m) => m.observedSignal !== "jsonld_only");

      if (jsonldOnlyMissed.length > 0) {
        reviewItems.push({
          type: "jsonld_only_miss",
          severity: "info",
          url: log.url,
          hostname,
          engine: engineId,
          detail: `${jsonldOnlyMissed.length} fields declared in JSON-LD only — engine may not read structured data`,
          fields: jsonldOnlyMissed.map((m) => ({
            field: m.field,
            declaredValue: m.declaredValue,
            cause: m.inferredCause,
            signal: m.observedSignal,
          })),
        });
      }

      if (realLowConfMissed.length > 0) {
        reviewItems.push({
          type: "missed_low_confidence",
          severity: "review",
          url: log.url,
          hostname,
          engine: engineId,
          detail: `${realLowConfMissed.length} missed fields with low confidence cause — verify manually`,
          fields: realLowConfMissed.map((m) => ({
            field: m.field,
            declaredValue: m.declaredValue,
            cause: m.inferredCause,
            signal: m.observedSignal,
          })),
        });
      }

      // 4. Uncertain subpage results
      const uncertain = (eng.subpageResults || []).filter((s) => s.reached === "uncertain");
      if (uncertain.length > 0) {
        reviewItems.push({
          type: "subpage_uncertain",
          severity: "review",
          url: log.url,
          hostname,
          engine: engineId,
          detail: `${uncertain.length} subpages with uncertain reach — check manually`,
          subpages: uncertain.map((s) => ({ url: s.url, evidence: s.evidence })),
        });
      }

      // 5. All fields missed — engine may have failed silently
      if (delivered.length === 0 && missed.length > 0) {
        const allJsonldOnly = missed.every((m) => m.observedSignal === "jsonld_only");
        reviewItems.push({
          type: "total_miss",
          severity: allJsonldOnly ? "info" : "warn",
          url: log.url,
          hostname,
          engine: engineId,
          detail: `0/${missed.length} fields delivered — check if engine actually read the page`,
          responsePreview: eng.responsePreview?.slice(0, 150),
        });
      }
    }
  }

  // === Print engine stats ===
  console.log("── Engine Summary ──\n");
  for (const [engineId, stat] of Object.entries(engineStats)) {
    const rate = stat.totalFields > 0 ? ((stat.deliveredFields / stat.totalFields) * 100).toFixed(1) : "N/A";
    console.log(`  ${engineId}:`);
    console.log(`    URLs: ${stat.success}/${stat.total} success`);
    console.log(`    Fields: ${stat.deliveredFields}/${stat.totalFields} delivered (${rate}%)`);
    console.log();
  }

  // === Print review items ===
  if (reviewItems.length === 0) {
    console.log("── No review items found ──");
    return;
  }

  // Group by severity
  const bySeverity = { warn: [], review: [], info: [] };
  for (const item of reviewItems) {
    (bySeverity[item.severity] || bySeverity.info).push(item);
  }

  console.log(`── Review Items: ${reviewItems.length} total ──\n`);

  if (bySeverity.warn.length > 0) {
    console.log(`  ⚠ WARNINGS (${bySeverity.warn.length}) — likely false positives/negatives:\n`);
    for (const item of bySeverity.warn) {
      console.log(`    [${item.type}] ${item.hostname} / ${item.engine}`);
      console.log(`      ${item.detail}`);
      if (VERBOSE && item.fields) console.log(`      fields: ${item.fields.join(", ")}`);
      if (VERBOSE && item.responsePreview) console.log(`      preview: "${item.responsePreview}..."`);
      console.log();
    }
  }

  if (bySeverity.review.length > 0) {
    console.log(`  🔍 REVIEW (${bySeverity.review.length}) — manual verification needed:\n`);
    for (const item of bySeverity.review) {
      console.log(`    [${item.type}] ${item.hostname} / ${item.engine}`);
      console.log(`      ${item.detail}`);
      if (VERBOSE && item.fields) {
        for (const f of item.fields) {
          console.log(`      - ${f.field}: "${f.declaredValue}" → ${f.signal} (${f.cause || "no cause"})`);
        }
      }
      if (VERBOSE && item.subpages) {
        for (const s of item.subpages) {
          console.log(`      - ${s.url} → ${s.evidence}`);
        }
      }
      console.log();
    }
  }

  if (bySeverity.info.length > 0) {
    console.log(`  ℹ INFO (${bySeverity.info.length}):\n`);
    for (const item of bySeverity.info) {
      console.log(`    [${item.type}] ${item.hostname} / ${item.engine}: ${item.detail}`);
      if (VERBOSE && item.citations) console.log(`      citations: ${item.citations.join(", ")}`);
    }
    console.log();
  }

  // === Action items ===
  console.log("── Next Steps ──\n");
  console.log("  1. Review WARNINGS — these are likely judgment errors to fix");
  console.log("  2. Review REVIEW items — manual check needed");
  console.log("  3. Add confirmed misjudgments as fixtures in scripts/delivery-fixtures.mjs");
  console.log("  4. Run with --verbose for full field details\n");
}

main();
