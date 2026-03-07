import { NextResponse } from "next/server";
import { buildIntakeDraft, normalizeIntakePayload, validateIntakePayload } from "@/lib/intake";
import { buildRateLimitHeaders, rateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const limit = await rateLimit(request, {
      namespace: "profile-intake",
      maxRequests: 6,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: `요청 한도를 초과했습니다. ${limit.resetIn}초 후에 다시 시도해주세요.` },
        {
          status: 429,
          headers: buildRateLimitHeaders(limit, 6),
        }
      );
    }

    const payload = normalizeIntakePayload(await request.json());
    const validation = validateIntakePayload(payload);

    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "입력값을 다시 확인해주세요.",
          fieldErrors: validation.errors,
        },
        {
          status: 400,
          headers: buildRateLimitHeaders(limit, 6),
        }
      );
    }

    const draft = buildIntakeDraft(payload);

    return NextResponse.json(
      {
        success: true,
        intake: draft,
      },
      {
        headers: buildRateLimitHeaders(limit, 6),
      }
    );
  } catch (error) {
    console.error("[AAO] Intake error:", error);
    return NextResponse.json(
      { error: error.message || "intake failed" },
      { status: 500 }
    );
  }
}
