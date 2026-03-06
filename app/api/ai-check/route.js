// app/api/ai-check/route.js — AI Reality Check endpoint
import { NextResponse } from "next/server";
import { checkAllEngines } from "@/lib/ai-check";
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

    const { companyName } = await request.json();

    if (!companyName) {
      return NextResponse.json(
        { error: "companyName is required" },
        { status: 400 }
      );
    }

    console.log(`[AAO] AI Reality Check for: ${companyName}`);
    const results = await checkAllEngines(companyName);

    return NextResponse.json({
      success: true,
      companyName,
      results,
    });
  } catch (error) {
    console.error("[AAO] AI Check error:", error);
    return NextResponse.json(
      { error: error.message || "AI check failed" },
      { status: 500 }
    );
  }
}
