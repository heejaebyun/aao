import {
  loadLocalEnv,
  parseArgs,
  readJson,
  resolveOutputPaths,
  resolvePilotOptions,
  writeJson,
} from "./wiki-benchmark-lib.mjs";

const NON_COMPANY_PAGE_IDS = new Set([
  "wiki_017", // 간호교육연수원
  "wiki_076", // Benham Historic District
  "wiki_092", // Hargeisa Taxi
]);

const CONTENT_ABSENT_MAX_WORDS = 49;
const CONTENT_SPARSE_MAX_WORDS = 99;
const TARGET_TOTAL = 30;

function deriveSourceGroup(selectionBucket) {
  if (String(selectionBucket || "").startsWith("C_")) return "C";
  if (selectionBucket === "B_fill") return "B";
  return null;
}

function buildCrawlMap(crawlResults) {
  return new Map(crawlResults.map((page) => [page.id, page]));
}

function getWordCount(page) {
  return Number(page?.structural_features?.word_count || 0);
}

function classifyTargetBucket(record) {
  if (NON_COMPANY_PAGE_IDS.has(record.id)) return "exclude_non_company";
  if (record.word_count <= CONTENT_ABSENT_MAX_WORDS) return "exclude_content_absent";
  if (record.group === "C" && record.word_count <= CONTENT_SPARSE_MAX_WORDS) return "C_content_sparse";
  if (record.group === "C") return "C_structure_weak";
  if (record.group === "B") return "B_fill";
  return "ignore";
}

function sortByWeakness(left, right) {
  if (left.avg_extraction_rate !== right.avg_extraction_rate) {
    return left.avg_extraction_rate - right.avg_extraction_rate;
  }
  if (left.word_count !== right.word_count) {
    return left.word_count - right.word_count;
  }
  return left.id.localeCompare(right.id);
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("usage: node ./scripts/wiki-benchmark-select-modifications.mjs --total=100 --batchSize=10");
    return;
  }

  await loadLocalEnv();
  const options = resolvePilotOptions(args);
  const paths = resolveOutputPaths(options);

  const crawlResults = await readJson(paths.crawlResults, []);
  const classifications = await readJson(paths.classificationResults, []);

  if (!Array.isArray(crawlResults) || !crawlResults.length) {
    throw new Error(`크롤링 결과가 없습니다: ${paths.crawlResults}`);
  }
  if (!Array.isArray(classifications) || !classifications.length) {
    throw new Error(`분류 결과가 없습니다: ${paths.classificationResults}`);
  }

  const crawlMap = buildCrawlMap(crawlResults);
  const candidates = classifications
    .map((item) => {
      const page = crawlMap.get(item.id);
      const wordCount = getWordCount(page);
      return {
        id: item.id,
        url: item.url,
        lang: item.lang,
        title: item.title,
        category_tier: item.category_tier,
        avg_extraction_rate: item.avg_extraction_rate,
        group: item.group,
        engines: item.engines,
        word_count: wordCount,
        section_count: Number(page?.structural_features?.section_count || 0),
        has_infobox: Boolean(page?.structural_features?.has_infobox),
        infobox_field_count: Number(page?.structural_features?.infobox_field_count || 0),
        stub: Boolean(page?.stub),
        selection_bucket: classifyTargetBucket({
          ...item,
          word_count: wordCount,
        }),
        source_group: null,
      };
    })
    .map((item) => ({
      ...item,
      source_group: deriveSourceGroup(item.selection_bucket),
    }))
    .sort(sortByWeakness);

  const coreC = candidates.filter((item) => item.selection_bucket === "C_content_sparse" || item.selection_bucket === "C_structure_weak");
  const fillB = candidates.filter((item) => item.selection_bucket === "B_fill");
  const selected = [
    ...coreC,
    ...fillB.slice(0, Math.max(0, TARGET_TOTAL - coreC.length)),
  ].slice(0, TARGET_TOTAL).map((item, index) => ({
    ...item,
    target_rank: index + 1,
  }));

  const summary = {
    total_targets: selected.length,
    target_total_goal: TARGET_TOTAL,
    excluded_non_company: candidates.filter((item) => item.selection_bucket === "exclude_non_company"),
    excluded_content_absent: candidates.filter((item) => item.selection_bucket === "exclude_content_absent"),
    core_counts: {
      c_content_sparse: coreC.filter((item) => item.selection_bucket === "C_content_sparse").length,
      c_structure_weak: coreC.filter((item) => item.selection_bucket === "C_structure_weak").length,
      c_total_used: coreC.length,
      b_fill_used: selected.filter((item) => item.selection_bucket === "B_fill").length,
      b_fill_available: fillB.length,
    },
    selected,
  };

  await writeJson(paths.modificationTargets, selected);
  await writeJson(paths.modificationTargetSummary, summary);

  console.log(`[wiki-benchmark] modification target set ready (${selected.length}/${TARGET_TOTAL})`);
}

main().catch((error) => {
  console.error("[wiki-benchmark] select modifications failed", error);
  process.exitCode = 1;
});
