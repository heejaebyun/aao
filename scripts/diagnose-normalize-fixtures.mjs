// scripts/diagnose-normalize-fixtures.mjs
// diagnose 정규화 픽스처: overall_score 합산, grade 일원화, source 전파 검증
import assert from "node:assert/strict";
import { __testNormalizeDiagnosis } from "../lib/diagnose.js";

const BASE_CRAWL = {
  title: "TestCo",
  content: "TestCo는 AI 솔루션을 제공하는 회사입니다.",
  metadata: {
    headingStructure: { h1Count: 1, h2Count: 2, h1Texts: ["TestCo"], h2Texts: ["서비스", "팀"], h3Count: 0 },
    totalWordCount: 300,
    hasJsonLd: true,
    hasOpenGraph: true,
    longTextBlocks: 0,
    textContentRatio: 70,
    imageCount: 2,
    imagesWithoutAlt: 0,
    tableCount: 0,
    listItemCount: 5,
    longTextBlockThresholdChars: 2000,
  },
  jsonLdBlocks: [],
  url: "https://testco.example.com",
  description: "AI 솔루션 회사",
};

// 완전한 모델 출력 (subscores sum = axis score = overall_score)
const FULL_MODEL_OUTPUT = {
  company_name: "TestCo",
  overall_score: 99, // 무시돼야 함: 실제 합산은 30+22+18=70
  grade: "A+",      // 무시돼야 함: 70점은 B grade
  pacp: {
    score: 30,
    subscores: {
      high_trust_signals: { score: 6, finding: "통계 일부 있음" },
      inverted_pyramid: { score: 6, finding: "상단 요약 있음" },
      citation_worthy: { score: 6, finding: "인용 가능한 문장" },
      factual_completeness: { score: 6, finding: "기본 정보 완비" },
      authority_signals: { score: 6, finding: "JSON-LD 있음" },
    },
    summary_ko: "인용 확률 중간",
    summary_en: "Moderate citation probability",
  },
  sep: {
    score: 22,
    subscores: {
      entity_clarity: { score: 5, finding: "명칭 명확" },
      info_density: { score: 4, finding: "정보 밀도 보통" },
      semantic_unambiguity: { score: 4, finding: "의미 명확" },
      kg_alignment: { score: 5, finding: "업종 분류 가능" },
      multilingual: { score: 4, finding: "한영 병기" },
    },
    summary_ko: "엔티티 정밀도 보통",
    summary_en: "Moderate entity precision",
  },
  spf: {
    score: 18,
    subscores: {
      heading_hierarchy: { score: 4, finding: "헤딩 계층 있음" },
      rendering_access: { score: 4, finding: "정적 렌더링" },
      structured_data: { score: 4, finding: "JSON-LD 있음" },
      token_efficiency: { score: 3, finding: "토큰 효율 보통" },
      chunking_friendly: { score: 3, finding: "청킹 무난" },
    },
    summary_ko: "구조 파싱 보통",
    summary_en: "Moderate structural fidelity",
  },
  customer_summary: {
    headline: "AI가 읽을 수 있지만 인용 신호가 더 필요합니다",
    detail: "기본 정보는 있지만 더 강화가 필요합니다.",
    causes: [
      { icon: "❌", title: "통계 부족", description: "수치가 없습니다." },
      { icon: "❌", title: "구조화 데이터 미흡", description: "필드가 부족합니다." },
      { icon: "❌", title: "권위 신호 약함", description: "레퍼런스가 없습니다." },
    ],
    actions: ["수치 추가", "JSON-LD 보강", "레퍼런스 연결"],
    expected_score_after: 85,
  },
  improvements: [
    {
      priority: "critical",
      axis: "PACP",
      issue: "통계 없음",
      action: "수치 추가",
      expected_impact: "+8점",
      academic_basis: "Princeton GEO",
    },
    {
      priority: "important",
      axis: "SEP",
      issue: "정보 밀도 낮음",
      action: "사실 문장 추가",
      expected_impact: "+5점",
      academic_basis: "Semantic F1",
    },
    {
      priority: "nice",
      axis: "SPF",
      issue: "헤딩 세분화 필요",
      action: "H3 추가",
      expected_impact: "+4점",
      academic_basis: "청킹 최적화",
    },
  ],
};

const FIXTURES = [
  {
    id: "overall-score-is-always-axis-sum",
    description: "overall_score는 항상 pacp+sep+spf 합산 (모델 보고값 무시)",
    modelOutput: FULL_MODEL_OUTPUT,
    crawlData: BASE_CRAWL,
    responseSource: "model",
    assert(result) {
      const expectedSum = result.pacp.score + result.sep.score + result.spf.score;
      assert.equal(result.overall_score, expectedSum, `overall_score(${result.overall_score}) should equal axis sum(${expectedSum})`);
      assert.notEqual(result.overall_score, 99, "model's overall_score=99 must be ignored");
    },
  },
  {
    id: "grade-derived-from-overall-score",
    description: "grade는 항상 overall_score에서 파생 (모델 보고 grade 무시)",
    modelOutput: FULL_MODEL_OUTPUT,
    crawlData: BASE_CRAWL,
    responseSource: "model",
    assert(result) {
      // pacp(30)+sep(22)+spf(18)=70 → B grade
      assert.equal(result.overall_score, 70, "expected overall_score=70");
      assert.equal(result.grade, "B", `grade should be B for 70, got ${result.grade}`);
      assert.notEqual(result.grade, "A+", "model's grade=A+ must be ignored");
    },
  },
  {
    id: "axis-score-equals-subscore-sum",
    description: "각 축 score는 subscores 합산 (모델 axis score 무시)",
    modelOutput: FULL_MODEL_OUTPUT,
    crawlData: BASE_CRAWL,
    responseSource: "model",
    assert(result) {
      const pacpSum = Object.values(result.pacp.subscores).reduce((s, sub) => s + sub.score, 0);
      const sepSum = Object.values(result.sep.subscores).reduce((s, sub) => s + sub.score, 0);
      const spfSum = Object.values(result.spf.subscores).reduce((s, sub) => s + sub.score, 0);
      assert.equal(result.pacp.score, pacpSum, `pacp.score(${result.pacp.score}) !== subscores sum(${pacpSum})`);
      assert.equal(result.sep.score, sepSum, `sep.score(${result.sep.score}) !== subscores sum(${sepSum})`);
      assert.equal(result.spf.score, spfSum, `spf.score(${result.spf.score}) !== subscores sum(${spfSum})`);
    },
  },
  {
    id: "expected-score-after-must-exceed-overall",
    description: "expected_score_after는 overall_score보다 클 때만 유효",
    modelOutput: {
      ...FULL_MODEL_OUTPUT,
      customer_summary: {
        ...FULL_MODEL_OUTPUT.customer_summary,
        expected_score_after: 60, // 70점보다 낮음 → null 처리
      },
    },
    crawlData: BASE_CRAWL,
    responseSource: "model",
    assert(result) {
      assert.equal(result.customer_summary.expected_score_after, null,
        "expected_score_after below overall_score should be null");
    },
  },
  {
    id: "grade-boundaries",
    description: "등급 임계값 경계 검증 (PACP+SEP+SPF 합산 = 경계값)",
    // 각 케이스: PACP/SEP/SPF subscores가 실제로 합산돼 목표 total을 만든다
    cases: [
      // total=90 → A+: PACP[8,8,8,6,6]=36, SEP[6,6,5,5,5]=27, SPF[6,6,5,5,5]=27
      { subs: { pacp: [8,8,8,6,6], sep: [6,6,5,5,5], spf: [6,6,5,5,5] }, expected: "A+" },
      // total=80 → A: PACP[7,7,6,6,6]=32, SEP[5,5,5,5,4]=24, SPF[5,5,5,5,4]=24
      { subs: { pacp: [7,7,6,6,6], sep: [5,5,5,5,4], spf: [5,5,5,5,4] }, expected: "A" },
      // total=60 → B: PACP[5,5,5,4,5]=24, SEP[4,4,4,3,3]=18, SPF[4,4,4,3,3]=18
      { subs: { pacp: [5,5,5,4,5], sep: [4,4,4,3,3], spf: [4,4,4,3,3] }, expected: "B" },
      // total=40 → C: PACP[4,4,3,3,2]=16, SEP[3,3,2,2,2]=12, SPF[3,3,2,2,2]=12
      { subs: { pacp: [4,4,3,3,2], sep: [3,3,2,2,2], spf: [3,3,2,2,2] }, expected: "C" },
      // total=30 → D: PACP[3,3,2,2,2]=12, SEP[2,2,2,2,1]=9, SPF[2,2,2,2,1]=9
      { subs: { pacp: [3,3,2,2,2], sep: [2,2,2,2,1], spf: [2,2,2,2,1] }, expected: "D" },
    ],
    assert(cases) {
      const pacpKeys = ["high_trust_signals","inverted_pyramid","citation_worthy","factual_completeness","authority_signals"];
      const sepKeys = ["entity_clarity","info_density","semantic_unambiguity","kg_alignment","multilingual"];
      const spfKeys = ["heading_hierarchy","rendering_access","structured_data","token_efficiency","chunking_friendly"];

      for (const { subs, expected } of cases) {
        const modelOutput = {
          ...FULL_MODEL_OUTPUT,
          pacp: {
            score: subs.pacp.reduce((a,b) => a+b, 0),
            subscores: Object.fromEntries(pacpKeys.map((k, i) => [k, { score: subs.pacp[i], finding: "test" }])),
            summary_ko: "test", summary_en: "test",
          },
          sep: {
            score: subs.sep.reduce((a,b) => a+b, 0),
            subscores: Object.fromEntries(sepKeys.map((k, i) => [k, { score: subs.sep[i], finding: "test" }])),
            summary_ko: "test", summary_en: "test",
          },
          spf: {
            score: subs.spf.reduce((a,b) => a+b, 0),
            subscores: Object.fromEntries(spfKeys.map((k, i) => [k, { score: subs.spf[i], finding: "test" }])),
            summary_ko: "test", summary_en: "test",
          },
        };
        const total = subs.pacp.reduce((a,b) => a+b, 0) + subs.sep.reduce((a,b) => a+b, 0) + subs.spf.reduce((a,b) => a+b, 0);
        const result = __testNormalizeDiagnosis(modelOutput, BASE_CRAWL, "model");
        assert.equal(result.overall_score, total, `overall_score should be ${total}, got ${result.overall_score}`);
        assert.equal(result.grade, expected, `score=${total} should give grade=${expected}, got ${result.grade}`);
      }
    },
  },
  {
    id: "source-propagation-fallback",
    description: "모델 출력 없으면 source가 fallback_*으로 전파",
    modelOutput: null, // null → 모두 fallback
    crawlData: BASE_CRAWL,
    responseSource: "model",
    assert(result) {
      assert.ok(
        result.source.startsWith("fallback_") || result.provenance?.overall_score?.startsWith("fallback_"),
        `source should be fallback when model output is null, got ${result.source}`
      );
    },
  },
];

// grade boundary 테스트용 최소 모델 출력 생성
function buildMinimalModelOutput(targetTotal) {
  const pacpTarget = Math.round(targetTotal * 0.4);
  const sepTarget = Math.round(targetTotal * 0.3);
  const spfTarget = targetTotal - pacpTarget - sepTarget;

  return {
    company_name: "TestCo",
    overall_score: 0,
    grade: "D",
    pacp: {
      score: pacpTarget,
      subscores: {
        high_trust_signals: { score: Math.min(8, Math.round(pacpTarget / 5)), finding: "test" },
        inverted_pyramid: { score: Math.min(8, Math.round(pacpTarget / 5)), finding: "test" },
        citation_worthy: { score: Math.min(8, Math.round(pacpTarget / 5)), finding: "test" },
        factual_completeness: { score: Math.min(8, Math.round(pacpTarget / 5)), finding: "test" },
        authority_signals: { score: Math.min(8, pacpTarget - Math.min(8, Math.round(pacpTarget / 5)) * 4), finding: "test" },
      },
      summary_ko: "test", summary_en: "test",
    },
    sep: {
      score: sepTarget,
      subscores: {
        entity_clarity: { score: Math.min(6, Math.round(sepTarget / 5)), finding: "test" },
        info_density: { score: Math.min(6, Math.round(sepTarget / 5)), finding: "test" },
        semantic_unambiguity: { score: Math.min(6, Math.round(sepTarget / 5)), finding: "test" },
        kg_alignment: { score: Math.min(6, Math.round(sepTarget / 5)), finding: "test" },
        multilingual: { score: Math.min(6, sepTarget - Math.min(6, Math.round(sepTarget / 5)) * 4), finding: "test" },
      },
      summary_ko: "test", summary_en: "test",
    },
    spf: {
      score: spfTarget,
      subscores: {
        heading_hierarchy: { score: Math.min(6, Math.round(spfTarget / 5)), finding: "test" },
        rendering_access: { score: Math.min(6, Math.round(spfTarget / 5)), finding: "test" },
        structured_data: { score: Math.min(6, Math.round(spfTarget / 5)), finding: "test" },
        token_efficiency: { score: Math.min(6, Math.round(spfTarget / 5)), finding: "test" },
        chunking_friendly: { score: Math.min(6, spfTarget - Math.min(6, Math.round(spfTarget / 5)) * 4), finding: "test" },
      },
      summary_ko: "test", summary_en: "test",
    },
    customer_summary: {
      headline: "test",
      detail: "test",
      causes: [
        { icon: "❌", title: "a", description: "test" },
        { icon: "❌", title: "b", description: "test" },
        { icon: "❌", title: "c", description: "test" },
      ],
      actions: ["action1", "action2", "action3"],
      expected_score_after: Math.min(100, targetTotal + 20),
    },
    improvements: [
      { priority: "critical", axis: "PACP", issue: "test", action: "test", expected_impact: "+5점", academic_basis: "test" },
      { priority: "important", axis: "SEP", issue: "test", action: "test", expected_impact: "+4점", academic_basis: "test" },
      { priority: "nice", axis: "SPF", issue: "test", action: "test", expected_impact: "+3점", academic_basis: "test" },
    ],
  };
}

function runFixtures() {
  const failures = [];

  for (const fixture of FIXTURES) {
    if (fixture.id === "grade-boundaries") {
      try {
        fixture.assert(fixture.cases);
        console.log(`  ✓ ${fixture.id}`);
      } catch (err) {
        failures.push({ id: fixture.id, error: err.message });
        console.error(`  ✗ ${fixture.id}: ${err.message}`);
      }
      continue;
    }

    try {
      const result = __testNormalizeDiagnosis(fixture.modelOutput, fixture.crawlData, fixture.responseSource);
      fixture.assert(result);
      console.log(`  ✓ ${fixture.id}`);
    } catch (err) {
      failures.push({ id: fixture.id, error: err.message });
      console.error(`  ✗ ${fixture.id}: ${err.message}`);
    }
  }

  return failures;
}

console.log("\n[AAO] diagnose-normalize-fixtures");
const failures = runFixtures();

if (failures.length > 0) {
  console.error(`\n${failures.length} fixture(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${FIXTURES.length} fixtures passed.\n`);
}
