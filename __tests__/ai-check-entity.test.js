const {
  parseString,
  parseBoolean,
  parsePositiveInt,
  uniqueStrings,
  sanitizePromptInput,
  normalizeEntityInput,
  resolveFactField,
  normalizeFactValue,
  evaluateFieldDelivery,
  overlapRatio,
  normalizeComparableText,
  getHostname,
  extractHostnameCandidate,
  hostMatchesOfficialDomain,
} = require("../lib/ai-check-entity");

// --- parseString ---
describe("parseString", () => {
  test("returns trimmed string", () => {
    expect(parseString("  hello  ")).toBe("hello");
  });
  test("returns fallback for non-string", () => {
    expect(parseString(null, "fb")).toBe("fb");
    expect(parseString(undefined)).toBe("");
  });
  test("returns fallback for whitespace-only", () => {
    expect(parseString("   ", "fb")).toBe("fb");
  });
});

// --- parseBoolean ---
describe("parseBoolean", () => {
  test("parses truthy strings", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("on")).toBe(true);
  });
  test("parses falsy strings", () => {
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
  });
  test("returns fallback for unknown", () => {
    expect(parseBoolean("maybe", "default")).toBe("default");
    expect(parseBoolean(42, "default")).toBe("default");
  });
});

// --- sanitizePromptInput ---
describe("sanitizePromptInput", () => {
  test("strips control chars and truncates", () => {
    expect(sanitizePromptInput("hello\x00world", 8)).toBe("hello wo");
  });
  test("returns empty for non-string", () => {
    expect(sanitizePromptInput(123, 10)).toBe("");
  });
});

// --- resolveFactField ---
describe("resolveFactField", () => {
  test("resolves Korean aliases", () => {
    expect(resolveFactField("회사명")).toBe("entity_name");
    expect(resolveFactField("설립")).toBe("founded");
    expect(resolveFactField("본사")).toBe("headquarters");
  });
  test("resolves English aliases", () => {
    expect(resolveFactField("ceo")).toBe("ceo_or_leader");
    expect(resolveFactField("founded")).toBe("founded");
  });
  test("returns null for unknown", () => {
    expect(resolveFactField("unknown_field")).toBeNull();
    expect(resolveFactField("")).toBeNull();
  });
});

// --- normalizeFactValue ---
describe("normalizeFactValue", () => {
  test("trims and cleans scalar value", () => {
    expect(normalizeFactValue("entity_name", "  TestCo  ")).toBe("TestCo");
  });
  test("splits array fields", () => {
    const result = normalizeFactValue("key_products", "A, B, C");
    expect(result).toEqual(["A", "B", "C"]);
  });
  test("returns null for empty", () => {
    expect(normalizeFactValue("entity_name", "")).toBeNull();
  });
  test("rejects overly long scalar", () => {
    expect(normalizeFactValue("entity_name", "x".repeat(200))).toBeNull();
  });
});

// --- getHostname ---
describe("getHostname", () => {
  test("extracts hostname without www", () => {
    expect(getHostname("https://www.example.com/path")).toBe("example.com");
  });
  test("returns empty for invalid url", () => {
    expect(getHostname("not-a-url")).toBe("");
  });
});

// --- evaluateFieldDelivery ---
describe("evaluateFieldDelivery", () => {
  const groundTruth = {
    fieldMap: {
      entity_name: { value: "TestCo", source: "jsonld" },
      founded: { value: "2020", source: "official_facts_block" },
    },
    alternateNames: [],
    faqPairs: [],
  };

  test("detects delivered fields", () => {
    const result = evaluateFieldDelivery("TestCo was founded in 2020.", groundTruth);
    expect(result.deliveredFields).toHaveLength(2);
    expect(result.missedFields).toHaveLength(0);
    expect(result.deliveryRate).toBe(1);
  });

  test("detects missed fields", () => {
    const result = evaluateFieldDelivery("Some unrelated text about nothing.", groundTruth);
    expect(result.missedFields).toHaveLength(2);
    expect(result.deliveryRate).toBe(0);
  });

  test("partial delivery", () => {
    const result = evaluateFieldDelivery("TestCo is great.", groundTruth);
    expect(result.deliveredFields).toHaveLength(1);
    expect(result.missedFields).toHaveLength(1);
    expect(result.deliveryRate).toBe(0.5);
  });
});
