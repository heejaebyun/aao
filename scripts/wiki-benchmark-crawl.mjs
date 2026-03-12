import path from "node:path";
import {
  buildGroundTruthFromWikiPage,
  buildStructuralFeatures,
  chunk,
  countReferences,
  createWikiApiClient,
  ensureDir,
  extractFirstParagraph,
  extractInfobox,
  extractLinks,
  extractSectionHeadings,
  loadLocalEnv,
  parseArgs,
  readJson,
  resolveGroundTruth,
  resolveOutputPaths,
  resolvePilotOptions,
  stripHtml,
  withRetries,
  writeJson,
  nowIso,
} from "./wiki-benchmark-lib.mjs";

async function crawlOnePage(record, client) {
  const data = await withRetries(
    () => client.request({
      action: "parse",
      page: record.title,
      prop: "text|categories",
      disableeditsection: "1",
    }),
    { label: `crawl ${record.lang}:${record.title}` }
  );

  const html = data.parse?.text?.["*"] || "";
  const categories = Array.isArray(data.parse?.categories)
    ? data.parse.categories.map((item) => item["*"] || item.title || "").filter(Boolean)
    : record.categories || [];
  const plainText = stripHtml(html);
  const firstParagraph = extractFirstParagraph(html);
  const infobox = extractInfobox(html);
  const sectionHeadings = extractSectionHeadings(html);
  const links = extractLinks(html, record.lang);
  const referenceCount = countReferences(html);

  const crawled = {
    ...record,
    crawled_at: nowIso(),
    raw_html: html,
    plain_text: plainText,
    plain_text_length: plainText.length,
    first_paragraph: firstParagraph,
    infobox,
    section_headings: sectionHeadings,
    internal_links: links.internal,
    external_links: links.external,
    internal_link_count: links.internal.length,
    external_link_count: links.external.length,
    reference_count: referenceCount,
    categories,
  };

  return {
    ...crawled,
    ground_truth: buildGroundTruthFromWikiPage(crawled),
    structural_features: buildStructuralFeatures(crawled),
  };
}

function hydrateCrawlResult(record) {
  if (!record) return record;
  return {
    ...record,
    ground_truth: resolveGroundTruth(record, { kind: "wiki" }),
    structural_features: record.structural_features || buildStructuralFeatures(record),
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("usage: node ./scripts/wiki-benchmark-crawl.mjs --total=100 --batchSize=10 [--refresh]");
    return;
  }
  await loadLocalEnv();
  const options = resolvePilotOptions(args);
  const paths = resolveOutputPaths(options);

  await ensureDir(paths.root);
  await ensureDir(paths.partialsDir);

  const urls = await readJson(paths.urls, []);
  if (!Array.isArray(urls) || !urls.length) {
    throw new Error(`URL 목록이 없습니다: ${paths.urls}`);
  }

  const existingResults = await readJson(paths.crawlResults, []);
  const errors = await readJson(paths.crawlErrors, []);
  const hydratedExisting = (Array.isArray(existingResults) ? existingResults : []).map(hydrateCrawlResult);
  const resultMap = new Map(hydratedExisting.map((item) => [item.id, item]));
  const errorList = Array.isArray(errors) ? errors : [];

  const clients = {
    ko: createWikiApiClient({ lang: "ko" }),
    en: createWikiApiClient({ lang: "en" }),
  };

  const batches = chunk(urls, options.batchSize);
  for (const [batchIndex, batch] of batches.entries()) {
    const batchLabel = String(batchIndex + 1).padStart(2, "0");
    for (const record of batch) {
      if (resultMap.has(record.id) && !options.refresh) continue;

      try {
        const crawled = await crawlOnePage(record, clients[record.lang]);
        resultMap.set(record.id, crawled);
      } catch (error) {
        errorList.push({
          id: record.id,
          url: record.url,
          stage: "crawl",
          message: error.message,
          failed_at: nowIso(),
        });
      }
    }

    const sortedResults = [...resultMap.values()].sort((left, right) => left.id.localeCompare(right.id));
    await writeJson(paths.crawlResults, sortedResults);
    await writeJson(paths.crawlErrors, errorList);
    await writeJson(
      path.join(paths.partialsDir, `crawl_results_after_batch_${batchLabel}.json`),
      sortedResults
    );
    console.log(`[wiki-benchmark] crawl batch ${batchLabel}/${batches.length} complete (${sortedResults.length}/${urls.length})`);
  }
}

main().catch((error) => {
  console.error("[wiki-benchmark] crawl failed", error);
  process.exitCode = 1;
});
