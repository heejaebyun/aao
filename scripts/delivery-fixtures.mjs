// scripts/delivery-fixtures.mjs
// v5 delivery judgment + cause inference fixtures
import assert from "node:assert/strict";
import { evaluateFieldDelivery, resolveOfficialGroundTruth } from "../lib/ai-check.js";

// ---------------------------------------------------------------------------
// Helper: build ground truth from simplified input
// ---------------------------------------------------------------------------
function buildGt(fields, faqPairs = [], alternateNames = []) {
  const fieldMap = {};
  const GT_ARRAY_FIELDS = new Set(["key_products", "competitors"]);
  for (const [field, value, source] of fields) {
    fieldMap[field] = { value, source: source || "official_facts_block" };
  }
  return {
    declaredFields: fields.map(([field, value, source]) => ({ field, value, source: source || "official_facts_block" })),
    fieldMap,
    fieldCount: fields.length,
    fieldNames: fields.map(([f]) => f),
    alternateNames,
    faqPairs,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FIXTURES = [
  // 1. Full delivery success
  {
    id: "full-delivery",
    description: "모든 필드가 정확히 전달되면 deliveryRate=1",
    groundTruth: buildGt([
      ["entity_name", "AAO"],
      ["entity_type", "AI 최적화 서비스"],
      ["founded", "2024"],
      ["headquarters", "서울"],
      ["ceo_or_leader", "변희재"],
    ]),
    responseText: "AAO는 AI 최적화 서비스를 제공하는 회사로, 2024년에 설립되었습니다. 본사는 서울에 위치하며 대표자는 변희재입니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 5, `delivered should be 5, got ${result.deliveredFields.length}`);
      assert.equal(result.missedFields.length, 0, `missed should be 0, got ${result.missedFields.length}`);
      assert.equal(result.deliveryRate, 1);
    },
  },

  // 2. Partial array match
  {
    id: "partial-array-match",
    description: "배열 필드 3개 중 1개만 일치해도 delivered",
    groundTruth: buildGt([
      ["key_products", ["AI 프로필", "진단 엔진", "모니터링"]],
    ]),
    responseText: "이 회사의 주요 서비스에는 AI 프로필 생성 기능이 포함됩니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 1, `array field should match with 1/3 items`);
      assert.equal(result.missedFields.length, 0);
    },
  },

  // 3. Year suffix: 2026년 vs 2026
  {
    id: "year-suffix-match",
    description: "2026년 vs 2026 — 한국어 숫자 접미사 정규화 후 매칭",
    groundTruth: buildGt([
      ["founded", "2024"],
    ]),
    responseText: "이 회사는 2024년에 설립되었습니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 1, `year suffix should normalize: 2024년 → 2024`);
      assert.equal(result.missedFields.length, 0);
    },
  },

  // 4. Robots blocked cause — all missed with high confidence
  {
    id: "robots-blocked-cause",
    description: "robotsBlocked일 때 모든 missed 필드의 confidence=high",
    groundTruth: buildGt([
      ["entity_name", "TestCo"],
      ["founded", "2020"],
    ]),
    responseText: "검색 결과를 찾을 수 없습니다.",
    observedEvidence: { robotsBlocked: true },
    assert(result) {
      assert.equal(result.missedFields.length, 2);
      for (const missed of result.missedFields) {
        assert.equal(missed.confidence, "high", `${missed.field} should have high confidence when robots blocked`);
        assert.match(missed.observedSignal, /robots_blocked/);
      }
    },
  },

  // 5. Source-based cause — low confidence
  {
    id: "source-based-low-confidence",
    description: "source 기반 원인 추론은 confidence=low",
    groundTruth: buildGt([
      ["entity_name", "TestCo", "jsonld"],
      ["founded", "2020", "official_facts_block"],
    ]),
    responseText: "관련 정보를 찾을 수 없습니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.missedFields.length, 2);
      for (const missed of result.missedFields) {
        assert.equal(missed.confidence, "low", `${missed.field} from ${missed.source} should have low confidence`);
      }
    },
  },

  // 6. FAQ partial delivery
  // Note: overlapRatio uses max(left,right) denominator, so short FAQ answers
  // need high token overlap against the full response text.
  // Longer, more distinctive answers match better.
  {
    id: "faq-partial-delivery",
    description: "FAQ 3쌍 중 일부만 전달 (긴 답변은 매칭, 짧은 답변은 미매칭)",
    groundTruth: buildGt(
      [["entity_name", "AAO"]],
      [
        { question: "AAO란 무엇인가요?", answer: "AAO는 AI Answer Optimization 서비스로, 브랜드의 AI 가시성을 높이는 플랫폼입니다." },
        { question: "무료 체험이 가능한가요?", answer: "네, 14일 무료 체험을 제공합니다." },
      ],
    ),
    responseText: "AAO는 AI Answer Optimization 서비스로 브랜드의 AI 가시성을 높이는 플랫폼입니다. 유료 플랜만 제공합니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.faqDelivered.length, 1, `should deliver 1 FAQ, got ${result.faqDelivered.length}`);
      assert.equal(result.faqMissed.length, 1, `should miss 1 FAQ, got ${result.faqMissed.length}`);
      assert.equal(result.faqMissed[0].question, "무료 체험이 가능한가요?");
    },
  },

  // 7. Bilingual name via alternateName
  {
    id: "bilingual-name-match",
    description: "alternateName으로 영한 이름 매칭",
    groundTruth: buildGt(
      [["entity_name", "변희재"]],
      [],
      ["Heejae Byun", "Byun Heejae"],
    ),
    responseText: "The founder, Heejae Byun, established the company in 2024.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 1, `should match via alternateName`);
      assert.equal(result.missedFields.length, 0);
    },
  },

  // 8. JS rendering cause — medium confidence
  {
    id: "js-rendering-medium-confidence",
    description: "jsRendered 추론은 confidence=medium",
    groundTruth: buildGt([
      ["entity_name", "SPA회사"],
    ]),
    responseText: "해당 페이지에서 정보를 찾을 수 없습니다.",
    observedEvidence: { jsRendered: true },
    assert(result) {
      assert.equal(result.missedFields.length, 1);
      assert.equal(result.missedFields[0].confidence, "medium");
      assert.match(result.missedFields[0].observedSignal, /js_rendering/);
    },
  },
  // 14. Negative context — "찾지 못함" 응답에서 도메인명 매칭 방지
  {
    id: "negative-context-entity-name",
    description: "응답이 '찾지 못함'이면 도메인명 매칭으로 delivered 안 됨",
    responseText: "**entity name:** 찾지 못함\n**headquarters:** 찾지 못함\n\nconductor.com 페이지에 직접 접근할 수 없었으며, 검색 결과는 해당 URL의 실제 내용을 반영하지 않고 타사 사이트의 정보를 포함하고 있음.",
    groundTruth: buildGt([
      ["entity_name", "Conductor", "jsonld"],
      ["headquarters", "New York", "jsonld"],
    ]),
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 0, "No fields should be delivered when response says 찾지 못함");
      assert.equal(result.missedFields.length, 2, "Both fields should be missed");
    },
  },
  {
    id: "negative-context-line-scoped",
    description: "다른 필드의 '찾지 못함'이 현재 필드의 positive match를 덮어쓰지 않음",
    responseText: [
      "* **entity name**: Semrush",
      "* **headquarters**: 찾지 못함",
      "* **description**: Data-Driven Marketing Tools to Grow Your Business",
    ].join("\n"),
    groundTruth: buildGt([
      ["entity_name", "Semrush", "jsonld"],
      ["headquarters", "Boston", "jsonld"],
      ["description", "Data-Driven Marketing Tools to Grow Your Business", "jsonld"],
    ]),
    observedEvidence: {},
    assert(result) {
      assert.deepEqual(
        result.deliveredFields.map((field) => field.field).sort(),
        ["description", "entity_name"],
        "entity_name/description should still deliver even if headquarters is not found",
      );
      assert.equal(result.missedFields.length, 1, "Only headquarters should be missed");
      assert.equal(result.missedFields[0].field, "headquarters");
    },
  },
  // 15. Citation path but zero delivery — Perplexity pattern
  // Perplexity sometimes cites the domain/path but returns generic info with no actual field values
  {
    id: "citation-path-zero-delivery",
    description: "citation=path이지만 필드 전달 0건 — Perplexity 패턴",
    groundTruth: buildGt([
      ["entity_name", "AAO (AI Answer Optimization)"],
      ["entity_type", "AI 검색 최적화 SaaS"],
      ["founded", "2026"],
      ["headquarters", "대한민국"],
    ]),
    responseText: "해당 웹사이트에 대한 구체적인 정보를 찾기 어렵습니다. 직접 방문하여 확인해 보시기 바랍니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 0, "generic deflection should deliver 0 fields");
      assert.equal(result.missedFields.length, 4);
    },
  },

  // 16. Partial delivery without citation — Gemini pattern
  // Gemini sometimes delivers entity_name from general knowledge but cites nothing
  {
    id: "partial-delivery-no-citation-gemini",
    description: "entity_name만 delivered, citation none — Gemini 일반 지식 패턴",
    groundTruth: buildGt([
      ["entity_name", "AAO"],
      ["entity_type", "AI 검색 최적화 SaaS"],
      ["founded", "2026"],
    ]),
    responseText: "AAO는 AI 관련 서비스를 제공하는 것으로 보입니다. 정확한 설립 연도나 서비스 유형에 대한 정보는 확인되지 않습니다.",
    observedEvidence: {},
    assert(result) {
      assert.equal(result.deliveredFields.length, 1, "only entity_name should match");
      assert.equal(result.deliveredFields[0].field, "entity_name");
      assert.equal(result.missedFields.length, 2, "entity_type and founded should be missed");
    },
  },
];

// ---------------------------------------------------------------------------
// Ground truth extraction fixtures
// ---------------------------------------------------------------------------
const GT_FIXTURES = [
  {
    id: "gt-founder-string",
    description: "JSON-LD founder가 문자열일 때 ceo_or_leader 추출",
    crawlSnapshot: {
      jsonLdBlocks: [JSON.stringify({ "@type": "Organization", name: "TestCo", founder: "김철수" })],
      content: "",
    },
    assert(gt) {
      const ceo = gt.declaredFields.find((f) => f.field === "ceo_or_leader");
      assert.ok(ceo, "should extract ceo_or_leader from string founder");
      assert.equal(ceo.value, "김철수");
    },
  },
  {
    id: "gt-expanded-labels",
    description: "대표이사, 주소 같은 확장 라벨 인식",
    crawlSnapshot: {
      jsonLdBlocks: [],
      content: [
        "회사명: TestCo",
        "대표이사: 홍길동",
        "주소: 서울특별시 강남구",
        "사업 분야: IT 서비스",
        "주요 서비스: 웹개발, 앱개발",
      ].join("\n"),
    },
    assert(gt) {
      const fields = Object.fromEntries(gt.declaredFields.map((f) => [f.field, f.value]));
      assert.equal(fields.entity_name, "TestCo", "회사명 should map to entity_name");
      assert.equal(fields.ceo_or_leader, "홍길동", "대표이사 should map to ceo_or_leader");
      assert.equal(fields.headquarters, "서울특별시 강남구", "주소 should map to headquarters");
      assert.equal(fields.entity_type, "IT 서비스", "사업 분야 should map to entity_type");
      assert.ok(Array.isArray(fields.key_products), "주요 서비스 should be array");
      assert.ok(fields.key_products.includes("웹개발"), "should include 웹개발");
    },
  },
  {
    id: "gt-inline-facts-block",
    description: "한 줄 문단형 facts block에서도 공식 사실 추출",
    crawlSnapshot: {
      jsonLdBlocks: [],
      content: [
        "공식 사실 요약",
        "서비스명: AAO (AI Answer Optimization) 설명: AAO는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하는 서비스입니다. 업종: AI 검색 최적화 / AI 프로필 페이지 제작 SaaS 설립연도: 2026 대표이사: 변희재 (Heejae Byun) 주요 서비스: AI 전달 진단, 구조 검증 리포트, AI 프로필 페이지 설계 및 제작",
      ].join(" "),
    },
    assert(gt) {
      const fields = Object.fromEntries(gt.declaredFields.map((f) => [f.field, f.value]));
      assert.equal(fields.entity_name, "AAO (AI Answer Optimization)", "서비스명 should map from inline facts block");
      assert.match(String(fields.description), /기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단/, "설명 should map from inline facts block");
      assert.equal(fields.entity_type, "AI 검색 최적화 / AI 프로필 페이지 제작 SaaS");
      assert.equal(fields.founded, "2026");
      assert.equal(fields.ceo_or_leader, "변희재 (Heejae Byun)");
      assert.ok(Array.isArray(fields.key_products), "주요 서비스 should still be parsed as array");
      assert.ok(fields.key_products.includes("AI 전달 진단"), "주요 서비스 should include AI 전달 진단");
    },
  },
  {
    id: "gt-inline-facts-block-windowed",
    description: "facts block 뒤 일반 본문이 이어져도 값이 과도하게 확장되지 않음",
    crawlSnapshot: {
      jsonLdBlocks: [],
      content: [
        "공식 사실 요약",
        "서비스명: AAO (AI Answer Optimization) 설명: AAO는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하는 서비스입니다. 업종: AI 검색 최적화 / AI 프로필 페이지 제작 SaaS 설립연도: 2026 대표이사: 변희재 (Heejae Byun) 주요 서비스: AI 전달 진단, 구조 검증 리포트, AI 프로필 페이지 설계 및 제작",
        "핵심 관찰 Key Findings 국내 기업 웹사이트 대다수는 AI가 선언된 사실을 절반 이상 전달하지 못함 Princeton GEO 연구 KDD 2024 통계 데이터 포함 시 AI 인용 확률 상승",
      ].join(" "),
    },
    assert(gt) {
      const fields = Object.fromEntries(gt.declaredFields.map((f) => [f.field, f.value]));
      assert.equal(
        fields.description,
        "AAO는 기업 웹사이트를 생성형 AI가 얼마나 정확히 이해하는지 진단하는 서비스입니다.",
      );
      assert.ok(Array.isArray(fields.key_products), "주요 서비스 should stay array-shaped");
      assert.ok(fields.key_products.includes("AI 전달 진단"));
      assert.ok(fields.key_products.includes("구조 검증 리포트"));
      assert.ok(fields.key_products.some((item) => item.includes("AI 프로필 페이지 설계")));
      assert.ok(
        fields.key_products.every((item) => item.length < 60 && !item.includes("핵심 관찰")),
        "주요 서비스 should not swallow the following section text",
      );
    },
  },
  {
    id: "gt-alternate-name",
    description: "JSON-LD alternateName 수집",
    crawlSnapshot: {
      jsonLdBlocks: [JSON.stringify({
        "@type": "Organization",
        name: "AAO",
        alternateName: ["AI Answer Optimization", "에이에이오"],
      })],
      content: "",
    },
    assert(gt) {
      assert.ok(gt.alternateNames.includes("AI Answer Optimization"));
      assert.ok(gt.alternateNames.includes("에이에이오"));
    },
  },
  {
    id: "gt-ignore-webpage-title-name",
    description: "WebPage/marketing title 성격의 JSON-LD name은 entity_name 분모에서 제외",
    crawlSnapshot: {
      jsonLdBlocks: [JSON.stringify({
        "@type": "WebPage",
        name: "기업 정보 | 회사소개 | Samsung 대한민국",
        description: "페이지 소개 문구",
      })],
      content: "",
    },
    assert(gt) {
      assert.equal(gt.fieldCount, 0, "WebPage title-like JSON-LD should not become ground truth");
    },
  },
  {
    id: "gt-facts-block-lower-in-page",
    description: "페이지 하단에 있는 facts block도 추출",
    crawlSnapshot: {
      jsonLdBlocks: [],
      content: [
        // 2000+ chars of filler
        "Lorem ipsum ".repeat(200),
        "",
        "회사명: DeepCo",
        "설립일: 2023",
        "본사: 부산",
        "업종: 딥러닝",
      ].join("\n"),
    },
    assert(gt) {
      const fields = Object.fromEntries(gt.declaredFields.map((f) => [f.field, f.value]));
      assert.equal(fields.entity_name, "DeepCo", "should find facts block past 2000 chars");
      assert.equal(fields.founded, "2023");
      assert.equal(fields.headquarters, "부산");
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

console.log("=== Delivery Judgment Fixtures ===\n");

for (const fixture of FIXTURES) {
  try {
    const result = evaluateFieldDelivery(
      fixture.responseText,
      fixture.groundTruth,
      fixture.observedEvidence,
    );
    fixture.assert(result);
    console.log(`  ✓ ${fixture.id}: ${fixture.description}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${fixture.id}: ${fixture.description}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

console.log("\n=== Ground Truth Extraction Fixtures ===\n");

for (const fixture of GT_FIXTURES) {
  try {
    const gt = resolveOfficialGroundTruth(fixture.crawlSnapshot);
    fixture.assert(gt);
    console.log(`  ✓ ${fixture.id}: ${fixture.description}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${fixture.id}: ${fixture.description}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
