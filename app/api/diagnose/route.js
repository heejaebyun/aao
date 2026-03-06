// app/api/diagnose/route.js — Main AAO diagnostic endpoint
import { NextResponse } from "next/server";
import { crawlSite } from "@/lib/jina";
import { runDiagnosis } from "@/lib/diagnose";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const limit = rateLimit(ip, 10);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: `요청 한도를 초과했습니다. ${limit.resetIn}초 후에 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Step 1: Crawl the site via direct fetch + light crawl + Jina fallback
    console.log(`[AAO] Crawling: ${url}`);
    const crawlBundle = await crawlSite(url);

    // Step 2: Run diagnosis via Claude on the main page only
    console.log(`[AAO] Running main diagnosis for: ${crawlBundle.main.title}`);
    const diagnosis = await runDiagnosis(crawlBundle.main);

    let extendedDiagnosis = null;
    if (crawlBundle.gap.hasMeaningfulExtraContent) {
      console.log(`[AAO] Running extended diagnosis for: ${crawlBundle.combined.title}`);
      extendedDiagnosis = await runDiagnosis(crawlBundle.combined);
    }

    return NextResponse.json({
      success: true,
      url,
      crawl: {
        title: crawlBundle.main.title,
        description: crawlBundle.main.description,
        metadata: crawlBundle.main.metadata,
        rawContent: crawlBundle.main.content.substring(0, 10000),
        contentLength: crawlBundle.main.content.length,
        crawledPages: crawlBundle.main.crawledPages,
        crawlSource: crawlBundle.main.crawlSource,
        crawlConfidence: crawlBundle.main.crawlConfidence,
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
    });
  } catch (error) {
    console.error("[AAO] Diagnosis error:", error);
    return NextResponse.json(
      { error: error.message || "Diagnosis failed" },
      { status: 500 }
    );
  }
}
