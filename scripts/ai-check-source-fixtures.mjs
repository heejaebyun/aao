import assert from "node:assert/strict";
import { __testEvaluateSourceProfile } from "../lib/ai-check.js";

const FIXTURES = [
  {
    id: "software-strong",
    entityInput: {
      companyName: "AAO",
      domain: "aao.co.kr",
      officialTitle: "AAO | AI Answer Optimization",
      officialDescription: "AI Answer Optimization software platform for brands and SaaS teams",
      aliases: ["AAO", "AI Answer Optimization"],
    },
    citations: [
      "https://aao.co.kr/ai-profile",
      "https://www.g2.com/products/aao",
      "https://techcrunch.com/2026/01/10/aao-launch",
      "https://docs.vendor.io/aao-guide",
    ],
    expected: {
      archetypeId: "software_service",
      sourceFitStatus: "strong",
      sourceMixId: "mixed",
    },
  },
  {
    id: "local-business-strong",
    entityInput: {
      companyName: "Gangnam Yoga Studio",
      domain: "gangnamyoga.kr",
      officialTitle: "Gangnam Yoga Studio",
      officialDescription: "강남 요가 필라테스 스튜디오",
      aliases: ["강남 요가", "Gangnam Yoga"],
    },
    citations: [
      "https://gangnamyoga.kr",
      "https://www.yelp.com/biz/gangnam-yoga-seoul",
      "https://www.tripadvisor.com/Attraction_Review-gangnam-yoga",
      "https://www.instagram.com/gangnamyoga",
    ],
    expected: {
      archetypeId: "local_business",
      sourceFitStatus: "strong",
      dominantTypeId: "directory",
    },
  },
  {
    id: "creator-strong",
    entityInput: {
      companyName: "Jane Creator",
      domain: "janecreator.kr",
      officialTitle: "Jane Creator | Beauty Creator",
      officialDescription: "뷰티 유튜버이자 인스타그램 인플루언서",
      aliases: ["Jane Creator", "제인 크리에이터"],
    },
    citations: [
      "https://janecreator.kr",
      "https://www.instagram.com/janecreator",
      "https://www.youtube.com/@janecreator",
      "https://www.threads.net/@janecreator",
    ],
    expected: {
      archetypeId: "creator_media",
      sourceFitStatus: "strong",
      dominantTypeId: "social",
    },
  },
  {
    id: "developer-tool-strong",
    entityInput: {
      companyName: "DevFlow SDK",
      domain: "devflow.io",
      officialTitle: "DevFlow SDK",
      officialDescription: "Developer API SDK and CLI for workflow automation",
      aliases: ["DevFlow", "DevFlow API"],
    },
    citations: [
      "https://devflow.io",
      "https://docs.readthedocs.io/en/latest/devflow.html",
      "https://github.com/devflow/sdk",
      "https://stackoverflow.com/questions/tagged/devflow",
    ],
    expected: {
      archetypeId: "developer_tool",
      sourceFitStatus: "strong",
    },
  },
  {
    id: "software-official-gap",
    entityInput: {
      companyName: "AIOps Cloud",
      domain: "aiopscloud.com",
      officialTitle: "AIOps Cloud",
      officialDescription: "AIOps software platform for enterprise monitoring",
      aliases: ["AIOps Cloud"],
    },
    citations: [
      "https://www.g2.com/products/aiops-cloud",
      "https://www.capterra.com/p/aiops-cloud",
      "https://www.reuters.com/markets/aiops-cloud",
    ],
    expected: {
      archetypeId: "software_service",
      sourceFitStatus: "official_gap",
      sourceMixId: "third_party_only",
    },
  },
  {
    id: "software-off-pattern",
    entityInput: {
      companyName: "SignalDesk AI",
      domain: "signaldesk.ai",
      officialTitle: "SignalDesk AI",
      officialDescription: "AI platform for operations automation",
      aliases: ["SignalDesk"],
    },
    citations: [
      "https://www.instagram.com/signaldesk",
      "https://www.tiktok.com/@signaldesk",
      "https://medium.com/@signaldesk/launch-story",
    ],
    expected: {
      archetypeId: "software_service",
      sourceFitStatus: "off_pattern",
      sourceMixId: "third_party_only",
    },
  },
];

function runFixtures() {
  const failures = [];
  const results = FIXTURES.map((fixture) => {
    const evaluated = __testEvaluateSourceProfile(fixture.citations, fixture.entityInput);
    const profile = evaluated.sourceProfile;

    try {
      assert.equal(profile.archetypeId, fixture.expected.archetypeId);
      assert.equal(profile.sourceFitStatus, fixture.expected.sourceFitStatus);

      if (fixture.expected.sourceMixId) {
        assert.equal(evaluated.sourceMix.id, fixture.expected.sourceMixId);
      }

      if (fixture.expected.dominantTypeId) {
        assert.equal(profile.dominantTypeId, fixture.expected.dominantTypeId);
      }

      return {
        id: fixture.id,
        ok: true,
        archetypeId: profile.archetypeId,
        sourceFitStatus: profile.sourceFitStatus,
        sourceMixId: evaluated.sourceMix.id,
      };
    } catch (error) {
      failures.push({
        id: fixture.id,
        error: error.message,
        actual: {
          archetypeId: profile.archetypeId,
          sourceFitStatus: profile.sourceFitStatus,
          sourceMixId: evaluated.sourceMix.id,
          dominantTypeId: profile.dominantTypeId,
          sourceFitAverage: profile.sourceFitAverage,
          sourceQualityAverage: profile.sourceQualityAverage,
        },
        expected: fixture.expected,
      });

      return {
        id: fixture.id,
        ok: false,
        archetypeId: profile.archetypeId,
        sourceFitStatus: profile.sourceFitStatus,
        sourceMixId: evaluated.sourceMix.id,
      };
    }
  });

  console.log(JSON.stringify({ passed: failures.length === 0, total: FIXTURES.length, results, failures }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

runFixtures();
