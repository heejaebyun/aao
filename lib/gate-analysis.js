function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickStatus(score) {
  if (score >= 75) return "pass";
  if (score >= 45) return "warn";
  return "fail";
}

function countAiStatus(aiResults, status) {
  return (aiResults || []).filter((result) => result?.matchStatus === status).length;
}

function countSupportedAiResults(aiResults) {
  return (aiResults || []).filter((result) => result?.status !== "unsupported" && result?.status !== "skipped").length;
}

function getWordCount(crawlData) {
  return crawlData?.metadata?.totalWordCount || 0;
}

function getHeadingCount(crawlData, level) {
  return crawlData?.metadata?.headingStructure?.[`${level}Count`] || 0;
}

function hasEntitySignals(crawlData, diagnosis) {
  const content = [
    crawlData?.title || "",
    crawlData?.description || "",
    ...(crawlData?.metadata?.headingStructure?.h1Texts || []),
    ...(crawlData?.metadata?.headingStructure?.h2Texts || []),
  ]
    .join(" ")
    .toLowerCase();
  const companyName = diagnosis?.company_name || "";
  const title = crawlData?.title || "";

  return Boolean(companyName) && (
    content.includes(companyName.toLowerCase()) ||
    title.toLowerCase().includes(companyName.toLowerCase())
  );
}

function evaluateDiscovery(crawlData) {
  const wordCount = getWordCount(crawlData);
  const hasTitle = Boolean(crawlData?.title);
  const hasDescription = Boolean(crawlData?.description);
  const h1Count = getHeadingCount(crawlData, "h1");
  const crawlConfidence = crawlData?.crawlConfidence || 0;
  const pageCount = crawlData?.crawledPages?.length || 0;

  const robots = crawlData?.discoverySignals?.robots;
  const sitemap = crawlData?.discoverySignals?.sitemap;
  const indexability = crawlData?.metadata?.indexability;
  const canonicalUrl = crawlData?.metadata?.canonicalUrl;
  const canonicalMatchesUrl = crawlData?.metadata?.canonicalMatchesUrl;
  const canonicalSameOrigin = crawlData?.metadata?.canonicalSameOrigin;
  const allowedCount = robots?.summary?.allowedCount ?? null;
  const deniedCount = robots?.summary?.deniedCount ?? null;

  let score = 0;
  if (hasTitle) score += 25;
  if (hasDescription) score += 15;
  if (h1Count > 0) score += 10;
  if (wordCount >= 80) score += 20;
  else if (wordCount >= 30) score += 10;
  if (pageCount > 0) score += 10;
  score += clamp(Math.round(crawlConfidence / 5), 0, 20);

  // robots.txt LLM bot signal (mild adjustment only)
  if (robots?.fetched) {
    if (deniedCount >= 4) score = Math.max(0, score - 10);
    else if (allowedCount >= 4) score = Math.min(score + 5, 100);
  }

  if (sitemap?.fetched && sitemap.exists) {
    score = Math.min(score + 5, 100);
    if (sitemap.containsRequestedUrl || sitemap.containsRequestedPath) {
      score = Math.min(score + 5, 100);
    }
  }

  if (indexability?.status === "noindex") {
    score = Math.max(0, score - 25);
  } else if (indexability?.status === "indexable") {
    score = Math.min(score + 8, 100);
  } else if (indexability?.status === "likely_indexable") {
    score = Math.min(score + 4, 100);
  }

  if (canonicalMatchesUrl === true) {
    score = Math.min(score + 4, 100);
  } else if (canonicalMatchesUrl === false) {
    score = Math.max(0, score - 6);
  }

  if (canonicalSameOrigin === false) {
    score = Math.max(0, score - 4);
  }

  score = clamp(score, 0, 100);

  const status = pickStatus(score);
  const reason = indexability?.status === "noindex"
    ? "페이지가 수집되더라도 noindex 신호가 있어 검색·발견 단계에서 누락될 가능성이 큽니다."
    : status === "pass"
      ? "공개 URL에서 제목·설명·본문을 읽을 수 있고 sitemap·canonical·indexability 신호도 대체로 안정적입니다."
      : status === "warn"
        ? "URL은 열리지만 발견성 신호가 얕거나 canonical/indexability 정합성이 부족해 외부 AI가 안정적으로 찾기엔 약할 수 있습니다."
        : "공개 URL 자체는 있어도 메타·본문·색인성 신호가 약해 발견 단계부터 누락될 가능성이 큽니다.";

  const evidence = [
    `제목 ${hasTitle ? "있음" : "없음"}`,
    `설명 ${hasDescription ? "있음" : "없음"}`,
    `수집 단어 ${wordCount}개`,
  ];

  if (robots?.fetched && allowedCount !== null) {
    if (deniedCount >= 4) {
      evidence.push(`LLM 봇 대부분 차단됨 (${deniedCount}/6)`);
    } else {
      evidence.push(`LLM 봇 ${allowedCount}/6 허용`);
    }
  } else if (robots?.fetched === false) {
    evidence.push("robots.txt 확인 불가");
  }

  if (sitemap?.fetched) {
    if (sitemap.exists) {
      evidence.push(
        sitemap.containsRequestedUrl || sitemap.containsRequestedPath
          ? `sitemap 포함 확인 (${sitemap.format}, loc ${sitemap.locCount || sitemap.urlCount || 0}개)`
          : `sitemap 있음 (${sitemap.format})`
      );
    } else {
      evidence.push("sitemap.xml 미확인");
    }
  } else {
    evidence.push("sitemap.xml 확인 불가");
  }

  if (indexability?.status) {
    const statusLabel =
      indexability.status === "noindex"
        ? "noindex"
        : indexability.status === "indexable"
          ? "index 가능"
          : indexability.status === "likely_indexable"
            ? "index 가능 추정"
            : "미확인";
    evidence.push(`indexability ${statusLabel}`);
  }

  if (canonicalUrl) {
    if (canonicalMatchesUrl === true) {
      evidence.push("self-canonical");
    } else if (canonicalMatchesUrl === false) {
      evidence.push("canonical mismatch");
    } else {
      evidence.push("canonical 있음");
    }

    if (canonicalSameOrigin === false) {
      evidence.push("canonical cross-origin");
    }
  } else {
    evidence.push("canonical 없음");
  }

  return {
    id: "discovery",
    label: "Discovery",
    title: "발견 신호",
    status,
    score,
    reason,
    evidence,
  };
}

function evaluateAccessibility(crawlData) {
  const wordCount = getWordCount(crawlData);
  const h1Count = getHeadingCount(crawlData, "h1");
  const h2Count = getHeadingCount(crawlData, "h2");
  const hasJsonLd = Boolean(crawlData?.metadata?.hasJsonLd);
  const hasOpenGraph = Boolean(crawlData?.metadata?.hasOpenGraph);
  const longBlocks = crawlData?.metadata?.longTextBlocks || 0;
  const textRatio = crawlData?.metadata?.textContentRatio || 0;

  let score = 0;
  if (wordCount >= 150) score += 30;
  else if (wordCount >= 80) score += 20;
  else if (wordCount >= 30) score += 10;
  if (h1Count > 0) score += 15;
  if (h2Count > 0) score += 15;
  if (hasJsonLd) score += 15;
  if (hasOpenGraph) score += 10;
  if (textRatio >= 60) score += 10;
  if (longBlocks === 0) score += 5;

  const llmsTxt = crawlData?.discoverySignals?.llmsTxt;
  if (llmsTxt?.fetched) {
    if (llmsTxt.exists) score = Math.min(score + 5, 100);
  }

  const status = pickStatus(score);
  const reason =
    status === "pass"
      ? "본문, 헤딩, 구조화 신호가 있어 AI가 실제 페이지를 파싱하는 데 큰 장애는 적습니다."
      : status === "warn"
        ? "일부 구조는 읽히지만 헤딩·본문·구조화 데이터가 충분하지 않아 파싱 안정성이 흔들릴 수 있습니다."
        : "본문이나 구조 신호가 약해 AI가 페이지를 읽더라도 핵심 내용을 안정적으로 추출하기 어렵습니다.";

  const evidence = [
    `H1 ${h1Count}개 / H2 ${h2Count}개`,
    `JSON-LD ${hasJsonLd ? "있음" : "없음"}`,
    `텍스트 비율 ${textRatio}%`,
  ];

  if (llmsTxt?.fetched) {
    evidence.push(`llms.txt ${llmsTxt.exists ? "있음" : "없음 (권고)"}`);
  }

  return {
    id: "accessibility",
    label: "Accessibility",
    title: "접근·파싱",
    status,
    score,
    reason,
    evidence,
  };
}

function evaluateEntity(crawlData, diagnosis) {
  const sepScore = diagnosis?.sep?.score || 0;
  const companyName = diagnosis?.company_name || "";
  const multilingual = diagnosis?.sep?.subscores?.multilingual?.score || 0;
  const entityClarity = diagnosis?.sep?.subscores?.entity_clarity?.score || 0;
  const hasEntity = hasEntitySignals(crawlData, diagnosis);

  let score = 0;
  score += clamp(Math.round((sepScore / 30) * 60), 0, 60);
  if (hasEntity) score += 15;
  if (companyName) score += 10;
  if (entityClarity >= 4) score += 10;
  if (multilingual >= 4) score += 5;

  const status = pickStatus(score);
  const reason =
    status === "pass"
      ? "회사명과 서비스 정의가 비교적 일관돼 엔티티를 하나의 실체로 이해할 가능성이 높습니다."
      : status === "warn"
        ? "회사명은 보이지만 서비스 정의나 관계 설명이 약해 엔티티를 개념이나 약어로 오해할 여지가 있습니다."
        : "회사명·서비스명·관계 정의가 약해 AI가 정확한 엔티티를 특정하지 못하거나 다른 뜻으로 오인할 가능성이 큽니다.";

  return {
    id: "entity",
    label: "Entity",
    title: "엔티티 이해",
    status,
    score,
    reason,
    evidence: [
      `SEP ${sepScore}/30`,
      `회사명 ${companyName ? "감지됨" : "불명확"}`,
      `다국어 일관성 ${multilingual}/6`,
    ],
  };
}

function evaluateAnswer(aiResults) {
  const supportedCount = countSupportedAiResults(aiResults);
  const recognized = countAiStatus(aiResults, "recognized");
  const misidentified = countAiStatus(aiResults, "misidentified");
  const unknown = countAiStatus(aiResults, "unknown");
  const error = countAiStatus(aiResults, "error");
  const wrongEntity = (aiResults || []).filter((result) => result?.factCheck?.verdict === "wrong_entity").length;
  const domainMismatch = (aiResults || []).filter((result) => result?.factCheck?.verdict === "domain_mismatch").length;
  const serviceMismatch = (aiResults || []).filter((result) => result?.factCheck?.verdict === "service_mismatch").length;
  const factAligned = (aiResults || []).filter((result) => result?.factCheck?.verdict === "aligned").length;

  let score = 0;
  if (supportedCount > 0) {
    score = Math.round(
      (
        (recognized * 1) +
        (unknown * 0.35) +
        (factAligned * 0.1) +
        (wrongEntity * -0.9) +
        (domainMismatch * -0.55) +
        (serviceMismatch * -0.45) +
        (error * -0.15)
      ) / supportedCount * 100
    );
  }
  score = clamp(score, 0, 100);

  const status =
    supportedCount === 0
      ? "fail"
      : wrongEntity > 0 || domainMismatch > 0 || misidentified > 0
        ? "fail"
        : pickStatus(score);
  const reason =
    supportedCount === 0
      ? "검색 기반 AI 결과가 없어 답변 단계 안정성을 아직 판정할 수 없습니다."
      : wrongEntity > 0
        ? "적어도 한 엔진이 다른 회사를 설명하고 있어 답변 단계의 오인식 리스크가 큽니다."
        : domainMismatch > 0
          ? "적어도 한 엔진이 공식 도메인과 맞지 않는 엔티티를 답변에 연결하고 있습니다."
          : status === "pass"
            ? "여러 AI 엔진이 이 회사를 비교적 일관되게 인식하고 있고, 공식 정보와의 정합성도 양호합니다."
            : status === "warn"
              ? "일부 엔진은 인식하지만 아직 불확실하거나 서비스 정의 정합성이 흔들려 답변 품질 편차가 남아 있습니다."
              : misidentified > 0
                ? "적어도 한 엔진이 다른 엔티티를 설명하거나 개념으로 오해하고 있어 오인식 리스크가 큽니다."
                : "대부분의 엔진이 회사를 특정하지 못해 AI 답변 단계에서 노출이 약합니다.";

  return {
    id: "answer",
    label: "Answer",
    title: "AI 답변",
    status,
    score,
    reason,
    evidence: [
      `지원 엔진 ${supportedCount}개`,
      `정확 인식 ${recognized}개`,
      `오인식 ${misidentified}개`,
      `다른 엔티티 ${wrongEntity}개`,
      `도메인 불일치 ${domainMismatch}개`,
      `서비스 불일치 ${serviceMismatch}개`,
      `미인식/오류 ${unknown + error}개`,
    ],
  };
}

function evaluateSource(crawlData, diagnosis) {
  const pacpScore = diagnosis?.pacp?.score || 0;
  const trustSignals = diagnosis?.pacp?.subscores?.high_trust_signals?.score || 0;
  const authoritySignals = diagnosis?.pacp?.subscores?.authority_signals?.score || 0;
  const hasJsonLd = Boolean(crawlData?.metadata?.hasJsonLd);

  let score = 0;
  score += clamp(Math.round((pacpScore / 40) * 70), 0, 70);
  if (trustSignals >= 4) score += 10;
  if (authoritySignals >= 4) score += 10;
  if (hasJsonLd) score += 10;

  const status = pickStatus(score);
  const reason =
    status === "pass"
      ? "공식 사이트를 1차 출처로 삼을 만한 구조와 신뢰 신호가 비교적 잘 갖춰져 있습니다."
      : status === "warn"
        ? "공식 출처로 쓰일 기반은 있지만 수치, 사례, 레퍼런스 같은 인용 근거가 더 필요합니다."
        : "공식 사이트가 AI의 1차 출처로 채택되기엔 인용 가능한 수치·근거·권위 신호가 아직 부족합니다.";

  return {
    id: "source",
    label: "Source",
    title: "공식 출처성",
    status,
    score,
    reason,
    evidence: [
      `PACP ${pacpScore}/40`,
      `고신뢰 시그널 ${trustSignals}/8`,
      `권위 신호 ${authoritySignals}/8`,
    ],
  };
}

export function deriveGateSummary({ crawlData, diagnosis, aiResults }) {
  if (!crawlData || !diagnosis) return null;

  const gates = [
    evaluateDiscovery(crawlData),
    evaluateAccessibility(crawlData),
    evaluateEntity(crawlData, diagnosis),
    evaluateAnswer(aiResults),
    evaluateSource(crawlData, diagnosis),
  ];

  const passCount = gates.filter((gate) => gate.status === "pass").length;
  const failCount = gates.filter((gate) => gate.status === "fail").length;

  let headline = "앞단 레이어를 통과하고 있습니다.";
  if (failCount >= 3) {
    headline = "앞단 여러 레이어에서 막히고 있습니다.";
  } else if (failCount >= 1) {
    headline = "일부 핵심 레이어에서 병목이 확인됩니다.";
  } else if (passCount >= 4) {
    headline = "앞단 신호는 비교적 양호합니다.";
  }

  return {
    headline,
    note: "Discovery는 크롤링 성공 · 기본 메타 신호 · robots.txt LLM 봇 접근 허용 여부를 포함합니다. llms.txt는 권고 신호로만 반영됩니다.",
    gates,
  };
}
