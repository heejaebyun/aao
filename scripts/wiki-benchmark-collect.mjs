import {
  batchHydrateCandidateSelectionSignals,
  PILOT_SELECTION_PLAN,
  WIKI_CATEGORY_SEEDS,
  collectCategoryPages,
  createWikiApiClient,
  ensureDir,
  enrichSelectedWikiPages,
  loadLocalEnv,
  parseArgs,
  readJson,
  resolveOutputPaths,
  resolvePilotOptions,
  summarizeSelection,
  writeJson,
} from "./wiki-benchmark-lib.mjs";

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("usage: node ./scripts/wiki-benchmark-collect.mjs --total=100 --batchSize=10 [--refresh]");
    return;
  }
  await loadLocalEnv();
  const options = resolvePilotOptions(args);
  const paths = resolveOutputPaths(options);

  await ensureDir(paths.root);
  await ensureDir(paths.partialsDir);

  if (!options.refresh) {
    const existing = await readJson(paths.urls, null);
    if (Array.isArray(existing) && existing.length) {
      console.log(`[wiki-benchmark] existing URL set found: ${existing.length} pages`);
      return;
    }
  }

  const clients = {
    ko: createWikiApiClient({ lang: "ko" }),
    en: createWikiApiClient({ lang: "en" }),
  };

  const poolByPlanKey = new Map();
  for (const plan of PILOT_SELECTION_PLAN) {
    const seeds = WIKI_CATEGORY_SEEDS[plan.lang]?.[plan.tier] || [];
    const key = `${plan.lang}:${plan.tier}`;
    const records = await collectCategoryPages({
      client: clients[plan.lang],
      lang: plan.lang,
      tier: plan.tier,
      seeds,
      maxDepth: options.maxDepth,
      limitPerSeed: Math.max(plan.count * 4, options.limitPerSeed),
    });
    poolByPlanKey.set(key, records);
    console.log(`[wiki-benchmark] collected ${records.length} candidates for ${key}`);
  }

  const selected = [];
  const used = new Set();
  for (const plan of PILOT_SELECTION_PLAN) {
    const key = `${plan.lang}:${plan.tier}`;
    const pool = poolByPlanKey.get(key) || [];
    const hydratedPool = await batchHydrateCandidateSelectionSignals(
      pool.slice(0, Math.max(plan.count * 6, 30)),
      { batchSize: 20 }
    );
    const rankedPool = hydratedPool.sort((left, right) => {
      if (right.weak_selection_score !== left.weak_selection_score) {
        return right.weak_selection_score - left.weak_selection_score;
      }
      return left.selection_rank.localeCompare(right.selection_rank);
    });
    const picked = [];

    for (const candidate of rankedPool) {
      const pageKey = `${candidate.lang}:${candidate.title}`;
      if (used.has(pageKey)) continue;
      picked.push(candidate);
      used.add(pageKey);
      if (picked.length >= plan.count) break;
    }

    selected.push(...picked);
    console.log(`[wiki-benchmark] selected ${picked.length}/${plan.count} for ${key}`);
  }

  if (selected.length < options.totalPages) {
    const leftovers = await batchHydrateCandidateSelectionSignals(
      [...poolByPlanKey.values()].flat().slice(0, options.totalPages * 8),
      { batchSize: 20 }
    );
    leftovers.sort((left, right) => {
      if (right.weak_selection_score !== left.weak_selection_score) {
        return right.weak_selection_score - left.weak_selection_score;
      }
      return left.selection_rank.localeCompare(right.selection_rank);
    });
    for (const candidate of leftovers) {
      const pageKey = `${candidate.lang}:${candidate.title}`;
      if (used.has(pageKey)) continue;
      selected.push(candidate);
      used.add(pageKey);
      if (selected.length >= options.totalPages) break;
    }
  }

  const finalSelection = selected.slice(0, options.totalPages);
  const enriched = await enrichSelectedWikiPages(finalSelection, options);
  const selectionSummary = summarizeSelection(enriched);

  await writeJson(paths.urls, enriched);
  await writeJson(paths.selectionSummary, selectionSummary);

  console.log(`[wiki-benchmark] saved ${enriched.length} URLs -> ${paths.urls}`);
}

main().catch((error) => {
  console.error("[wiki-benchmark] collect failed", error);
  process.exitCode = 1;
});
