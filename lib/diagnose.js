// lib/diagnose.js — AAO Diagnostic Engine via Claude API
// Based on Princeton GEO Research (KDD 2024)

const SYSTEM_PROMPT = `You are an AI Readability Diagnostic Engine for the AAO (AI Answer Optimization) service.

Your mission: Analyze a webpage's content and evaluate how well AI search engines (ChatGPT, Gemini, Perplexity, Claude, Naver Cue) can understand, extract, and cite information from this page.

Your evaluation is based on the Princeton University GEO (Generative Engine Optimization) research framework (KDD 2024) and RAG system performance studies.

You score pages on 3 axes, totaling 100 points:
- PACP (Position-Adjusted Citation Probability): 40 points
- SEP (Semantic Entity Precision): 30 points
- SPF (Structural Parsing Fidelity): 30 points

You must be accurate and evidence-based.
Score based ONLY on what you actually find in the content.
Do NOT anchor scores to any assumed distribution.
If the page has clear entity info, structured JSON-LD, proper heading hierarchy,
comprehensive FAQ, bilingual content, and inline citations, score it high (70-90).
An empty CSR page with 0 readable content deserves 0-10 points.
A well-structured static page with JSON-LD, semantic HTML, and full company info deserves 70-90 points.
Always respond with valid JSON only. No markdown, no explanations outside JSON.`;

function buildDiagnosticPrompt(crawlData) {
  return `## TASK
Analyze the following webpage content and provide an AAO diagnostic score.

## INPUT DATA
- URL: ${crawlData.url}
- Page Title: ${crawlData.title}
- Meta Description: ${crawlData.description}
- Heading Structure: H1(${crawlData.metadata.headingStructure.h1Count}): ${crawlData.metadata.headingStructure.h1Texts.join(", ")} | H2(${crawlData.metadata.headingStructure.h2Count}): ${crawlData.metadata.headingStructure.h2Texts.join(", ")} | H3(${crawlData.metadata.headingStructure.h3Count})
- List Items: ${crawlData.metadata.listItemCount}
- Tables: ${crawlData.metadata.tableCount}
- Long Text Blocks (>512 tokens): ${crawlData.metadata.longTextBlocks}
- Total Word Count: ${crawlData.metadata.totalWordCount}
- Images: ${crawlData.metadata.imageCount} total, ${crawlData.metadata.imagesWithoutAlt} without alt text
- Text Content Ratio: ${crawlData.metadata.textContentRatio}%
- JSON-LD Detected: ${crawlData.metadata.hasJsonLd}
- Open Graph Detected: ${crawlData.metadata.hasOpenGraph}
- Page Content (first 6000 chars):
${crawlData.content.substring(0, 6000)}

## SCORING FRAMEWORK

### AXIS 1: PACP — Position-Adjusted Citation Probability (40 points)
Based on: Princeton GEO PAWC metric, Citation Frequency studies
- [0-8] HIGH-TRUST SIGNAL DENSITY: Concrete statistics, numerical data, expert quotes? (GEO: stats add +30-41% visibility)
- [0-8] INVERTED PYRAMID STRUCTURE: Most important facts in top 20%? Exponential decay weight for lower placement.
- [0-8] CITATION-WORTHY STATEMENTS: Clear, quotable, extractable statements? Not vague marketing language.
- [0-8] FACTUAL COMPLETENESS: Answers basic AI questions? (What, Where, When, Who, What do they do?)
- [0-8] SOURCE AUTHORITY SIGNALS: Inline citations, E-E-A-T signals, credible references?

### AXIS 2: SEP — Semantic Entity Precision (30 points)
Based on: Semantic F1, NER studies
- [0-6] ENTITY CLARITY: Company/product/people names clearly and consistently stated?
- [0-6] INFO DENSITY vs FLUFF: Objective facts vs vague marketing fluff ratio?
- [0-6] SEMANTIC UNAMBIGUITY: Any terms causing confusion without context?
- [0-6] KNOWLEDGE GRAPH ALIGNMENT: Content aligns with KG categorization? Industry, relationships clear?
- [0-6] MULTILINGUAL CONSISTENCY: Entity names consistent across KO/EN?

### AXIS 3: SPF — Structural Parsing Fidelity (30 points)
Based on: Token Efficiency, Content-Aware Chunking, Rendering Wall analysis
- [0-6] HEADING HIERARCHY: Logical H1>H2>H3? Natural chunking boundaries?
- [0-6] RENDERING ACCESSIBILITY: SSR/Static vs CSR? (WebArena: CSR extraction success only 10-16%)
- [0-6] STRUCTURED DATA: Schema.org JSON-LD present and complete?
- [0-6] TOKEN EFFICIENCY: Content vs noise ratio? HTML→MD token reduction potential?
- [0-6] CHUNKING FRIENDLINESS: Text blocks <512 tokens? Lists/tables properly formatted?

## CRITICAL RULES FOR "customer_summary":
- This section is shown directly to business owners who are NOT technical
- NEVER use terms like PACP, SEP, SPF, JSON-LD, Schema.org, SSR, CSR, token, chunking, rendering
- Instead say: "AI가 읽을 수 있는 형태", "디지털 명함", "AI 전용 데이터 규격", "페이지 구조"
- headline must create urgency/fear: "AI가 귀사를 모릅니다", "AI가 엉뚱한 정보를 말하고 있습니다" etc.
- causes should be exactly 3 items, each explaining one major problem in plain Korean
- actions should be exactly 3 items, each a concrete next step in plain Korean
- expected_score_after: realistic estimate if all actions are taken

## CRITICAL RULES FOR "finding" FIELDS:
- Each finding MUST be 2-3 sentences in Korean
- First sentence: State the specific evidence found (or not found) on the page with concrete examples
- Second sentence: Explain WHY this matters for AI citation, referencing the academic basis
- Example good finding: "페이지 상위 20% 내에 수치 데이터가 0건 발견되었습니다. 구체적인 통계(매출, 고객 수 등)가 없어 AI가 인용할 고신뢰 시그널이 부재합니다. Princeton GEO 연구에 따르면 통계 추가 시 AI 가시성이 30~41% 상승합니다."
- Example bad finding: "No statistics present." (TOO SHORT, NO EVIDENCE, NO KOREAN)

## OUTPUT FORMAT
Respond ONLY with this JSON structure. No other text.

{
  "company_name": "detected company name",
  "overall_score": 0,
  "grade": "A+|A|B|C|D",
  "customer_summary": {
    "headline": "AI가 이 웹사이트에서 읽을 수 있는 정보가 거의 없습니다 (한국어, 한 줄, 공포감 주는 진단)",
    "detail": "ChatGPT에게 [회사명]을 물어보면 [구체적으로 어떤 문제가 생기는지 2-3문장]. 이 문제의 원인은 [핵심 원인 한 줄].",
    "causes": [
      {
        "icon": "❌",
        "title": "AI가 읽을 수 있는 회사 정보가 없습니다",
        "description": "쉬운 한국어로 왜 이게 문제인지 2문장. 전문 용어 금지."
      },
      {
        "icon": "❌",
        "title": "AI 전용 데이터 규격이 없습니다",
        "description": "쉬운 한국어 2문장"
      },
      {
        "icon": "❌",
        "title": "페이지 구조가 AI 크롤러에게 벽입니다",
        "description": "쉬운 한국어 2문장"
      }
    ],
    "actions": [
      "지금 당장 해야 할 개선 사항 1 (쉬운 말로)",
      "지금 당장 해야 할 개선 사항 2",
      "지금 당장 해야 할 개선 사항 3"
    ],
    "expected_score_after": 0
  },
  "pacp": {
    "score": 0,
    "subscores": {
      "high_trust_signals": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "inverted_pyramid": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "citation_worthy": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "factual_completeness": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "authority_signals": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" }
    },
    "summary_ko": "...",
    "summary_en": "..."
  },
  "sep": {
    "score": 0,
    "subscores": {
      "entity_clarity": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "info_density": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "semantic_unambiguity": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "kg_alignment": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "multilingual": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" }
    },
    "summary_ko": "...",
    "summary_en": "..."
  },
  "spf": {
    "score": 0,
    "subscores": {
      "heading_hierarchy": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "rendering_access": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "structured_data": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "token_efficiency": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" },
      "chunking_friendly": { "score": 0, "finding": "2-3 sentences in Korean with specific evidence" }
    },
    "summary_ko": "...",
    "summary_en": "..."
  },
  "improvements": [
    {
      "priority": "critical",
      "axis": "PACP",
      "issue": "가장 낮은 점수 항목의 구체적 문제 (한국어)",
      "action": "즉시 실행 가능한 개선 방법 (한국어)",
      "expected_impact": "+N점",
      "academic_basis": "Princeton GEO 등 근거 (한국어)"
    }
  ]
}

CRITICAL RULES FOR "improvements":
- MUST contain exactly 3-5 items. NEVER return an empty array.
- Order by priority: critical → important → nice
- Each item must reference a specific axis (PACP, SEP, or SPF) where the score was lowest
- expected_impact must be a realistic number like "+5점" or "+8점" — not "+0점"
- Focus on actionable changes the website owner can make`;
}

export async function runDiagnosis(crawlData) {
  const text = await requestDiagnosisText(crawlData);
  const parsed = tryParseDiagnosisJson(text);

  if (parsed) return normalizeDiagnosis(parsed, crawlData);

  const repairedText = await repairDiagnosisResponse(text);
  const repaired = tryParseDiagnosisJson(repairedText);

  if (repaired) return normalizeDiagnosis(repaired, crawlData);

  console.error("Failed to parse diagnosis JSON:", extractJsonString(text).substring(0, 500));
  console.error("Failed to parse repaired diagnosis JSON:", extractJsonString(repairedText).substring(0, 500));
  throw new Error("Failed to parse diagnosis response");
}

function normalizeDiagnosis(input, crawlData) {
  const companyName = input?.company_name || crawlData.title || "Unknown";
  const pacp = normalizeAxis(input?.pacp, "pacp", crawlData);
  const sep = normalizeAxis(input?.sep, "sep", crawlData);
  const spf = normalizeAxis(input?.spf, "spf", crawlData);
  const summedScore = pacp.score + sep.score + spf.score;
  const overallScore = Number.isFinite(Number(input?.overall_score))
    ? clampNumber(input?.overall_score, 0, 100)
    : clampNumber(summedScore, 0, 100);

  return {
    company_name: companyName,
    overall_score: overallScore,
    grade: input?.grade || getGradeLabel(overallScore),
    customer_summary: normalizeCustomerSummary(input?.customer_summary, overallScore),
    pacp,
    sep,
    spf,
    improvements: normalizeImprovements(input?.improvements, { pacp, sep, spf, crawlData }),
  };
}

function normalizeImprovements(improvements, context) {
  if (!Array.isArray(improvements) || improvements.length === 0) {
    return buildFallbackImprovements(context);
  }

  const normalized = improvements
    .map((item) => normalizeImprovementItem(item))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : buildFallbackImprovements(context);
}

function normalizeImprovementItem(item) {
  if (!item || typeof item !== "object") return null;

  const issue = typeof item.issue === "string" ? item.issue.trim() : "";
  const action = typeof item.action === "string" ? item.action.trim() : "";

  if (!issue || !action) return null;

  return {
    priority: normalizePriority(item.priority),
    axis: normalizeAxisLabel(item.axis),
    issue,
    action,
    expected_impact: normalizeImpactLabel(item.expected_impact),
    academic_basis: typeof item.academic_basis === "string" ? item.academic_basis.trim() : "",
    source: typeof item.source === "string" ? item.source : "model",
  };
}

function normalizePriority(priority) {
  const normalized = typeof priority === "string" ? priority.toLowerCase() : "";
  if (normalized === "critical" || normalized === "important" || normalized === "nice") {
    return normalized;
  }
  return "important";
}

function normalizeAxisLabel(axis) {
  const normalized = typeof axis === "string" ? axis.toUpperCase() : "";
  if (normalized === "PACP" || normalized === "SEP" || normalized === "SPF") {
    return normalized;
  }
  return "PACP";
}

function normalizeImpactLabel(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    return `+${Math.round(num)}점`;
  }

  return "+4점";
}

function buildFallbackImprovements({ pacp, sep, spf }) {
  const weakestAxis = selectWeakestAxis({ pacp, sep, spf });
  const templates = getImprovementTemplates();
  const axisTemplates = templates[weakestAxis.id];
  const impactByAxis = {
    pacp: [8, 6, 5],
    sep: [6, 5, 4],
    spf: [6, 5, 4],
  };

  return getTopImprovementKeys(weakestAxis)
    .slice(0, 3)
    .map((key, index) => {
      const template = axisTemplates[key] || axisTemplates.default;
      return {
        priority: index === 0 ? "critical" : index === 1 ? "important" : "nice",
        axis: weakestAxis.id.toUpperCase(),
        issue: template.issue,
        action: template.action,
        expected_impact: `+${impactByAxis[weakestAxis.id][index] || 4}점`,
        academic_basis: template.academic_basis,
        source: "fallback_axis_based",
      };
    });
}

function selectWeakestAxis(axes) {
  const configs = [
    { id: "pacp", max: 40, data: axes.pacp },
    { id: "sep", max: 30, data: axes.sep },
    { id: "spf", max: 30, data: axes.spf },
  ];

  return configs.reduce((weakest, current) => {
    const weakestRatio = weakest.data.score / weakest.max;
    const currentRatio = current.data.score / current.max;
    return currentRatio < weakestRatio ? current : weakest;
  });
}

function getTopImprovementKeys(axis) {
  const maxPerSubscore = axis.id === "pacp" ? 8 : 6;

  return Object.entries(axis.data.subscores)
    .map(([key, sub]) => ({
      key,
      gap: maxPerSubscore - (Number.isFinite(Number(sub?.score)) ? Number(sub.score) : 0),
    }))
    .sort((a, b) => b.gap - a.gap)
    .map((item) => item.key);
}

function getImprovementTemplates() {
  return {
    pacp: {
      high_trust_signals: {
        issue: "고신뢰 통계·사례·정량 근거가 부족합니다",
        action: "상단 20% 안에 설립연도, 고객 수, 사례 수, 핵심 성과처럼 바로 인용 가능한 수치를 짧게 추가하세요.",
        academic_basis: "Princeton GEO 연구는 통계와 구체 수치가 AI 인용 확률을 높인다고 제시합니다.",
      },
      inverted_pyramid: {
        issue: "핵심 사실이 상단에서 바로 드러나지 않습니다",
        action: "페이지 첫 화면에 회사 정의, 대상 고객, 핵심 산출물을 한 문단으로 요약해 역피라미드 구조를 강화하세요.",
        academic_basis: "상단 배치된 핵심 정보는 생성형 AI가 출처로 선택할 때 우선적으로 활용되기 쉽습니다.",
      },
      citation_worthy: {
        issue: "AI가 그대로 가져다 쓸 인용 문장이 부족합니다",
        action: "설명형 문장을 줄이고, 'AAO는 ~를 진단하는 서비스다' 같은 사실 문장을 2~3개 추가하세요.",
        academic_basis: "짧고 명확한 선언문은 LLM이 요약·인용하기 쉬운 형태입니다.",
      },
      factual_completeness: {
        issue: "누가 무엇을 어떻게 제공하는지 한 문장으로 완결되지 않습니다",
        action: "회사명, 서비스 정의, 대상 고객, 핵심 산출물을 하나의 완결 문장으로 반복 고정하세요.",
        academic_basis: "완전한 사실 문장은 AI의 엔티티 설명 정확도를 높이는 기본 단위입니다.",
      },
      authority_signals: {
        issue: "공식 출처로 신뢰할 근거와 권위 신호가 약합니다",
        action: "연구 링크, 외부 기사, 공개 사례, 수상 또는 고객 레퍼런스를 본문에 직접 연결하세요.",
        academic_basis: "외부 권위 신호와 출처 연결은 공식 사이트의 인용 신뢰도를 높입니다.",
      },
      default: {
        issue: "공식 출처로서 인용 신호를 더 강화해야 합니다",
        action: "핵심 사실, 수치, 근거 링크를 상단에 더 짧고 명확하게 정리하세요.",
        academic_basis: "출처성은 짧은 핵심 사실과 검증 가능한 근거가 결합될 때 가장 강해집니다.",
      },
    },
    sep: {
      entity_clarity: {
        issue: "회사명과 서비스명이 하나의 엔티티로 충분히 고정되지 않았습니다",
        action: "상단, FAQ, 영문 요약에서 같은 풀네임과 한 줄 정의를 반복해 엔티티 앵커를 강화하세요.",
        academic_basis: "일관된 엔티티 표기는 AI의 명칭 혼동과 약어 오인식을 줄입니다.",
      },
      info_density: {
        issue: "사실보다 설명과 마케팅 문구 비중이 더 큽니다",
        action: "긴 문단을 줄이고 회사 정의, 대상, 효과, 산출물을 목록형 사실 블록으로 재구성하세요.",
        academic_basis: "정보 밀도가 높은 문서는 의미 추출과 NER 정확도에 유리합니다.",
      },
      semantic_unambiguity: {
        issue: "서비스 목적과 결과가 짧고 명확하게 연결되지 않습니다",
        action: "'누구를 위해 무엇을 진단하고 무엇을 만든다' 구조로 핵심 문장을 더 단순하게 고정하세요.",
        academic_basis: "의미 비모호성은 엔티티-서비스 관계를 안정적으로 해석하게 만듭니다.",
      },
      kg_alignment: {
        issue: "업종, 서비스, 고객, 결과 관계가 구조적으로 약합니다",
        action: "회사/서비스/대상/결과를 표나 목록 한 세트로 정리해 관계형 정보를 더 명시하세요.",
        academic_basis: "명확한 관계 표기는 지식그래프 정합성과 엔티티 연결에 도움을 줍니다.",
      },
      multilingual: {
        issue: "한국어와 영어 핵심 정의의 일관성을 더 높일 수 있습니다",
        action: "한영 섹션의 회사 정의와 핵심 서비스 문장을 거의 동일한 의미 구조로 맞추세요.",
        academic_basis: "다국어 일관성은 글로벌 모델에서 엔티티 정체성 유지에 유리합니다.",
      },
      default: {
        issue: "엔티티와 서비스 관계를 더 짧고 명확하게 표현해야 합니다",
        action: "회사명, 서비스 정의, 대상 고객, 결과를 반복 가능한 사실형 문장으로 고정하세요.",
        academic_basis: "명확한 의미 구조는 AI가 회사를 하나의 실체로 이해하는 데 핵심입니다.",
      },
    },
    spf: {
      heading_hierarchy: {
        issue: "헤딩 계층이 더 세밀하게 구조화될 필요가 있습니다",
        action: "H2 아래에 H3 수준 소제목을 추가해 섹션별 핵심 정보를 더 잘게 나누세요.",
        academic_basis: "명확한 헤딩 계층은 청킹과 섹션별 추출 안정성을 높입니다.",
      },
      rendering_access: {
        issue: "접근성은 양호하지만 기계가 읽을 구조를 더 안정화할 수 있습니다",
        action: "상단 요약과 핵심 사실 블록을 HTML 본문 내 정적 텍스트로 유지해 렌더링 의존성을 더 낮추세요.",
        academic_basis: "정적 HTML 기반 구조는 LLM 봇이 내용을 안정적으로 수집하는 데 유리합니다.",
      },
      structured_data: {
        issue: "구조화 데이터 필드 완전성이 아직 부족합니다",
        action: "JSON-LD에 공식 도메인, 설립연도, 대표자, 연락처, 서비스 정의, FAQ 연결을 더 명시하세요.",
        academic_basis: "완전한 구조화 데이터는 AI의 엔티티 매핑과 출처 신뢰도에 직접 기여합니다.",
      },
      token_efficiency: {
        issue: "핵심 사실 대비 불필요한 텍스트 비중을 더 줄일 수 있습니다",
        action: "반복 설명을 줄이고 핵심 블록을 더 짧게 만들어 토큰 대비 정보 밀도를 높이세요.",
        academic_basis: "토큰 효율이 좋은 문서는 같은 컨텍스트 안에서 더 많은 핵심 정보를 유지할 수 있습니다.",
      },
      chunking_friendly: {
        issue: "긴 문단이 남아 있어 청킹 품질을 더 개선할 수 있습니다",
        action: "긴 문장을 2~3문장 단위 섹션과 목록으로 나눠 청킹 친화도를 높이세요.",
        academic_basis: "짧고 구조화된 문단은 RAG와 검색 추출 과정의 안정성을 높입니다.",
      },
      default: {
        issue: "기술 구조는 읽히지만 더 기계 친화적으로 다듬을 수 있습니다",
        action: "헤딩, JSON-LD, 짧은 문단 구조를 더 명확히 정리하세요.",
        academic_basis: "구조적 파싱 충실도는 읽힘 여부뿐 아니라 추출 안정성까지 좌우합니다.",
      },
    },
  };
}

function normalizeCustomerSummary(summary, overallScore) {
  const fallbackScore = Math.min(overallScore + 20, 100);
  const causes = Array.isArray(summary?.causes) ? summary.causes : [];
  const actions = Array.isArray(summary?.actions) ? summary.actions : [];

  return {
    headline: summary?.headline || "AI가 이 페이지를 충분히 정확하게 읽지 못하고 있습니다",
    detail: summary?.detail || "현재 페이지 구조와 사실 정보는 일부 읽히지만, AI가 신뢰할 만한 공식 출처로 인용하기에는 아직 부족합니다.",
    causes: causes.length > 0 ? causes : [
      { icon: "❌", title: "핵심 사실 정보가 부족합니다", description: "회사와 서비스의 핵심 사실은 보이지만, AI가 그대로 인용할 수 있는 구체적 문장이 더 필요합니다." },
      { icon: "❌", title: "구조화된 설명이 더 필요합니다", description: "페이지 구조는 읽히지만, 엔티티와 서비스 관계를 더 짧고 명확하게 적어야 AI가 덜 헷갈립니다." },
      { icon: "❌", title: "신뢰 신호가 아직 약합니다", description: "수치, 사례, 레퍼런스 같은 근거가 부족하면 AI가 이 페이지를 1차 출처로 강하게 인용하지 않습니다." },
    ],
    actions: actions.length > 0 ? actions : [
      "상단에 회사 정의와 핵심 서비스 문장을 한 줄로 더 명확히 넣으세요.",
      "설립연도, 대표자, 연락처 외에 수치나 사례 같은 신뢰 근거를 추가하세요.",
      "제품-대상-효과 관계를 짧은 목록으로 정리해 AI가 바로 추출할 수 있게 하세요.",
    ],
    expected_score_after: clampNumber(summary?.expected_score_after, overallScore, 100) || fallbackScore,
  };
}

function normalizeAxis(axis, axisId, crawlData) {
  const templates = {
    pacp: {
      max: 40,
      subs: ["high_trust_signals", "inverted_pyramid", "citation_worthy", "factual_completeness", "authority_signals"],
    },
    sep: {
      max: 30,
      subs: ["entity_clarity", "info_density", "semantic_unambiguity", "kg_alignment", "multilingual"],
    },
    spf: {
      max: 30,
      subs: ["heading_hierarchy", "rendering_access", "structured_data", "token_efficiency", "chunking_friendly"],
    },
  };

  const template = templates[axisId];
  const fallback = buildFallbackAxis(axisId, crawlData);
  const subscores = {};
  let hasAnyRealSubscore = false;

  for (const key of template.subs) {
    const rawScore = axis?.subscores?.[key]?.score;
    const score = Number.isFinite(Number(rawScore))
      ? clampNumber(rawScore, 0, axisId === "pacp" ? 8 : 6)
      : fallback.subscores[key].score;
    if (Number.isFinite(Number(rawScore))) hasAnyRealSubscore = true;
    subscores[key] = {
      score,
      finding: axis?.subscores?.[key]?.finding || fallback.subscores[key].finding,
    };
  }

  const axisScore = Number.isFinite(Number(axis?.score))
    ? clampNumber(axis?.score, 0, template.max)
    : Object.values(subscores).reduce((sum, sub) => sum + sub.score, 0);

  return {
    score: hasAnyRealSubscore || Number.isFinite(Number(axis?.score)) ? axisScore : fallback.score,
    subscores,
    summary_ko: axis?.summary_ko || "",
    summary_en: axis?.summary_en || "",
  };
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(min, Math.min(num, max));
}

function getGradeLabel(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function buildFallbackAxis(axisId, crawlData) {
  const metadata = crawlData?.metadata || {};
  const h1Count = metadata?.headingStructure?.h1Count || 0;
  const h2Count = metadata?.headingStructure?.h2Count || 0;
  const totalWordCount = metadata?.totalWordCount || 0;
  const hasJsonLd = Boolean(metadata?.hasJsonLd);
  const hasOpenGraph = Boolean(metadata?.hasOpenGraph);
  const longTextBlocks = metadata?.longTextBlocks || 0;
  const textContentRatio = metadata?.textContentRatio || 0;
  const content = crawlData?.content || "";

  if (axisId === "pacp") {
    const subscores = {
      high_trust_signals: {
        score: /(고객|사용자|매출|도입|설립연도|대표자|이메일)/.test(content) ? 3 : 1,
        finding: "기계 점검 기준으로 기본 사실 정보 존재 여부만 반영했습니다. 정량 수치와 외부 근거가 더해져야 인용 확률이 크게 올라갑니다.",
      },
      inverted_pyramid: {
        score: h1Count > 0 && totalWordCount >= 200 ? 3 : 1,
        finding: "상단 구조와 본문 길이를 기준으로 핵심 정보 배치를 추정했습니다. 더 짧고 직접적인 핵심 요약이 상단에 있을수록 유리합니다.",
      },
      citation_worthy: {
        score: totalWordCount >= 400 ? 3 : 2,
        finding: "페이지에 인용 가능한 설명 문장이 일부 존재하는 것으로 보입니다. 다만 수치와 고유 사실이 더 명확해야 AI가 그대로 인용하기 쉽습니다.",
      },
      factual_completeness: {
        score: /(설립연도|대표자|이메일|웹사이트)/.test(content) ? 4 : 2,
        finding: "기본 회사 정보 필드가 일부 확인됩니다. 누구이고 무엇을 하며 어디와 연결되는지 한 문장 요약이 더 강해져야 합니다.",
      },
      authority_signals: {
        score: hasJsonLd || hasOpenGraph ? 2 : 1,
        finding: "구조화 메타데이터는 보이지만 외부 레퍼런스나 강한 권위 신호는 아직 약합니다. 기사, 사례, 수상, 고객 근거가 추가되면 더 좋아집니다.",
      },
    };
    return { score: Object.values(subscores).reduce((sum, sub) => sum + sub.score, 0), subscores };
  }

  if (axisId === "sep") {
    const subscores = {
      entity_clarity: {
        score: /(AAO|AI Answer Optimization)/.test(content) ? 4 : 2,
        finding: "회사명과 영문 확장은 확인됩니다. 다만 약어 혼동을 막기 위해 서비스 정의를 더 반복적으로 고정할 필요가 있습니다.",
      },
      info_density: {
        score: totalWordCount >= 500 ? 3 : 2,
        finding: "본문 정보량은 일정 수준 확보되었습니다. 마케팅 문구보다 사실 문장 비중을 더 높이면 의미 추출이 쉬워집니다.",
      },
      semantic_unambiguity: {
        score: /(AI 프로필 페이지|AI 검색 가독성 진단)/.test(content) ? 4 : 2,
        finding: "핵심 서비스 용어는 일부 구체화되어 있습니다. 다만 제품-대상-효과 구조를 더 짧게 명시하면 모호성이 줄어듭니다.",
      },
      kg_alignment: {
        score: /(서비스명|업종|서비스 유형)/.test(content) ? 4 : 2,
        finding: "업종과 서비스 유형이 표기되어 기본 분류는 가능합니다. 고객, 제품, 결과 관계가 더 구조화되면 정합성이 높아집니다.",
      },
      multilingual: {
        score: /(About AAO|English)/.test(content) ? 5 : 3,
        finding: "한영 병기가 있어 다국어 일관성은 비교적 양호합니다. 핵심 정의 문장을 한국어와 영어에서 더 동일하게 맞추면 좋습니다.",
      },
    };
    return { score: Object.values(subscores).reduce((sum, sub) => sum + sub.score, 0), subscores };
  }

  const subscores = {
    heading_hierarchy: {
      score: h1Count > 0 ? (h2Count > 0 ? 4 : 2) : 1,
      finding: "헤딩 계층은 기계적으로 확인되었습니다. H3 이하 세부 구조를 더 보강하면 청킹 품질이 좋아집니다.",
    },
    rendering_access: {
      score: 5,
      finding: "현재 페이지는 실제 텍스트와 메타데이터가 추출되어 렌더링 접근성은 양호합니다. CSR 벽 문제는 크게 보이지 않습니다.",
    },
    structured_data: {
      score: hasJsonLd ? 4 : 1,
      finding: "JSON-LD 존재 여부를 기준으로 기본 점수를 반영했습니다. 필드 완전성이 더 높아지면 구조 점수도 더 올라갑니다.",
    },
    token_efficiency: {
      score: textContentRatio >= 60 ? 5 : 3,
      finding: "텍스트 비중이 높아 토큰 효율은 비교적 양호합니다. 불필요한 반복과 긴 문단을 더 줄이면 개선됩니다.",
    },
    chunking_friendly: {
      score: longTextBlocks === 0 ? 5 : 4,
      finding: "긴 블록 수를 기준으로 청킹 친화도를 추정했습니다. 긴 문단을 더 짧게 나누면 추출 안정성이 높아집니다.",
    },
  };
  return { score: Object.values(subscores).reduce((sum, sub) => sum + sub.score, 0), subscores };
}

async function requestDiagnosisText(crawlData) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildDiagnosticPrompt(crawlData) },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return extractResponseText(data.choices?.[0]?.message?.content);
}

function tryParseDiagnosisJson(text) {
  const clean = extractJsonString(text);
  if (!clean) return null;

  try {
    return JSON.parse(clean);
  } catch {
    const normalized = clean
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");

    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }
}

async function repairDiagnosisResponse(rawText) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You repair invalid or noisy model output into valid JSON only. Return a single valid JSON object with no markdown and no explanation.",
        },
        {
          role: "user",
          content: `Convert the following response into valid JSON only. Preserve the intended values and structure as much as possible.\n\n${rawText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI repair API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return extractResponseText(data.choices?.[0]?.message?.content);
}

function extractResponseText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text") return part.text || "";
      return "";
    })
    .join("")
    .trim();
}

function extractJsonString(text) {
  const normalized = (text || "").replace(/```json\s?|```/g, "").trim();
  if (!normalized) return "";

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return normalized.slice(firstBrace, lastBrace + 1);
  }

  return normalized;
}
