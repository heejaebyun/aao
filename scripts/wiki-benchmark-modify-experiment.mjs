import path from "node:path";
import {
  ENGINE_DELAY_MS,
  average,
  ensureDir,
  extractWikiBenchmarkRecord,
  loadLocalEnv,
  normalizeExtractionResult,
  parseArgs,
  readJson,
  resolveGroundTruth,
  resolveOutputPaths,
  resolvePilotOptions,
  sleep,
  writeJson,
} from "./wiki-benchmark-lib.mjs";

const STAGE_ORDER = ["original", "step_a", "step_b", "step_c", "step_d"];
const INFObOX_KEY_MAP = {
  entity_type: ["산업 분야", "서비스", "업종", "종류", "Industry", "Services", "Type"],
  founded: ["창립", "설립", "설립일", "Founded"],
  headquarters: ["본사 소재지", "본사", "본부", "Headquarters"],
  ceo_or_leader: ["핵심 인물", "대표", "대표이사", "CEO", "Key people"],
  employee_count: ["직원 수", "종업원 수", "사원수", "Employees"],
  revenue: ["매출액", "Revenue"],
  parent_company: ["모회사", "Parent", "Parent company"],
  key_products: ["제품", "서비스", "Products", "Services"],
};
const STEP_LABELS = {
  original: "원본",
  step_a: "엔티티 정의 추가",
  step_b: "인포박스 시뮬레이션",
  step_c: "섹션 구조화",
  step_d: "내부 참조 강화",
};

function buildEngineMaps(root) {
  return Promise.all([
    readJson(path.join(root, "extraction_results_gpt.json"), []),
    readJson(path.join(root, "extraction_results_gemini.json"), []),
    readJson(path.join(root, "extraction_results_perplexity.json"), []),
  ]).then(([gpt, gemini, perplexity]) => ({
    gpt: new Map(gpt.map((item) => [item.id, item])),
    gemini: new Map(gemini.map((item) => [item.id, item])),
    perplexity: new Map(perplexity.map((item) => [item.id, item])),
  }));
}

function resolvePageGroundTruth(page) {
  return resolveGroundTruth(page, { kind: "wiki" });
}

function normalizeScalar(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item || "").trim()).filter(Boolean);
    return items.length ? items : null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function pickInfoboxValue(page, field) {
  const infobox = page?.infobox || {};
  for (const key of INFObOX_KEY_MAP[field] || []) {
    const value = normalizeScalar(infobox[key]);
    if (value) return value;
  }
  return null;
}

function serializeValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value ?? "");
}

function pickConsensusField(page, engineMaps, field) {
  const infoboxValue = pickInfoboxValue(page, field);
  if (infoboxValue) return infoboxValue;

  const votes = new Map();
  for (const engine of ["gpt", "gemini", "perplexity"]) {
    const value = normalizeScalar(engineMaps[engine]?.get(page.id)?.parsed_extraction?.[field]?.value);
    if (!value) continue;
    const key = serializeValue(value);
    votes.set(key, { count: (votes.get(key)?.count || 0) + 1, value });
  }

  const sorted = [...votes.values()].sort((left, right) => right.count - left.count);
  return sorted[0]?.value || null;
}

function buildConsensusFacts(page, engineMaps) {
  return {
    entity_name: normalizeScalar(page.title),
    entity_type: pickConsensusField(page, engineMaps, "entity_type"),
    founded: pickConsensusField(page, engineMaps, "founded"),
    headquarters: pickConsensusField(page, engineMaps, "headquarters"),
    key_products: normalizeScalar(pickConsensusField(page, engineMaps, "key_products")),
    description: pickConsensusField(page, engineMaps, "description") || normalizeScalar(page.first_paragraph),
    ceo_or_leader: pickConsensusField(page, engineMaps, "ceo_or_leader"),
    employee_count: pickConsensusField(page, engineMaps, "employee_count"),
    revenue: pickConsensusField(page, engineMaps, "revenue"),
    parent_company: pickConsensusField(page, engineMaps, "parent_company"),
  };
}

function hasHangulBatchim(char) {
  const code = char?.charCodeAt?.(0);
  if (!code || code < 0xac00 || code > 0xd7a3) return null;
  return ((code - 0xac00) % 28) !== 0;
}

function appendKoreanTopicParticle(text) {
  const lastChar = String(text || "").trim().slice(-1);
  const hasBatchim = hasHangulBatchim(lastChar);
  if (hasBatchim === null) return `${text}는`;
  return `${text}${hasBatchim ? "은" : "는"}`;
}

function normalizeKoreanType(type) {
  const normalized = String(type || "")
    .replace(/[.。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(회사|기업|브랜드)\s*$/u, "")
    .trim();
  return normalized || null;
}

function normalizeEnglishType(type) {
  const normalized = String(type || "")
    .replace(/[.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(company|corporation|business|brand)\b$/i, "")
    .trim();
  return normalized || null;
}

function splitSentences(text) {
  const chunks = String(text || "")
    .replace(/\s+/g, " ")
    .match(/[^.!?。]+[.!?。]?/g);
  return Array.isArray(chunks) ? chunks.map((item) => item.trim()).filter(Boolean) : [];
}

function buildKoreanEntityDefinition(facts) {
  const name = facts.entity_name || "이 기업";
  const subject = appendKoreanTopicParticle(name);
  const type = normalizeKoreanType(facts.entity_type);
  const hq = facts.headquarters;
  if (hq && type) return `${subject} ${hq}에 본사를 둔 ${type} 기업이다.`;
  if (type) return `${subject} ${type} 기업이다.`;
  if (hq) return `${subject} ${hq}에 본사를 둔 기업이다.`;
  return `${subject} 기업이다.`;
}

function buildEnglishEntityDefinition(facts) {
  const name = facts.entity_name || "This company";
  const type = normalizeEnglishType(facts.entity_type);
  const hq = facts.headquarters;
  if (hq && type) return `${name} is a ${type} company based in ${hq}.`;
  if (type) return `${name} is a ${type} company.`;
  if (hq) return `${name} is a company based in ${hq}.`;
  return `${name} is a company.`;
}

function applyStepA(page, facts, text) {
  if (page?.structural_features?.first_paragraph_has_entity_definition) {
    return {
      text,
      applied: false,
      note: "첫 문단 정의가 이미 존재해 Step A를 건너뜀",
    };
  }

  const definition = page.lang === "en"
    ? buildEnglishEntityDefinition(facts)
    : buildKoreanEntityDefinition(facts);

  return {
    text: `${definition}\n\n${text}`.trim(),
    applied: true,
    note: definition,
  };
}

function buildInfoLines(page, facts) {
  const labels = page.lang === "en"
    ? [
        ["Company", facts.entity_name],
        ["Founded", facts.founded],
        ["Headquarters", facts.headquarters],
        ["Leader", facts.ceo_or_leader],
        ["Industry", facts.entity_type],
        ["Employees", facts.employee_count],
        ["Revenue", facts.revenue],
      ]
    : [
        ["회사명", facts.entity_name],
        ["설립", facts.founded],
        ["본사", facts.headquarters],
        ["대표", facts.ceo_or_leader],
        ["업종", facts.entity_type],
        ["직원수", facts.employee_count],
        ["매출", facts.revenue],
      ];

  return labels
    .filter(([, value]) => normalizeScalar(value))
    .map(([label, value]) => `${label}: ${Array.isArray(value) ? value.join(", ") : value}`);
}

function applyStepB(page, facts, text) {
  if (page?.structural_features?.has_infobox) {
    return {
      text,
      applied: false,
      note: "원본에 인포박스가 있어 Step B를 건너뜀",
    };
  }

  const lines = buildInfoLines(page, facts);
  if (lines.length < 3) {
    return {
      text,
      applied: false,
      note: "구조화 블록으로 올릴 원본 필드가 부족해 Step B를 건너뜀",
    };
  }

  const heading = page.lang === "en" ? "[Company Facts]" : "[기업 정보]";
  const block = [heading, ...lines].join("\n");
  return {
    text: `${block}\n\n${text}`.trim(),
    applied: true,
    note: `${lines.length}개 필드로 구조화 블록 추가`,
  };
}

function chunkSentencesForSections(sentences, maxSections = 5) {
  if (!sentences.length) return [];
  const sectionCount = Math.min(maxSections, Math.max(2, Math.ceil(sentences.length / 3)));
  const perChunk = Math.ceil(sentences.length / sectionCount);
  const chunks = [];
  for (let index = 0; index < sentences.length; index += perChunk) {
    chunks.push(sentences.slice(index, index + perChunk).join(" ").trim());
  }
  return chunks.filter(Boolean);
}

function applyStepC(page, text) {
  if (page?.structural_features?.section_count > 2) {
    return {
      text,
      applied: false,
      note: "원본에 섹션 구조가 있어 Step C를 건너뜀",
    };
  }

  const sentences = splitSentences(text);
  if (sentences.length < 4) {
    return {
      text,
      applied: false,
      note: "문장 수가 적어 섹션 구조화 이득이 적어 Step C를 건너뜀",
    };
  }

  const headings = page.lang === "en"
    ? ["[Overview]", "[History]", "[Products and Services]", "[Organization]", "[Other]"]
    : ["[개요]", "[역사]", "[주요 제품 및 서비스]", "[조직 및 경영]", "[기타]"];
  const chunks = chunkSentencesForSections(sentences, headings.length);
  const withSections = chunks.map((chunk, index) => `${headings[index]}\n${chunk}`).join("\n\n");
  return {
    text: withSections.trim(),
    applied: true,
    note: `${chunks.length}개 섹션 헤딩 추가`,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyStepD(page, text) {
  const anchors = [...new Set((page.internal_links || []).map((item) => String(item.anchor || "").trim()))]
    .filter((anchor) => anchor.length >= 2 && anchor.length <= 40)
    .filter((anchor) => !/^\d+$/.test(anchor))
    .sort((left, right) => right.length - left.length);

  if (!anchors.length) {
    return {
      text,
      applied: false,
      note: "내부 참조 앵커가 없어 Step D를 건너뜀",
    };
  }

  let nextText = text;
  let appliedCount = 0;
  for (const anchor of anchors) {
    if (appliedCount >= 20) break;
    if (nextText.includes(`[[${anchor}]]`)) continue;
    const regex = new RegExp(escapeRegExp(anchor));
    if (!regex.test(nextText)) continue;
    nextText = nextText.replace(regex, `[[${anchor}]]`);
    appliedCount += 1;
  }

  if (!appliedCount) {
    return {
      text,
      applied: false,
      note: "본문에 삽입 가능한 내부 참조가 없어 Step D를 건너뜀",
    };
  }

  return {
    text: nextText,
    applied: true,
    note: `위키 스타일 내부 참조 ${appliedCount}개 추가`,
  };
}

function toStageExtraction(entry, groundTruth) {
  if (!entry) return null;
  const normalized = normalizeExtractionResult(entry.parsed_extraction || entry.parsed || {}, groundTruth);
  return {
    extraction_rate: normalized.extraction_rate ?? entry.extraction_rate ?? 0,
    delivery_rate: normalized.delivery_rate ?? entry.delivery_rate ?? null,
    field_count_present: normalized.field_count_present ?? entry.field_count_present ?? 0,
    field_count_missing: normalized.field_count_missing ?? entry.field_count_missing ?? 0,
    status: entry.status || "error",
    parsed_extraction: normalized.parsed_extraction || entry.parsed_extraction || {},
    ground_truth_fields: normalized.ground_truth_fields || entry.ground_truth_fields || [],
    ground_truth_count: normalized.ground_truth_count ?? entry.ground_truth_count ?? 0,
    matched_fields: normalized.matched_fields || entry.matched_fields || [],
    missed_fields: normalized.missed_fields || entry.missed_fields || [],
    delivery_evaluation: normalized.delivery_evaluation || entry.delivery_evaluation || {},
    delivery_field_count_matched: normalized.delivery_field_count_matched ?? entry.delivery_field_count_matched ?? 0,
    delivery_field_count_missed: normalized.delivery_field_count_missed ?? entry.delivery_field_count_missed ?? 0,
    raw_response: entry.raw_response || "",
    latency_ms: entry.latency_ms ?? null,
  };
}

function summarizeStageMetrics(extractions) {
  const extractionRates = Object.values(extractions)
    .map((entry) => entry?.extraction_rate)
    .filter((value) => Number.isFinite(value));
  const deliveryRates = Object.values(extractions)
    .map((entry) => entry?.delivery_rate)
    .filter((value) => Number.isFinite(value));
  return {
    avg_extraction_rate: extractionRates.length ? Number(average(extractionRates).toFixed(3)) : null,
    avg_delivery_rate: deliveryRates.length ? Number(average(deliveryRates).toFixed(3)) : null,
  };
}

async function runStageExtractions(target, stage, text, options) {
  if (options.dryRun) {
    return {
      gpt: null,
      gemini: null,
      perplexity: null,
    };
  }

  const extractions = {};
  for (const engine of ["gpt", "gemini", "perplexity"]) {
    extractions[engine] = toStageExtraction(await extractWikiBenchmarkRecord({
      engine,
      id: target.id,
      url: target.url,
      text,
      groundTruth: options.groundTruth,
      metadata: {
        modification_step: stage,
      },
    }), options.groundTruth);
    await sleep(ENGINE_DELAY_MS[engine]);
  }
  return extractions;
}

function buildStepProgression(stageResults) {
  let previous = null;
  return STAGE_ORDER.map((stage) => {
    const current = stageResults[stage];
    const avgDeliveryRate = Number.isFinite(current?.avg_delivery_rate) ? current.avg_delivery_rate : null;
    const avgExtractionRate = Number.isFinite(current?.avg_extraction_rate) ? current.avg_extraction_rate : null;
    const delta = previous === null || avgDeliveryRate === null ? null : Number((avgDeliveryRate - previous).toFixed(3));
    if (avgDeliveryRate !== null) {
      previous = avgDeliveryRate;
    }
    return {
      stage,
      label: STEP_LABELS[stage],
      avg_delivery_rate: avgDeliveryRate,
      avg_extraction_rate: avgExtractionRate,
      delta_from_previous: delta,
      applied: Boolean(current?.applied),
      note: current?.note || "",
    };
  });
}

function aggregateStepEffectiveness(results) {
  const buckets = Object.fromEntries(
    STAGE_ORDER.map((stage) => [stage, {
      count: 0,
      delivery_rate_count: 0,
      extraction_rate_count: 0,
      delta_count: 0,
      avg_delivery_rate_sum: 0,
      avg_extraction_rate_sum: 0,
      delta_sum: 0,
      applied_count: 0,
    }])
  );

  for (const item of results) {
    for (const step of item.progression) {
      const bucket = buckets[step.stage];
      bucket.count += 1;
      if (Number.isFinite(step.avg_delivery_rate)) {
        bucket.avg_delivery_rate_sum += step.avg_delivery_rate;
        bucket.delivery_rate_count += 1;
      }
      if (Number.isFinite(step.avg_extraction_rate)) {
        bucket.avg_extraction_rate_sum += step.avg_extraction_rate;
        bucket.extraction_rate_count += 1;
      }
      if (Number.isFinite(step.delta_from_previous)) {
        bucket.delta_sum += step.delta_from_previous;
        bucket.delta_count += 1;
      }
      if (step.applied) bucket.applied_count += 1;
    }
  }

  return STAGE_ORDER.map((stage) => {
    const bucket = buckets[stage];
    return {
      stage,
      label: STEP_LABELS[stage],
      page_count: bucket.count,
      applied_count: bucket.applied_count,
      avg_delivery_rate: bucket.delivery_rate_count
        ? Number((bucket.avg_delivery_rate_sum / bucket.delivery_rate_count).toFixed(3))
        : null,
      avg_extraction_rate: bucket.extraction_rate_count
        ? Number((bucket.avg_extraction_rate_sum / bucket.extraction_rate_count).toFixed(3))
        : null,
      avg_delta_from_previous: bucket.delta_count
        ? Number((bucket.delta_sum / bucket.delta_count).toFixed(3))
        : null,
    };
  });
}

function hydratePersistedStageResult(stageResult, groundTruth) {
  const extractions = {};
  for (const engine of ["gpt", "gemini", "perplexity"]) {
    extractions[engine] = toStageExtraction(stageResult?.extractions?.[engine], groundTruth);
  }
  const metrics = summarizeStageMetrics(extractions);
  return {
    ...stageResult,
    extractions,
    ...metrics,
  };
}

function hydratePersistedExperimentResult(item, groundTruth) {
  const stageResults = Object.fromEntries(
    STAGE_ORDER.map((stage) => [stage, hydratePersistedStageResult(item?.stage_results?.[stage] || {}, groundTruth)])
  );
  const progression = buildStepProgression(stageResults);
  const totalImprovement = Number.isFinite(stageResults.step_d?.avg_delivery_rate) && Number.isFinite(stageResults.original?.avg_delivery_rate)
    ? Number((stageResults.step_d.avg_delivery_rate - stageResults.original.avg_delivery_rate).toFixed(3))
    : null;
  const bestStep = progression
    .filter((step) => step.stage !== "original")
    .reduce((best, step) => {
      if (!Number.isFinite(step.delta_from_previous)) return best;
      return step.delta_from_previous > (best?.delta_from_previous ?? -Infinity) ? step : best;
    }, null);

  return {
    ...item,
    stage_results: stageResults,
    progression,
    total_improvement: totalImprovement,
    reached_group_a_threshold: Number.isFinite(stageResults.step_d?.avg_delivery_rate)
      ? stageResults.step_d.avg_delivery_rate >= 0.75
      : null,
    most_impactful_step: bestStep?.stage || null,
    most_impactful_step_delta: bestStep?.delta_from_previous ?? null,
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("usage: node ./scripts/wiki-benchmark-modify-experiment.mjs --total=100 --batchSize=10 [--refresh] [--limitTargets=30] [--dryRun]");
    return;
  }

  await loadLocalEnv();
  const options = resolvePilotOptions(args);
  const paths = resolveOutputPaths(options);
  const limitTargets = Number(args.limitTargets || 30);
  const dryRun = Boolean(args.dryRun);

  const [targets, crawlResults, existingResults] = await Promise.all([
    readJson(paths.modificationTargets, []),
    readJson(paths.crawlResults, []),
    readJson(paths.modificationResults, []),
  ]);
  if (!Array.isArray(targets) || !targets.length) {
    throw new Error(`수정 실험 대상이 없습니다: ${paths.modificationTargets}`);
  }
  if (!Array.isArray(crawlResults) || !crawlResults.length) {
    throw new Error(`크롤링 결과가 없습니다: ${paths.crawlResults}`);
  }

  await ensureDir(paths.root);
  await ensureDir(paths.partialsDir);

  const engineMaps = await buildEngineMaps(paths.root);
  const crawlMap = new Map(crawlResults.map((page) => [page.id, page]));
  const workingTargets = targets.slice(0, limitTargets);
  const existingHydrated = options.refresh
    ? []
    : (Array.isArray(existingResults) ? existingResults : [])
      .map((item) => {
        const page = crawlMap.get(item.id);
        if (!page) return item;
        return hydratePersistedExperimentResult(item, resolvePageGroundTruth(page));
      });
  const resultMap = new Map(existingHydrated.map((item) => [item.id, item]));

  for (const [index, target] of workingTargets.entries()) {
    if (resultMap.has(target.id) && !options.refresh) continue;

    const page = crawlMap.get(target.id);
    if (!page) continue;
    const groundTruth = resolvePageGroundTruth(page);
    const facts = buildConsensusFacts(page, engineMaps);
    const originalText = String(page.plain_text || "").trim();

    const originalExtractions = {
      gpt: toStageExtraction(engineMaps.gpt.get(target.id), groundTruth),
      gemini: toStageExtraction(engineMaps.gemini.get(target.id), groundTruth),
      perplexity: toStageExtraction(engineMaps.perplexity.get(target.id), groundTruth),
    };
    const originalMetrics = summarizeStageMetrics(originalExtractions);

    const stageResults = {
      original: {
        stage: "original",
        label: STEP_LABELS.original,
        modified_text: originalText,
        modifications_applied: [],
        applied: false,
        note: "원본 텍스트",
        extractions: originalExtractions,
        ...originalMetrics,
      },
    };

    const stepA = applyStepA(page, facts, stageResults.original.modified_text);
    stageResults.step_a = stepA.applied
      ? {
          stage: "step_a",
          label: STEP_LABELS.step_a,
          modified_text: stepA.text,
          modifications_applied: ["step_a"],
          applied: true,
          note: stepA.note,
          extractions: await runStageExtractions(target, "step_a", stepA.text, { dryRun, groundTruth }),
        }
      : {
          stage: "step_a",
          label: STEP_LABELS.step_a,
          modified_text: stageResults.original.modified_text,
          modifications_applied: [],
          applied: false,
          note: stepA.note,
          extractions: stageResults.original.extractions,
          avg_delivery_rate: stageResults.original.avg_delivery_rate,
          avg_extraction_rate: stageResults.original.avg_extraction_rate,
        };
    if (stepA.applied) {
      Object.assign(stageResults.step_a, summarizeStageMetrics(stageResults.step_a.extractions));
    }

    const stepB = applyStepB(page, facts, stageResults.step_a.modified_text);
    stageResults.step_b = stepB.applied
      ? {
          stage: "step_b",
          label: STEP_LABELS.step_b,
          modified_text: stepB.text,
          modifications_applied: ["step_a", "step_b"].filter((step) => step === "step_b" || stageResults.step_a.applied),
          applied: true,
          note: stepB.note,
          extractions: await runStageExtractions(target, "step_b", stepB.text, { dryRun, groundTruth }),
        }
      : {
          stage: "step_b",
          label: STEP_LABELS.step_b,
          modified_text: stageResults.step_a.modified_text,
          modifications_applied: [...stageResults.step_a.modifications_applied],
          applied: false,
          note: stepB.note,
          extractions: stageResults.step_a.extractions,
          avg_delivery_rate: stageResults.step_a.avg_delivery_rate,
          avg_extraction_rate: stageResults.step_a.avg_extraction_rate,
        };
    if (stepB.applied) {
      Object.assign(stageResults.step_b, summarizeStageMetrics(stageResults.step_b.extractions));
    }

    const stepC = applyStepC(page, stageResults.step_b.modified_text);
    stageResults.step_c = stepC.applied
      ? {
          stage: "step_c",
          label: STEP_LABELS.step_c,
          modified_text: stepC.text,
          modifications_applied: [...stageResults.step_b.modifications_applied, "step_c"],
          applied: true,
          note: stepC.note,
          extractions: await runStageExtractions(target, "step_c", stepC.text, { dryRun, groundTruth }),
        }
      : {
          stage: "step_c",
          label: STEP_LABELS.step_c,
          modified_text: stageResults.step_b.modified_text,
          modifications_applied: [...stageResults.step_b.modifications_applied],
          applied: false,
          note: stepC.note,
          extractions: stageResults.step_b.extractions,
          avg_delivery_rate: stageResults.step_b.avg_delivery_rate,
          avg_extraction_rate: stageResults.step_b.avg_extraction_rate,
        };
    if (stepC.applied) {
      Object.assign(stageResults.step_c, summarizeStageMetrics(stageResults.step_c.extractions));
    }

    const stepD = applyStepD(page, stageResults.step_c.modified_text);
    stageResults.step_d = stepD.applied
      ? {
          stage: "step_d",
          label: STEP_LABELS.step_d,
          modified_text: stepD.text,
          modifications_applied: [...stageResults.step_c.modifications_applied, "step_d"],
          applied: true,
          note: stepD.note,
          extractions: await runStageExtractions(target, "step_d", stepD.text, { dryRun, groundTruth }),
        }
      : {
          stage: "step_d",
          label: STEP_LABELS.step_d,
          modified_text: stageResults.step_c.modified_text,
          modifications_applied: [...stageResults.step_c.modifications_applied],
          applied: false,
          note: stepD.note,
          extractions: stageResults.step_c.extractions,
          avg_delivery_rate: stageResults.step_c.avg_delivery_rate,
          avg_extraction_rate: stageResults.step_c.avg_extraction_rate,
        };
    if (stepD.applied) {
      Object.assign(stageResults.step_d, summarizeStageMetrics(stageResults.step_d.extractions));
    }

    const progression = buildStepProgression(stageResults);
    const totalImprovement = Number.isFinite(stageResults.step_d.avg_delivery_rate) && Number.isFinite(stageResults.original.avg_delivery_rate)
      ? Number((stageResults.step_d.avg_delivery_rate - stageResults.original.avg_delivery_rate).toFixed(3))
      : null;
    const bestStep = progression
      .filter((step) => step.stage !== "original")
      .reduce((best, step) => {
        if (!Number.isFinite(step.delta_from_previous)) return best;
        return step.delta_from_previous > (best?.delta_from_previous ?? -Infinity) ? step : best;
      }, null);

    resultMap.set(target.id, {
      id: target.id,
      title: target.title,
      url: target.url,
      lang: target.lang,
      group: target.group,
      source_group: target.source_group || (String(target.selection_bucket || "").startsWith("C_") ? "C" : target.selection_bucket === "B_fill" ? "B" : null),
      source_bucket: target.selection_bucket,
      target_rank: target.target_rank,
      word_count: target.word_count,
      stage_results: stageResults,
      progression,
      total_improvement: totalImprovement,
      reached_group_a_threshold: Number.isFinite(stageResults.step_d.avg_delivery_rate)
        ? stageResults.step_d.avg_delivery_rate >= 0.75
        : null,
      most_impactful_step: bestStep?.stage || null,
      most_impactful_step_delta: bestStep?.delta_from_previous ?? null,
      dry_run: dryRun,
    });

    const sortedResults = [...resultMap.values()].sort((left, right) => left.target_rank - right.target_rank);
    await writeJson(paths.modificationResults, sortedResults);
    await writeJson(
      path.join(paths.partialsDir, `modification_results_after_target_${String(index + 1).padStart(2, "0")}.json`),
      sortedResults
    );
    console.log(`[wiki-benchmark] modification target ${index + 1}/${workingTargets.length} complete (${target.id})`);
  }

  const finalResults = [...resultMap.values()].sort((left, right) => left.target_rank - right.target_rank);
  const stepEffectiveness = aggregateStepEffectiveness(finalResults);
  const pageProgression = finalResults.map((item) => ({
    id: item.id,
    title: item.title,
    source_bucket: item.source_bucket,
    progression: item.progression,
    total_improvement: item.total_improvement,
    reached_group_a_threshold: item.reached_group_a_threshold,
    most_impactful_step: item.most_impactful_step,
    most_impactful_step_delta: item.most_impactful_step_delta,
  }));
  const calibrationData = finalResults.map((item) => ({
    id: item.id,
    title: item.title,
    source_bucket: item.source_bucket,
    original_delivery_rate: item.stage_results.original.avg_delivery_rate,
    step_a_delivery_rate: item.stage_results.step_a.avg_delivery_rate,
    step_b_delivery_rate: item.stage_results.step_b.avg_delivery_rate,
    step_c_delivery_rate: item.stage_results.step_c.avg_delivery_rate,
    step_d_delivery_rate: item.stage_results.step_d.avg_delivery_rate,
    original_extraction_rate: item.stage_results.original.avg_extraction_rate,
    step_a_extraction_rate: item.stage_results.step_a.avg_extraction_rate,
    step_b_extraction_rate: item.stage_results.step_b.avg_extraction_rate,
    step_c_extraction_rate: item.stage_results.step_c.avg_extraction_rate,
    step_d_extraction_rate: item.stage_results.step_d.avg_extraction_rate,
    total_improvement: item.total_improvement,
  }));
  const experimentSummary = {
    total_targets: finalResults.length,
    dry_run: dryRun,
    target_breakdown: {
      c_content_sparse: finalResults.filter((item) => item.source_bucket === "C_content_sparse").length,
      c_structure_weak: finalResults.filter((item) => item.source_bucket === "C_structure_weak").length,
      b_fill: finalResults.filter((item) => item.source_bucket === "B_fill").length,
    },
    average_original_delivery_rate: Number(average(finalResults.map((item) => item.stage_results.original.avg_delivery_rate)).toFixed(3)),
    average_final_delivery_rate: dryRun
      ? null
      : Number(average(finalResults.map((item) => item.stage_results.step_d.avg_delivery_rate)).toFixed(3)),
    average_total_delivery_improvement: dryRun
      ? null
      : Number(average(finalResults.map((item) => item.total_improvement)).toFixed(3)),
    average_original_rate: Number(average(finalResults.map((item) => item.stage_results.original.avg_delivery_rate)).toFixed(3)),
    average_final_rate: dryRun
      ? null
      : Number(average(finalResults.map((item) => item.stage_results.step_d.avg_delivery_rate)).toFixed(3)),
    average_total_improvement: dryRun
      ? null
      : Number(average(finalResults.map((item) => item.total_improvement)).toFixed(3)),
    reached_group_a_threshold_count: dryRun
      ? null
      : finalResults.filter((item) => item.reached_group_a_threshold).length,
  };

  await writeJson(paths.modificationResults, finalResults);
  await writeJson(paths.stepEffectiveness, stepEffectiveness);
  await writeJson(paths.pageProgression, pageProgression);
  await writeJson(paths.calibrationData, calibrationData);
  await writeJson(paths.experimentSummary, experimentSummary);

  console.log(`[wiki-benchmark] modification experiment complete (${finalResults.length} targets)`);
}

main().catch((error) => {
  console.error("[wiki-benchmark] modify experiment failed", error);
  process.exitCode = 1;
});
