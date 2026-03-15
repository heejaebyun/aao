// app/api/ai-check/route.js — AI Reality Check endpoint (v5: URL-based delivery verification)
import { NextResponse } from "next/server";
import { hydrateOfficialGroundTruth, verifyUrlDelivery } from "@/lib/ai-check";
import { buildRateLimitHeaders, rateLimit } from "@/lib/rate-limit";
import { redactUrl } from "@/lib/log-utils";

export async function POST(request) {
  try {
    const limit = await rateLimit(request, {
      namespace: "ai-check",
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const {
      url,
      crawlSnapshot,
      subpageUrls,
      crawlSignals,
      groundTruth: serializedGroundTruth,
    } = body;

    if (!url) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    console.log(`[AAO] AI URL Delivery Check for: ${redactUrl(url)}`);

    const groundTruth = hydrateOfficialGroundTruth(
      serializedGroundTruth || {},
      crawlSnapshot || {},
    );

    const result = await verifyUrlDelivery(
      url,
      groundTruth,
      Array.isArray(subpageUrls) ? subpageUrls : [],
      {},
      crawlSignals || {},
    );

    const cacheHeaders = { "Cache-Control": "private, no-store" };

    return NextResponse.json({
      success: true,
      url,
      groundTruth: {
        declaredFields: groundTruth.declaredFields,
        faqPairs: groundTruth.faqPairs,
        fieldCount: groundTruth.fieldCount,
        alternateNames: groundTruth.alternateNames,
      },
      engines: result.engines,
    }, {
      headers: { ...cacheHeaders, ...buildRateLimitHeaders(limit, 10) },
    });
  } catch (error) {
    console.error("[AAO] AI Check error:", error?.message || "unknown");
    return NextResponse.json(
      { error: error.message || "AI check failed" },
      { status: 500 }
    );
  }
}
