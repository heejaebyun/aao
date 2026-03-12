import {
  loadLocalEnv,
  normalizeExtractionResult,
  parseArgs,
  readJson,
  resolveGroundTruth,
  resolveOutputPaths,
  resolvePilotOptions,
  writeJson,
} from "./wiki-benchmark-lib.mjs";

const OBSERVED_BLOCKAGE_DEFINITIONS = {
  B001: {
    label: "인포박스 기반 사실 미전달",
    inferred_cause: "복잡한 infobox/table 구조를 엔진이 안정적으로 평문화하지 못함",
    fix_pattern: "평문 facts block과 JSON-LD로 같은 사실을 정적으로 중복 선언",
  },
  B002: {
    label: "첫 문장 정의 부재",
    inferred_cause: "엔티티 정의 문장이 약해서 업종/설명 필드를 바로 잡지 못함",
    fix_pattern: "첫 문장을 'X는 Y 기업이다' 형태로 단순화",
  },
};

const INFERRED_PATTERN_DEFINITIONS = {
  I001: {
    label: "콘텐츠 절대량 부족",
    inferred_cause: "원문에 재료가 너무 적어 구조만으로는 전달률을 끌어올리기 어려움",
    fix_pattern: "핵심 사실을 AI 프로필 상단 facts block/FAQ로 직접 승격",
  },
  I002: {
    label: "섹션 구조 약함",
    inferred_cause: "헤딩이 부족하거나 의미 단위 분리가 약해 필드 추출이 흔들림",
    fix_pattern: "개요/역사/제품/조직 같은 의미 헤딩을 정적으로 추가",
  },
  I003: {
    label: "평문 팩트 블록 부재",
    inferred_cause: "설립/본사/대표 같은 핵심 사실이 key-value 형태로 노출되지 않음",
    fix_pattern: "회사명·설립·본사·대표·서비스를 상단 key-value 블록으로 배치",
  },
};

function buildRateMap(results) {
  const map = new Map();
  for (const item of results) {
    map.set(item.id, item);
  }
  return map;
}

function hydrateBenchmarkResult(entry, page) {
  if (!entry) return null;
  const groundTruth = resolveGroundTruth(page, { kind: "wiki" });
  return {
    ...entry,
    ...normalizeExtractionResult(entry.parsed_extraction || entry.parsed || {}, groundTruth),
  };
}

function buildPageObservedBlockages({ page, result }) {
  const missedFields = Array.isArray(result?.missed_fields) ? result.missed_fields : [];
  const missedNames = new Set(missedFields.map((item) => item.field));
  const features = page.structural_features || {};
  const findings = [];

  if (!missedFields.length) return findings;

  const infoboxMisses = missedFields.filter((field) => field.source === "infobox");
  if (infoboxMisses.length > 0) {
    findings.push({
      blockage_id: "B001",
      observed_evidence: `infobox source missed ${infoboxMisses.length}개 (${infoboxMisses.map((item) => item.field).join(", ")})`,
      fields: infoboxMisses.map((item) => item.field),
    });
  }

  if (!features.first_paragraph_has_entity_definition && (missedNames.has("entity_type") || missedNames.has("description"))) {
    findings.push({
      blockage_id: "B002",
      observed_evidence: `첫 문장 정의 없음 + entity_type/description 미전달`,
      fields: ["entity_type", "description"].filter((field) => missedNames.has(field)),
    });
  }

  return findings;
}

function buildInferredPatterns({ page, result }) {
  const missedFields = Array.isArray(result?.missed_fields) ? result.missed_fields : [];
  const features = page.structural_features || {};
  const patterns = [];

  if ((features.word_count || 0) < 50) {
    patterns.push({
      pattern_id: "I001",
      observed_evidence: `word_count ${(features.word_count || 0)} (<50)`,
      fields: missedFields.map((item) => item.field),
    });
  } else if ((features.word_count || 0) < 100 && missedFields.length >= 2) {
    patterns.push({
      pattern_id: "I001",
      observed_evidence: `word_count ${(features.word_count || 0)} (<100) + missed ${missedFields.length}개`,
      fields: missedFields.map((item) => item.field),
    });
  }

  if ((features.section_count || 0) <= 2 && missedFields.length >= 2) {
    patterns.push({
      pattern_id: "I002",
      observed_evidence: `section_count ${(features.section_count || 0)} + missed ${missedFields.length}개`,
      fields: missedFields.map((item) => item.field),
    });
  }

  if (!features.has_infobox && missedFields.some((item) => item.source === "infobox")) {
    patterns.push({
      pattern_id: "I003",
      observed_evidence: "평문 팩트 블록 없이 infobox 의존",
      fields: missedFields.filter((item) => item.source === "infobox").map((item) => item.field),
    });
  }

  return patterns;
}

function summarizeCatalog(catalogEntries, keyName = "blockage_id") {
  const perEngine = {};

  for (const entry of catalogEntries) {
    const bucket = perEngine[entry.engine] ||= [];
    bucket.push(entry);
  }

  const topByEngine = {};
  for (const [engine, entries] of Object.entries(perEngine)) {
    topByEngine[engine] = entries
      .sort((left, right) => right.frequency - left.frequency)
      .slice(0, 5)
      .map((entry) => ({
        [keyName]: entry[keyName],
        label: entry.label,
        frequency: entry.frequency,
      }));
  }

  return {
    total_catalog_entries: catalogEntries.length,
    top_by_engine: topByEngine,
  };
}

async function main() {
  const args = parseArgs();
  await loadLocalEnv();
  const options = resolvePilotOptions(args);
  const paths = resolveOutputPaths(options);

  const crawlResults = await readJson(paths.crawlResults, []);
  const gptResults = await readJson(`${paths.root}/extraction_results_gpt.json`, []);
  const geminiResults = await readJson(`${paths.root}/extraction_results_gemini.json`, []);
  const perplexityResults = await readJson(`${paths.root}/extraction_results_perplexity.json`, []);

  if (!crawlResults.length) {
    throw new Error(`크롤링 결과가 없습니다: ${paths.crawlResults}`);
  }

  const engineMaps = {
    gpt: buildRateMap(gptResults),
    gemini: buildRateMap(geminiResults),
    perplexity: buildRateMap(perplexityResults),
  };

  const aggregated = new Map();
  const inferredAggregated = new Map();
  const perPage = [];

  for (const page of crawlResults) {
    for (const engine of ["gpt", "gemini", "perplexity"]) {
      const result = hydrateBenchmarkResult(engineMaps[engine].get(page.id), page);
      if (!result || result.status !== "success") continue;

      const findings = buildPageObservedBlockages({ page, result });
      const inferredPatterns = buildInferredPatterns({ page, result });
      if (!findings.length && !inferredPatterns.length) continue;

      perPage.push({
        id: page.id,
        title: page.title,
        url: page.url,
        engine,
        delivery_rate: result.delivery_rate,
        blockage_ids: findings.map((item) => item.blockage_id),
        inferred_pattern_ids: inferredPatterns.map((item) => item.pattern_id),
        missed_fields: result.missed_fields,
      });

      for (const finding of findings) {
        const key = `${engine}:${finding.blockage_id}`;
        const definition = OBSERVED_BLOCKAGE_DEFINITIONS[finding.blockage_id];
        const entry = aggregated.get(key) || {
          blockage_id: finding.blockage_id,
          label: definition.label,
          engine,
          frequency: 0,
          pages: [],
          fields: new Set(),
          observed_evidence_examples: new Set(),
          inferred_cause: definition.inferred_cause,
          fix_pattern: definition.fix_pattern,
        };

        entry.frequency += 1;
        entry.pages.push({
          id: page.id,
          title: page.title,
          url: page.url,
          delivery_rate: result.delivery_rate,
        });
        for (const field of finding.fields || []) {
          entry.fields.add(field);
        }
        entry.observed_evidence_examples.add(finding.observed_evidence);
        aggregated.set(key, entry);
      }

      for (const pattern of inferredPatterns) {
        const key = `${engine}:${pattern.pattern_id}`;
        const definition = INFERRED_PATTERN_DEFINITIONS[pattern.pattern_id];
        const entry = inferredAggregated.get(key) || {
          pattern_id: pattern.pattern_id,
          label: definition.label,
          engine,
          frequency: 0,
          pages: [],
          fields: new Set(),
          observed_evidence_examples: new Set(),
          inferred_cause: definition.inferred_cause,
          fix_pattern: definition.fix_pattern,
        };

        entry.frequency += 1;
        entry.pages.push({
          id: page.id,
          title: page.title,
          url: page.url,
          delivery_rate: result.delivery_rate,
        });
        for (const field of pattern.fields || []) {
          entry.fields.add(field);
        }
        entry.observed_evidence_examples.add(pattern.observed_evidence);
        inferredAggregated.set(key, entry);
      }
    }
  }

  const observedCatalog = Array.from(aggregated.values())
    .map((entry) => ({
      blockage_id: entry.blockage_id,
      label: entry.label,
      engine: entry.engine,
      frequency: entry.frequency,
      affected_fields: Array.from(entry.fields).sort(),
      observed_evidence_examples: Array.from(entry.observed_evidence_examples).slice(0, 5),
      inferred_cause: entry.inferred_cause,
      fix_pattern: entry.fix_pattern,
      sample_pages: entry.pages
        .sort((left, right) => (left.delivery_rate ?? 0) - (right.delivery_rate ?? 0))
        .slice(0, 5),
    }))
    .sort((left, right) => right.frequency - left.frequency || left.engine.localeCompare(right.engine));

  const inferredPatterns = Array.from(inferredAggregated.values())
    .map((entry) => ({
      pattern_id: entry.pattern_id,
      label: entry.label,
      engine: entry.engine,
      frequency: entry.frequency,
      affected_fields: Array.from(entry.fields).sort(),
      observed_evidence_examples: Array.from(entry.observed_evidence_examples).slice(0, 5),
      inferred_cause: entry.inferred_cause,
      fix_pattern: entry.fix_pattern,
      sample_pages: entry.pages
        .sort((left, right) => (left.delivery_rate ?? 0) - (right.delivery_rate ?? 0))
        .slice(0, 5),
    }))
    .sort((left, right) => right.frequency - left.frequency || left.engine.localeCompare(right.engine));

  const summary = {
    observed_blockages: summarizeCatalog(observedCatalog),
    inferred_patterns: summarizeCatalog(inferredPatterns, "pattern_id"),
  };

  await writeJson(paths.blockageCatalog, {
    version: "blockage-catalog-v1",
    observed_blockages: observedCatalog,
    inferred_patterns: inferredPatterns,
    per_page: perPage,
  });
  await writeJson(paths.blockageCatalogSummary, summary);

  console.log("[wiki-benchmark] blockage catalog complete");
}

main().catch((error) => {
  console.error("[wiki-benchmark] blockage catalog failed:", error);
  process.exitCode = 1;
});
