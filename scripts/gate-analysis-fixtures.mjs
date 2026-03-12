// scripts/gate-analysis-fixtures.mjs
// gate 판정 픽스처: provenance 할인, Answer Gate 가중치, Entity/Source 임계값 검증
import assert from "node:assert/strict";
import {
  __testEvaluateEntity,
  __testEvaluateSource,
  __testEvaluateAnswer,
} from "../lib/gate-analysis.js";

const BASE_CRAWL = {
  title: "TestCo",
  metadata: {
    headingStructure: { h1Count: 1, h2Count: 2, h1Texts: ["TestCo"], h2Texts: [], h3Count: 0 },
    totalWordCount: 400,
    hasJsonLd: true,
    hasOpenGraph: true,
    longTextBlocks: 0,
    textContentRatio: 70,
  },
};

// 완전한 model 기반 diagnosis (source = "model_axis_score")
const DIAGNOSIS_MODEL = {
  company_name: "TestCo",
  sep: {
    score: 24,
    source: "model_axis_score",
    subscores: {
      entity_clarity: { score: 5 },
      info_density: { score: 5 },
      semantic_unambiguity: { score: 5 },
      kg_alignment: { score: 5 },
      multilingual: { score: 4 },
    },
  },
  pacp: {
    score: 32,
    source: "model_axis_score",
    subscores: {
      high_trust_signals: { score: 7 },
      inverted_pyramid: { score: 7 },
      citation_worthy: { score: 6 },
      factual_completeness: { score: 6 },
      authority_signals: { score: 6 },
    },
  },
};

// fallback 기반 diagnosis (source = "fallback_axis")
const DIAGNOSIS_FALLBACK = {
  company_name: "TestCo",
  sep: {
    score: 24,
    source: "fallback_axis",
    subscores: {
      entity_clarity: { score: 5 },
      info_density: { score: 5 },
      semantic_unambiguity: { score: 5 },
      kg_alignment: { score: 5 },
      multilingual: { score: 4 },
    },
  },
  pacp: {
    score: 32,
    source: "fallback_axis",
    subscores: {
      high_trust_signals: { score: 7 },
      inverted_pyramid: { score: 7 },
      citation_worthy: { score: 6 },
      factual_completeness: { score: 6 },
      authority_signals: { score: 6 },
    },
  },
};

const FIXTURES = [
  {
    id: "entity-gate-model-scores-higher-than-fallback",
    description: "model 기반 SEP가 같은 점수라도 fallback보다 Entity gate 점수가 높거나 같아야 함",
    assert() {
      const entityModel = __testEvaluateEntity(BASE_CRAWL, DIAGNOSIS_MODEL);
      const entityFallback = __testEvaluateEntity(BASE_CRAWL, DIAGNOSIS_FALLBACK);
      assert.ok(
        entityModel.score >= entityFallback.score,
        `model entity(${entityModel.score}) should be >= fallback entity(${entityFallback.score})`
      );
    },
  },
  {
    id: "entity-gate-fallback-provenance-discount-applied",
    description: "fallback SEP는 provenance 할인(x0.75)이 적용돼야 함",
    assert() {
      const entity = __testEvaluateEntity(BASE_CRAWL, DIAGNOSIS_FALLBACK);
      assert.ok(entity.provenance?.discounted === true, "fallback provenance should be discounted");
      assert.equal(entity.provenance?.discount, 0.75, "fallback discount should be 0.75");
    },
  },
  {
    id: "entity-gate-model-provenance-no-discount",
    description: "model SEP는 할인 없음",
    assert() {
      const entity = __testEvaluateEntity(BASE_CRAWL, DIAGNOSIS_MODEL);
      assert.ok(entity.provenance?.discounted === false, "model provenance should not be discounted");
    },
  },
  {
    id: "source-gate-model-scores-higher-than-fallback",
    description: "model 기반 PACP가 같은 점수라도 fallback보다 Source gate 점수가 높거나 같아야 함",
    assert() {
      const sourceModel = __testEvaluateSource(BASE_CRAWL, DIAGNOSIS_MODEL);
      const sourceFallback = __testEvaluateSource(BASE_CRAWL, DIAGNOSIS_FALLBACK);
      assert.ok(
        sourceModel.score >= sourceFallback.score,
        `model source(${sourceModel.score}) should be >= fallback source(${sourceFallback.score})`
      );
    },
  },
  {
    id: "answer-gate-all-recognized-passes",
    description: "3개 엔진 모두 recognized → Answer gate pass",
    assert() {
      const aiResults = [
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
      ];
      const gate = __testEvaluateAnswer(aiResults);
      assert.equal(gate.status, "pass", `all-recognized should pass, got ${gate.status}`);
      assert.ok(gate.score >= 75, `score should be >=75, got ${gate.score}`);
    },
  },
  {
    id: "answer-gate-wrong-entity-forces-fail",
    description: "wrong_entity 1개라도 있으면 Answer gate 강제 fail",
    assert() {
      const aiResults = [
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
        { matchStatus: "misidentified", factCheck: { verdict: "wrong_entity" }, status: "success" },
      ];
      const gate = __testEvaluateAnswer(aiResults);
      assert.equal(gate.status, "fail", `wrong_entity should force fail, got ${gate.status}`);
    },
  },
  {
    id: "answer-gate-all-unknown-fails",
    description: "모든 엔진이 unknown → Answer gate fail",
    assert() {
      const aiResults = [
        { matchStatus: "unknown", factCheck: { verdict: "weak" }, status: "success" },
        { matchStatus: "unknown", factCheck: { verdict: "weak" }, status: "success" },
        { matchStatus: "unknown", factCheck: { verdict: "weak" }, status: "success" },
      ];
      const gate = __testEvaluateAnswer(aiResults);
      // unknown weight=0.35 → score = 0.35*3/3*100 = 35 → fail (<45)
      assert.equal(gate.status, "fail", `all-unknown should fail, got ${gate.status}`);
      assert.ok(gate.score < 45, `all-unknown score should be <45, got ${gate.score}`);
    },
  },
  {
    id: "answer-gate-empty-results-fails",
    description: "AI 결과 없으면 Answer gate fail",
    assert() {
      const gate = __testEvaluateAnswer([]);
      assert.equal(gate.status, "fail", `empty results should fail, got ${gate.status}`);
    },
  },
  {
    id: "answer-gate-mixed-recognized-unknown",
    description: "recognized 2 + unknown 1 → warn 이상",
    assert() {
      const aiResults = [
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
        { matchStatus: "recognized", factCheck: { verdict: "aligned" }, status: "success" },
        { matchStatus: "unknown", factCheck: { verdict: "weak" }, status: "success" },
      ];
      const gate = __testEvaluateAnswer(aiResults);
      // score = (1+1+0.35)/3*100 = 78 → pass
      assert.ok(["pass", "warn"].includes(gate.status),
        `2-recognized+1-unknown should be pass or warn, got ${gate.status}`);
    },
  },
];

function runFixtures() {
  const failures = [];

  for (const fixture of FIXTURES) {
    try {
      fixture.assert();
      console.log(`  ✓ ${fixture.id}`);
    } catch (err) {
      failures.push({ id: fixture.id, error: err.message });
      console.error(`  ✗ ${fixture.id}: ${err.message}`);
    }
  }

  return failures;
}

console.log("\n[AAO] gate-analysis-fixtures");
const failures = runFixtures();

if (failures.length > 0) {
  console.error(`\n${failures.length} fixture(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${FIXTURES.length} fixtures passed.\n`);
}
