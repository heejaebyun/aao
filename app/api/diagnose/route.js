// app/api/diagnose/route.js — Main AAO diagnostic endpoint
import { NextResponse } from "next/server";
import { crawlSite } from "@/lib/jina";
import { runDiagnosis } from "@/lib/diagnose";
import { buildRateLimitHeaders, rateLimit } from "@/lib/rate-limit";
import { isPublicUrlValidationError } from "@/lib/url-safety";

export async function POST(request) {
  try {
    const limit = await rateLimit(request, {
      namespace: "diagnose",
      maxRequests: 10,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: `요청 한도를 초과했습니다. ${limit.resetIn}초 후에 다시 시도해주세요.` },
        {
          status: 429,
          headers: buildRateLimitHeaders(limit, 10),
        }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Step 1: Crawl the site via direct fetch + light crawl + Jina fallback
    console.log(`[AAO] Crawling: ${url}`);
    const crawlBundle = await crawlSite(url);

    // Step 2: 콘텐츠 최소치 확인
    const mainWordCount = crawlBundle.main.content.split(/\s+/).filter(Boolean).length;
    console.log(`[AAO] Main page word count: ${mainWordCount}`);
    if (mainWordCount < 30) {
      return NextResponse.json(
        { error: `페이지에서 충분한 텍스트를 읽을 수 없습니다. JS 렌더링이 필요하거나 접근이 제한된 페이지일 수 있습니다. (수집된 단어: ${mainWordCount}개)` },
        { status: 422 }
      );
    }

    // Step 3: Run diagnosis via Claude on the main page only
    console.log(`[AAO] Running main diagnosis for: ${crawlBundle.main.title}`);
    const diagnosis = await runDiagnosis(crawlBundle.main);

    let extendedDiagnosis = null;
    if (crawlBundle.gap.hasMeaningfulExtraContent) {
      console.log(`[AAO] Running extended diagnosis for: ${crawlBundle.combined.title}`);
      extendedDiagnosis = await runDiagnosis(crawlBundle.combined);
    }

    return NextResponse.json({
      success: true,
      url: crawlBundle.url,
      crawl: {
        title: crawlBundle.main.title,
        description: crawlBundle.main.description,
        metadata: crawlBundle.main.metadata,
        contentPreview: buildContentPreview(crawlBundle.main.content),
        contentLength: crawlBundle.main.content.length,
        crawledPages: crawlBundle.main.crawledPages,
        crawlSource: crawlBundle.main.crawlSource,
        crawlConfidence: crawlBundle.main.crawlConfidence,
        discoverySignals: crawlBundle.discoverySignals,
        extras: crawlBundle.extras.map((page) => ({
          url: page.url,
          title: page.title,
          description: page.description,
          metadata: page.metadata,
          contentLength: page.content.length,
          crawlSource: page.crawlSource,
          crawlConfidence: page.crawlConfidence,
        })),
        combined: {
          metadata: crawlBundle.combined.metadata,
          contentLength: crawlBundle.combined.content.length,
          crawledPages: crawlBundle.combined.crawledPages,
          crawlSource: crawlBundle.combined.crawlSource,
          crawlConfidence: crawlBundle.combined.crawlConfidence,
        },
        gap: crawlBundle.gap,
      },
      diagnosis,
      extendedDiagnosis,
    }, {
      headers: buildRateLimitHeaders(limit, 10),
    });
  } catch (error) {
    console.error("[AAO] Diagnosis error:", error);

    if (isPublicUrlValidationError(error)) {
      return NextResponse.json(
        { error: error.message || "공개 웹사이트 URL만 진단할 수 있습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Diagnosis failed" },
      { status: 500 }
    );
  }
}

function buildContentPreview(content, maxChars = 1600) {
  const normalized = String(content || "").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}...`;
}
