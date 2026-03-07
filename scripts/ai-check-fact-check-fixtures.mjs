import assert from "node:assert/strict";
import {
  AI_CHECK_MODES,
  __testEvaluateAiCheckResponse,
} from "../lib/ai-check.js";

const BASE_ENTITY = {
  companyName: "AAO",
  domain: "aao.co.kr",
  officialTitle: "AAO | AI Answer Optimization",
  officialDescription:
    "AAO is an AI Answer Optimization platform that helps brands build AI profile pages, improve citations, and monitor AI visibility.",
  aliases: ["AAO", "AI Answer Optimization"],
};

const FIXTURES = [
  {
    id: "aligned-awareness",
    entityInput: BASE_ENTITY,
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO는 aao.co.kr에서 운영되는 AI Answer Optimization 플랫폼입니다. 브랜드가 AI profile page를 만들고 citation visibility를 모니터링하도록 돕습니다.",
      citations: ["https://aao.co.kr/ai-profile"],
    },
    expected: {
      matchStatus: "recognized",
      factVerdict: "aligned",
    },
  },
  {
    id: "wrong-entity-awareness",
    entityInput: BASE_ENTITY,
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO는 보통 anodic aluminum oxide를 뜻하는 재료공학 용어로 설명됩니다. 이 물질은 산업 연구와 semiconductor coating 문맥에서 자주 언급되며, materialsproject.org 같은 자료가 pore structure와 oxide layer 특성을 설명합니다.",
      citations: ["https://materialsproject.org/docs"],
    },
    expected: {
      matchStatus: "misidentified",
      factVerdict: "wrong_entity",
    },
  },
  {
    id: "domain-mismatch-awareness",
    entityInput: BASE_ENTITY,
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AI Answer Optimization 브랜드인 AAO는 브랜드의 AI citation을 관리하는 service 플랫폼이라고 소개됩니다. 하지만 실제 pricing, customer onboarding, demo 신청, 사례 자료는 모두 partnerhub.io에서 안내되고 있으며 공식 소개도 그 도메인으로 연결됩니다.",
      citations: ["https://partnerhub.io/pricing"],
    },
    expected: {
      matchStatus: "misidentified",
      factVerdict: "domain_mismatch",
    },
  },
  {
    id: "service-mismatch-awareness",
    entityInput: BASE_ENTITY,
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "awareness",
      response:
        "AAO(aao.co.kr)는 대학 입학 행정과 학생 기록을 관리하는 admissions office입니다. 이 조직은 campus administration, 지원서 접수, 서류 검토, 학생 service desk 운영을 담당한다고 설명됩니다.",
      citations: ["https://aao.co.kr"],
    },
    expected: {
      matchStatus: "misidentified",
      factVerdict: "service_mismatch",
    },
  },
  {
    id: "comparison-safe",
    entityInput: BASE_ENTITY,
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.LIVE_SEARCH,
      intent: "comparison",
      response:
        "AAO(aao.co.kr)는 AI Answer Optimization에 집중하고, HubSpot이나 Notion과 비교하면 AI profile page와 citation monitoring에 더 초점을 둡니다. 비교 자료로 hubspot.com이 자주 언급되지만, 공식 엔티티는 AAO입니다.",
      citations: ["https://aao.co.kr/ai-profile", "https://www.hubspot.com"],
    },
    expected: {
      matchStatus: "recognized",
      factVerdict: "aligned",
    },
  },
  {
    id: "weak-unknown-awareness",
    entityInput: BASE_ENTITY,
    response: {
      engine: "fixture",
      mode: AI_CHECK_MODES.STRICT_RECALL,
      intent: "awareness",
      response:
        "현재 기억만으로는 AAO에 대한 신뢰할 만한 구체 정보를 확인하기 어렵습니다. 추측하지 않고 모른다고 답하겠습니다.",
      citations: [],
    },
    expected: {
      matchStatus: "unknown",
      factVerdict: "weak",
    },
  },
];

function runFixtures() {
  const failures = [];
  const results = FIXTURES.map((fixture) => {
    const analyzed = __testEvaluateAiCheckResponse(fixture.response, fixture.entityInput);

    try {
      assert.equal(analyzed.matchStatus, fixture.expected.matchStatus);
      assert.equal(analyzed.factCheck?.verdict, fixture.expected.factVerdict);

      if (fixture.expected.matchStatus === "recognized") {
        assert.ok(analyzed.knows, "recognized fixture should set knows=true");
        assert.ok((analyzed.accuracy || 0) >= 30, "recognized fixture should have meaningful accuracy");
      }

      if (fixture.expected.matchStatus === "misidentified") {
        assert.equal(analyzed.accuracy, 0);
      }

      return {
        id: fixture.id,
        ok: true,
        matchStatus: analyzed.matchStatus,
        factVerdict: analyzed.factCheck?.verdict || "none",
      };
    } catch (error) {
      failures.push({
        id: fixture.id,
        error: error.message,
        actual: {
          matchStatus: analyzed.matchStatus,
          factVerdict: analyzed.factCheck?.verdict || "none",
          reason: analyzed.reason,
          factReasons: analyzed.factCheck?.reasons || [],
          accuracy: analyzed.accuracy,
        },
        expected: fixture.expected,
      });

      return {
        id: fixture.id,
        ok: false,
        matchStatus: analyzed.matchStatus,
        factVerdict: analyzed.factCheck?.verdict || "none",
      };
    }
  });

  console.log(JSON.stringify({ passed: failures.length === 0, total: FIXTURES.length, results, failures }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

runFixtures();
