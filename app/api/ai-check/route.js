// app/api/ai-check/route.js — AI Reality Check endpoint
import { NextResponse } from "next/server";
import { checkAllEngines } from "@/lib/ai-check";
import { buildRateLimitHeaders, rateLimit } from "@/lib/rate-limit";

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

    const { companyName, domain, officialTitle, officialDescription, aliases } = await request.json();

    if (!companyName) {
      return NextResponse.json(
        { error: "companyName is required" },
        { status: 400 }
      );
    }

    console.log(`[AAO] AI Reality Check for: ${companyName}`);
    const aiCheck = await checkAllEngines({
      companyName,
      domain,
      officialTitle,
      officialDescription,
      aliases,
    });

    return NextResponse.json({
      success: true,
      companyName,
      domain,
      defaultMode: aiCheck.defaultMode,
      defaultIntent: aiCheck.defaultIntent,
      results: aiCheck.modes,
    }, {
      headers: buildRateLimitHeaders(limit, 10),
    });
  } catch (error) {
    console.error("[AAO] AI Check error:", error);
    return NextResponse.json(
      { error: error.message || "AI check failed" },
      { status: 500 }
    );
  }
}
