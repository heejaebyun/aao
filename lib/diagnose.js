// lib/diagnose.js — AAO Diagnostic Engine via Claude API
// Based on Princeton GEO Research (KDD 2024)

const SYSTEM_PROMPT = `You are an AI Readability Diagnostic Engine for the AAO (AI Answer Optimization) service.

Your mission: Analyze a webpage's content and evaluate how well AI search engines (ChatGPT, Gemini, Perplexity, Claude, Naver Cue) can understand, extract, and cite information from this page.

Your evaluation is based on the Princeton University GEO (Generative Engine Optimization) research framework (KDD 2024) and RAG system performance studies.

You score pages on 3 axes, totaling 100 points:
- PACP (Position-Adjusted Citation Probability): 40 points
- SEP (Semantic Entity Precision): 30 points
- SPF (Structural Parsing Fidelity): 30 points

You must be brutally honest. Most websites score between 20-50 points.
A score above 80 is exceptional and rare.
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
      "priority": "critical|important|nice",
      "axis": "PACP|SEP|SPF",
      "issue": "문제점",
      "action": "개선 방법",
      "expected_impact": "+N점",
      "academic_basis": "근거"
    }
  ]
}`;
}

export async function runDiagnosis(crawlData) {
  const text = await requestDiagnosisText(crawlData);
  const parsed = tryParseDiagnosisJson(text);

  if (parsed) return parsed;

  const repairedText = await repairDiagnosisResponse(text);
  const repaired = tryParseDiagnosisJson(repairedText);

  if (repaired) return repaired;

  console.error("Failed to parse diagnosis JSON:", extractJsonString(text).substring(0, 500));
  console.error("Failed to parse repaired diagnosis JSON:", extractJsonString(repairedText).substring(0, 500));
  throw new Error("Failed to parse diagnosis response");
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
