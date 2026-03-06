// lib/ai-check.js — Query 3 AI engines: "Do you know [company]?"
// MVP: ChatGPT + Perplexity + Gemini

function buildCompanyPrompt(companyName) {
  return [
    `${companyName}에 대해 알려줘.`,
    `약어나 동명이인이 아니라 "${companyName}"라는 정확한 엔티티만 기준으로 답해줘.`,
    "이 회사가 무엇을 하는 곳인지, 주요 서비스나 제품은 무엇인지 설명해줘.",
    "정확한 회사를 특정하기 어렵다면 추측하지 말고 모른다고 말해줘.",
  ].join(" ");
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

function extractStrongEntityHints(companyName) {
  return Array.from(
    new Set(
      String(companyName || "")
        .toLowerCase()
        .split(/[|()\-—,:/]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 6)
    )
  );
}

async function askChatGPT(companyName) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: buildCompanyPrompt(companyName),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AAO] ChatGPT API error: ${res.status}`, errBody.substring(0, 200));
      return { engine: "chatgpt", response: `API 오류 (${res.status})`, status: "error", error: errBody };
    }

    const data = await res.json();
    console.log("[AAO] ChatGPT finish_reason:", data.choices?.[0]?.finish_reason);
    const text = extractResponseText(data.choices?.[0]?.message?.content);

    if (!text) {
      // content가 null인 경우 (refusal 등) → 미인식으로 처리
      const refusal = data.choices?.[0]?.message?.refusal;
      if (refusal) console.error("[AAO] ChatGPT refusal:", refusal);
      return { engine: "chatgpt", response: `${companyName}에 대한 정보를 갖고 있지 않습니다.`, status: "success" };
    }

    return { engine: "chatgpt", response: text, status: "success" };
  } catch (e) {
    return { engine: "chatgpt", response: "", status: "error", error: e.message };
  }
}

async function askGemini(companyName) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildCompanyPrompt(companyName),
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AAO] Gemini API error: ${res.status}`, errBody.substring(0, 200));
      return { engine: "gemini", response: `API 오류 (${res.status})`, status: "error", error: errBody };
    }

    const data = await res.json();
    // parts가 배열일 수 있으므로 전체 합산
    const parts = data.candidates?.[0]?.content?.parts;
    const text = (Array.isArray(parts) ? parts.map(p => p.text || "").join("") : "")
      || data.candidates?.[0]?.output
      || data.text
      || data.error?.message
      || "";

    if (!text && data.error) {
      console.error("[AAO] Gemini API error:", data.error);
      return { engine: "gemini", response: `API 오류: ${data.error.message || "알 수 없는 오류"}`, status: "error" };
    }

    return { engine: "gemini", response: text, status: text ? "success" : "error" };
  } catch (e) {
    return { engine: "gemini", response: "", status: "error", error: e.message };
  }
}

async function askPerplexity(companyName) {
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: buildCompanyPrompt(companyName),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AAO] Perplexity API error: ${res.status}`, errBody.substring(0, 200));
      return { engine: "perplexity", response: `API 오류 (${res.status})`, status: "error", error: errBody };
    }

    const data = await res.json();
    const text = extractResponseText(data.choices?.[0]?.message?.content);

    if (!text) {
      return { engine: "perplexity", response: "응답이 비어있습니다", status: "error" };
    }

    return { engine: "perplexity", response: text, status: "success" };
  } catch (e) {
    return { engine: "perplexity", response: "", status: "error", error: e.message };
  }
}

function analyzeResponse(response, companyName) {
  if (response.status === "error" || !response.response) {
    return {
      engineId: response.engine,
      knows: false,
      response: response.response || "(응답 없음)",
      accuracy: 0,
      status: response.status,
    };
  }

  const text = response.response.toLowerCase();
  const strongEntityHints = extractStrongEntityHints(companyName);

  const unknownSignals = [
    "정보를 찾기 어렵", "알려진 정보가 없", "확인할 수 없", "잘 모르겠",
    "구체적인 정보", "정보가 부족", "찾을 수 없", "i don't have",
    "i'm not sure", "not familiar", "no information", "couldn't find",
    "unable to find", "i don't have specific", "알 수 없", "파악되지",
    "cannot find information", "i cannot find", "can't find information",
    "cannot identify", "could not identify", "not enough information",
    "does not appear to refer to", "not clearly refer to",
    "specific company cannot be identified", "정확한 엔티티", "특정하기 어렵",
    "특정할 수 있는 회사를 찾", "직접 내용을 불러오지 못", "확실하게 말할 수 있는 것은",
  ];

  const hasStrongEntityMatch =
    strongEntityHints.length === 0 ||
    strongEntityHints.some((hint) => text.includes(hint));

  const looksUncertain = unknownSignals.some((signal) => text.includes(signal));

  const knows = hasStrongEntityMatch && !looksUncertain;

  let accuracy = 0;

  if (!knows) {
    accuracy = 5;
  } else {
    if (text.length > 100) accuracy += 10;
    if (text.length > 300) accuracy += 10;
    if (text.length > 600) accuracy += 10;
    if (text.length > 1000) accuracy += 5;

    if (text.includes("설립") || text.includes("founded") || text.includes("창립")) accuracy += 10;
    if (text.includes("서비스") || text.includes("service") || text.includes("솔루션")) accuracy += 8;
    if (text.includes("제품") || text.includes("product")) accuracy += 8;
    if (text.includes("위치") || text.includes("서울") || text.includes("korea") || text.includes("주소")) accuracy += 7;
    if (text.includes("대표") || text.includes("ceo") || text.includes("창업")) accuracy += 7;
    if (text.includes("매출") || text.includes("투자") || text.includes("고객")) accuracy += 5;
    if (text.includes("직원") || text.includes("팀") || text.includes("규모")) accuracy += 5;

    accuracy = Math.max(30, Math.min(accuracy, 95));
  }

  return {
    engineId: response.engine,
    knows,
    response: response.response,
    accuracy,
    status: "success",
  };
}

export async function checkAllEngines(companyName) {
  const results = await Promise.allSettled([
    askChatGPT(companyName),
    askPerplexity(companyName),
    askGemini(companyName),
  ]);

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return analyzeResponse(result.value, companyName);
    }
    return {
      engineId: "unknown",
      knows: false,
      response: "API 호출 실패",
      accuracy: 0,
      status: "error",
    };
  });
}
