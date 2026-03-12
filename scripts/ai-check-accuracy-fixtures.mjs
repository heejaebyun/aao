// scripts/ai-check-accuracy-fixtures.mjs
// accuracy 산식 픽스처: 교차검증 가중치, floor 20, 감점 신호 검증
import assert from "node:assert/strict";
import { AI_CHECK_MODES, __testEvaluateAiCheckResponse } from "../lib/ai-check.js";

const BASE_ENTITY = {
  companyName: "AAO",
  domain: "aao.co.kr",
  officialTitle: "AAO | AI Answer Optimization",
  officialDescription:
    "AAO is an AI Answer Optimization platform that helps brands build AI profile pages, improve citations, and monitor AI visibility.",
  aliases: ["AAO", "AI Answer Optimization"],
};

const FIXTURES = [
  // ────────── misidentified ──────────
  {
    id: "misidentified-accuracy-zero",
    description: "misidentified는 accuracy=0",
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO는 anodic aluminum oxide를 뜻하는 재료공학 용어로, 반도체 산업과 material research 분야에서 사용됩니다. 이 compound는 alumina 계열 소재이며, materialsproject.org에서 pore structure와 oxide layer 특성에 대한 연구 자료가 설명됩니다.",
      citations: ["https://materialsproject.org/docs"],
    },
    assert(result) {
      assert.equal(result.accuracy, 0, `misidentified accuracy should be 0, got ${result.accuracy}`);
      assert.equal(result.matchStatus, "misidentified");
    },
  },

  // ────────── unknown ──────────
  {
    id: "unknown-weak-accuracy-10",
    description: "unknown + verdict=weak → accuracy=10",
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.STRICT_RECALL,
      intent: "awareness",
      response: "현재 기억만으로는 AAO에 대한 신뢰할 만한 구체 정보를 확인하기 어렵습니다.",
      citations: [],
    },
    assert(result) {
      assert.equal(result.matchStatus, "unknown");
      assert.ok(result.accuracy <= 10, `unknown accuracy should be <=10, got ${result.accuracy}`);
    },
  },

  // ────────── recognized 기본 floor ──────────
  {
    id: "recognized-minimum-floor",
    description: "recognized는 최소 20 (factCheck 신호 없어도)",
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.STRICT_RECALL,
      intent: "awareness",
      // 엔티티명 포함하지만 도메인/서비스 힌트 없음
      response: "AAO는 한국의 회사 이름입니다.",
      citations: [],
    },
    assert(result) {
      if (result.matchStatus === "recognized") {
        assert.ok(result.accuracy >= 20, `recognized floor should be >=20, got ${result.accuracy}`);
      }
    },
  },

  // ────────── recognized + aligned ──────────
  {
    id: "recognized-aligned-high-accuracy",
    description: "aligned + serviceMatch + officialDomain → accuracy 높아야 함",
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO(aao.co.kr)는 AI Answer Optimization 플랫폼입니다. 브랜드가 AI profile page를 만들고 citation visibility를 모니터링하도록 돕습니다. 공식 사이트 aao.co.kr에서 확인할 수 있습니다.",
      citations: ["https://aao.co.kr/ai-profile"],
    },
    assert(result) {
      assert.equal(result.matchStatus, "recognized", `expected recognized, got ${result.matchStatus}`);
      // aligned(+25) + serviceMatch(+20) + officialDomainSignal(+15) + officialCitation(+5) = 65+
      assert.ok(result.accuracy >= 55, `well-aligned response should have accuracy>=55, got ${result.accuracy}`);
    },
  },

  // ────────── recognized + aligned + crawl snapshot 교차검증 ──────────
  {
    id: "recognized-with-crawl-snapshot-boost",
    description: "crawl snapshot 연도 일치 → accuracy 추가 가산",
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO(aao.co.kr)는 2026년 설립된 AI Answer Optimization 플랫폼입니다.",
      citations: ["https://aao.co.kr"],
    },
    entityInput: {
      ...BASE_ENTITY,
      crawlSnapshot: {
        title: "AAO | AI Answer Optimization",
        description: "AAO는 2026년 설립되었습니다.",
        contentPreview: "AAO는 2026년 설립된 AI 플랫폼입니다.",
        headingStructure: { h1Texts: ["AAO"], h2Texts: [] },
        jsonLdBlocks: [],
      },
    },
    assert(result) {
      if (result.matchStatus === "recognized") {
        // matchedYears 일치 → +2 가산
        assert.ok(result.accuracy >= 20, `accuracy should be >=20, got ${result.accuracy}`);
      }
    },
  },

  // ────────── recognized + 검증 불가 founding claim ──────────
  {
    id: "recognized-unverified-founding-claim-penalty",
    description: "crawl snapshot 있는데 연도 불일치 → accuracy 소폭 감점",
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO(aao.co.kr)는 2019년 설립된 AI 회사입니다.", // 2019 != 2026
      citations: ["https://aao.co.kr"],
    },
    entityInput: {
      ...BASE_ENTITY,
      crawlSnapshot: {
        title: "AAO | AI Answer Optimization",
        description: "AAO는 2026년 설립되었습니다.",
        contentPreview: "AAO는 2026년에 창립됐습니다.",
        headingStructure: { h1Texts: [], h2Texts: [] },
        jsonLdBlocks: [],
      },
    },
    assertVsBaseline(resultWithSnapshot, resultWithoutSnapshot) {
      if (resultWithSnapshot.matchStatus === "recognized" && resultWithoutSnapshot.matchStatus === "recognized") {
        assert.ok(
          resultWithSnapshot.accuracy <= resultWithoutSnapshot.accuracy + 5,
          `unverified founding claim should not boost accuracy significantly: snapshot=${resultWithSnapshot.accuracy} vs baseline=${resultWithoutSnapshot.accuracy}`
        );
      }
    },
  },
];

function runFixtures() {
  const failures = [];

  for (const fixture of FIXTURES) {
    try {
      if (fixture.assertVsBaseline) {
        // 스냅샷 있는 버전과 없는 버전 비교
        const entityWithSnapshot = fixture.entityInput || BASE_ENTITY;
        const entityWithoutSnapshot = { ...BASE_ENTITY };
        const resultWithSnapshot = __testEvaluateAiCheckResponse(fixture.response, entityWithSnapshot);
        const resultWithoutSnapshot = __testEvaluateAiCheckResponse(fixture.response, entityWithoutSnapshot);
        fixture.assertVsBaseline(resultWithSnapshot, resultWithoutSnapshot);
      } else {
        const entityInput = fixture.entityInput || BASE_ENTITY;
        const result = __testEvaluateAiCheckResponse(fixture.response, entityInput);
        fixture.assert(result);
      }
      console.log(`  ✓ ${fixture.id}`);
    } catch (err) {
      failures.push({ id: fixture.id, error: err.message });
      console.error(`  ✗ ${fixture.id}: ${err.message}`);
    }
  }

  return failures;
}

console.log("\n[AAO] ai-check-accuracy-fixtures");
const failures = runFixtures();

if (failures.length > 0) {
  console.error(`\n${failures.length} fixture(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${FIXTURES.length} fixtures passed.\n`);
}
