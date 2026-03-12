import {
  average,
  classifyExtractionRate,
  loadLocalEnv,
  normalizeExtractionResult,
  parseArgs,
  pearsonCorrelation,
  readJson,
  resolveGroundTruth,
  resolveOutputPaths,
  resolvePilotOptions,
  writeJson,
} from "./wiki-benchmark-lib.mjs";

function toNumeric(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  return 0;
}

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

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("usage: node ./scripts/wiki-benchmark-analyze.mjs --total=100 --batchSize=10");
    return;
  }
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

  const gptMap = buildRateMap(gptResults);
  const geminiMap = buildRateMap(geminiResults);
  const perplexityMap = buildRateMap(perplexityResults);

  const classifications = crawlResults.map((page) => {
    const gpt = hydrateBenchmarkResult(gptMap.get(page.id), page);
    const gemini = hydrateBenchmarkResult(geminiMap.get(page.id), page);
    const perplexity = hydrateBenchmarkResult(perplexityMap.get(page.id), page);
    const avgDeliveryRate = average([
      gpt?.delivery_rate,
      gemini?.delivery_rate,
      perplexity?.delivery_rate,
    ]);
    const avgExtractionRate = average([
      gpt?.extraction_rate,
      gemini?.extraction_rate,
      perplexity?.extraction_rate,
    ]);

    return {
      id: page.id,
      url: page.url,
      lang: page.lang,
      title: page.title,
      category_tier: page.category_tier,
      ground_truth_count: resolveGroundTruth(page, { kind: "wiki" }).field_count,
      avg_delivery_rate: Number(avgDeliveryRate.toFixed(3)),
      avg_extraction_rate: Number(avgExtractionRate.toFixed(3)),
      group: classifyExtractionRate(avgDeliveryRate),
      engines: {
        gpt: {
          delivery_rate: gpt?.delivery_rate ?? null,
          extraction_rate: gpt?.extraction_rate ?? null,
        },
        gemini: {
          delivery_rate: gemini?.delivery_rate ?? null,
          extraction_rate: gemini?.extraction_rate ?? null,
        },
        perplexity: {
          delivery_rate: perplexity?.delivery_rate ?? null,
          extraction_rate: perplexity?.extraction_rate ?? null,
        },
      },
    };
  });

  const grouped = {
    A: classifications.filter((item) => item.group === "A"),
    B: classifications.filter((item) => item.group === "B"),
    C: classifications.filter((item) => item.group === "C"),
  };

  const featureDefinitions = [
    "has_infobox",
    "infobox_field_count",
    "first_paragraph_has_entity_definition",
    "entity_name_in_first_sentence",
    "section_count",
    "word_count",
    "has_bullet_lists",
    "reference_count",
    "internal_link_count",
    "external_link_count",
    "categories_count",
    "text_to_link_ratio",
  ];

  const avgRateById = new Map(classifications.map((item) => [item.id, item.avg_delivery_rate]));
  const featureImpactRanking = featureDefinitions
    .map((feature) => {
      const values = crawlResults.map((page) => toNumeric(page.structural_features?.[feature]));
      const rates = crawlResults.map((page) => avgRateById.get(page.id) ?? 0);
      const { r, pValue } = pearsonCorrelation(values, rates);
      const groupAMean = average(
        grouped.A
          .map((item) => crawlResults.find((page) => page.id === item.id)?.structural_features?.[feature])
          .map(toNumeric)
      );
      const groupCMean = average(
        grouped.C
          .map((item) => crawlResults.find((page) => page.id === item.id)?.structural_features?.[feature])
          .map(toNumeric)
      );
      return {
        feature,
        correlation_r: r,
        p_value: pValue,
        group_a_mean: Number(groupAMean.toFixed(3)),
        group_c_mean: Number(groupCMean.toFixed(3)),
      };
    })
    .sort((left, right) => Math.abs(right.correlation_r) - Math.abs(left.correlation_r))
    .map((item, index) => ({
      rank: index + 1,
      ...item,
      impact_interpretation: `${item.feature}와 avg_delivery_rate의 상관도`,
    }));

  const engineConsistency = {
    pairwise_rate_correlation: {
      gpt_gemini: pearsonCorrelation(
        classifications.map((item) => item.engines.gpt?.delivery_rate ?? 0),
        classifications.map((item) => item.engines.gemini?.delivery_rate ?? 0)
      ),
      gpt_perplexity: pearsonCorrelation(
        classifications.map((item) => item.engines.gpt?.delivery_rate ?? 0),
        classifications.map((item) => item.engines.perplexity?.delivery_rate ?? 0)
      ),
      gemini_perplexity: pearsonCorrelation(
        classifications.map((item) => item.engines.gemini?.delivery_rate ?? 0),
        classifications.map((item) => item.engines.perplexity?.delivery_rate ?? 0)
      ),
    },
    field_agreement: {},
  };

  const fieldDifficulty = [];
  for (const field of [
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
  ]) {
    let matchedCount = 0;
    let eligibleCount = 0;
    let allThreeMatched = 0;
    let twoMatched = 0;
    let oneMatched = 0;
    let noneMatched = 0;

    for (const page of crawlResults) {
      const groundTruth = resolveGroundTruth(page, { kind: "wiki" });
      if (!groundTruth?.fields?.[field]) continue;

      const entries = [
        hydrateBenchmarkResult(gptMap.get(page.id), page),
        hydrateBenchmarkResult(geminiMap.get(page.id), page),
        hydrateBenchmarkResult(perplexityMap.get(page.id), page),
      ];
      const matchedFlags = entries.map((entry) => Boolean(entry?.delivery_evaluation?.[field]?.matched));
      const matchedTotal = matchedFlags.filter(Boolean).length;

      eligibleCount += entries.length;
      matchedCount += matchedTotal;

      if (matchedTotal === 3) allThreeMatched += 1;
      else if (matchedTotal === 2) twoMatched += 1;
      else if (matchedTotal === 1) oneMatched += 1;
      else noneMatched += 1;
    }

    const successRate = matchedCount / Math.max(1, eligibleCount);
    fieldDifficulty.push({
      field,
      eligible_ground_truth_pages: crawlResults.filter((page) => resolveGroundTruth(page, { kind: "wiki" })?.fields?.[field]).length,
      overall_success_rate: Number(successRate.toFixed(3)),
      difficulty: successRate >= 0.8 ? "easy" : successRate >= 0.5 ? "medium" : "hard",
    });

    engineConsistency.field_agreement[field] = {
      all_three_matched: allThreeMatched,
      two_matched: twoMatched,
      one_matched: oneMatched,
      none_matched: noneMatched,
    };
  }

  const analysisSummary = {
    total_pages: classifications.length,
    groups: {
      A: {
        count: grouped.A.length,
        avg_delivery_rate: Number(average(grouped.A.map((item) => item.avg_delivery_rate)).toFixed(3)),
      },
      B: {
        count: grouped.B.length,
        avg_delivery_rate: Number(average(grouped.B.map((item) => item.avg_delivery_rate)).toFixed(3)),
      },
      C: {
        count: grouped.C.length,
        avg_delivery_rate: Number(average(grouped.C.map((item) => item.avg_delivery_rate)).toFixed(3)),
      },
    },
    top_features: featureImpactRanking.slice(0, 5),
    hardest_fields: [...fieldDifficulty].sort((left, right) => left.overall_success_rate - right.overall_success_rate).slice(0, 5),
  };

  await writeJson(paths.classificationResults, classifications);
  await writeJson(paths.featureImpactRanking, { feature_impact_ranking: featureImpactRanking });
  await writeJson(paths.engineConsistency, engineConsistency);
  await writeJson(paths.fieldDifficulty, { field_difficulty: fieldDifficulty });
  await writeJson(paths.analysisSummary, analysisSummary);

  console.log("[wiki-benchmark] analysis complete");
}

main().catch((error) => {
  console.error("[wiki-benchmark] analyze failed", error);
  process.exitCode = 1;
});
