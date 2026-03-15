// Minimal route tests — verify malformed JSON returns 400

// Mock next/server
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, opts) => ({ body, status: opts?.status || 200, headers: opts?.headers }),
  },
}));

// Mock rate-limit to always allow
jest.mock("../lib/rate-limit", () => ({
  rateLimit: async () => ({ allowed: true, remaining: 9, resetIn: 60 }),
  buildRateLimitHeaders: () => ({}),
}));

// Mock log-utils
jest.mock("../lib/log-utils", () => ({
  redactUrl: (url) => url,
}));

// Create a Request-like object with broken JSON
function makeBadJsonRequest() {
  return {
    json: async () => { throw new SyntaxError("Unexpected token"); },
    headers: new Map(),
    url: "http://localhost:3000/api/test",
  };
}

describe("API route malformed JSON handling", () => {
  test("POST /api/diagnose returns 400 for malformed JSON", async () => {
    // Mock dependencies
    jest.mock("../lib/jina", () => ({}));
    jest.mock("../lib/ai-check", () => ({}));
    jest.mock("../lib/aao-lint", () => ({}));
    jest.mock("../lib/url-safety", () => ({ isPublicUrlValidationError: () => false }));

    const { POST } = require("../app/api/diagnose/route");
    const result = await POST(makeBadJsonRequest());
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/invalid json/i);
  });

  test("POST /api/ai-check returns 400 for malformed JSON", async () => {
    jest.mock("../lib/ai-check", () => ({
      hydrateOfficialGroundTruth: () => ({}),
      verifyUrlDelivery: async () => ({ engines: {} }),
    }));

    const { POST } = require("../app/api/ai-check/route");
    const result = await POST(makeBadJsonRequest());
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/invalid json/i);
  });

  test("POST /api/intake returns 400 for malformed JSON", async () => {
    jest.mock("../lib/intake", () => ({
      normalizeIntakePayload: () => ({}),
      validateIntakePayload: () => ({ ok: true }),
      buildIntakeDraft: () => ({}),
    }));

    const { POST } = require("../app/api/intake/route");
    const result = await POST(makeBadJsonRequest());
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/invalid json/i);
  });
});
