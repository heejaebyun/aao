import path from "node:path";
import {
  DEFAULT_MAX_INPUT_CHARS,
  ENGINE_DELAY_MS,
  ENGINE_RESULT_FILE,
  chunk,
  ensureDir,
  extractWikiBenchmarkRecord,
  loadLocalEnv,
  normalizeExtractionResult,
  nowIso,
  parseArgs,
  readJson,
  resolveGroundTruth,
  resolveOutputPaths,
  resolvePilotOptions,
  sleep,
  summarizeExtractionResults,
  writeJson,
} from "./wiki-benchmark-lib.mjs";

function pickEngine(args) {
  const engine = String(args.engine || "").trim().toLowerCase();
  if (!engine || !ENGINE_RESULT_FILE[engine]) {
    throw new Error("--engine=gpt|gemini|perplexity 가 필요합니다.");
  }
  return engine;
}

function hydrateExtractionResult(entry, page) {
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
    console.log("usage: node ./scripts/wiki-benchmark-extract.mjs --engine=gpt|gemini|perplexity --total=100 --batchSize=10 [--refresh]");
    return;
  }
  await loadLocalEnv();
  const engine = pickEngine(args);
  const options = resolvePilotOptions(args);
  const paths = resolveOutputPaths(options);
  const resultFile = path.join(paths.root, ENGINE_RESULT_FILE[engine]);

  await ensureDir(paths.root);
  await ensureDir(paths.partialsDir);

  const crawlResults = await readJson(paths.crawlResults, []);
  if (!Array.isArray(crawlResults) || !crawlResults.length) {
    throw new Error(`크롤링 결과가 없습니다: ${paths.crawlResults}`);
  }

  const crawlMap = new Map(crawlResults.map((page) => [page.id, page]));
  const existingResults = await readJson(resultFile, []);
  const errors = await readJson(paths.extractionErrors, []);
  const hydratedExisting = (Array.isArray(existingResults) ? existingResults : []).map((item) => {
    const page = crawlMap.get(item.id);
    return page ? hydrateExtractionResult(item, page) : item;
  });
  const resultMap = new Map(hydratedExisting.map((item) => [item.id, item]));
  const errorList = Array.isArray(errors) ? errors : [];

  const batches = chunk(crawlResults, options.batchSize);
  for (const [batchIndex, batch] of batches.entries()) {
    const batchLabel = String(batchIndex + 1).padStart(2, "0");

    for (const page of batch) {
      if (resultMap.has(page.id) && !options.refresh) continue;

      try {
        const result = await extractWikiBenchmarkRecord({
          engine,
          id: page.id,
          url: page.url,
          text: page.plain_text,
          groundTruth: resolveGroundTruth(page, { kind: "wiki" }),
          maxInputChars: options.maxInputChars || DEFAULT_MAX_INPUT_CHARS,
        });
        resultMap.set(page.id, result);
      } catch (error) {
        errorList.push({
          id: page.id,
          url: page.url,
          engine,
          stage: "extract",
          message: error.message,
          failed_at: nowIso(),
        });
      }

      await sleep(ENGINE_DELAY_MS[engine]);
    }

    const sortedResults = [...resultMap.values()].sort((left, right) => left.id.localeCompare(right.id));
    await writeJson(resultFile, sortedResults);
    await writeJson(paths.extractionErrors, errorList);
    await writeJson(
      path.join(paths.partialsDir, `${engine}_results_after_batch_${batchLabel}.json`),
      sortedResults
    );
    console.log(`[wiki-benchmark] ${engine} batch ${batchLabel}/${batches.length} complete (${sortedResults.length}/${crawlResults.length})`);
  }

  const allEngineResults = [
    ...(await readJson(path.join(paths.root, ENGINE_RESULT_FILE.gpt), [])),
    ...(await readJson(path.join(paths.root, ENGINE_RESULT_FILE.gemini), [])),
    ...(await readJson(path.join(paths.root, ENGINE_RESULT_FILE.perplexity), [])),
  ].map((item) => {
    const page = crawlMap.get(item.id);
    return page ? hydrateExtractionResult(item, page) : item;
  });
  await writeJson(paths.extractionSummary, summarizeExtractionResults(allEngineResults));
}

main().catch((error) => {
  console.error("[wiki-benchmark] extract failed", error);
  process.exitCode = 1;
});
