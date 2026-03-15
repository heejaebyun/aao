// lib/log-utils.js — Structured logging utilities with sensitive data redaction

const SENSITIVE_KEYS = new Set([
  "apikey", "api_key", "token", "authorization", "secret",
  "password", "credential", "cookie", "session",
]);

/**
 * Redact a URL to host + truncated path only.
 * Removes query strings and fragments entirely.
 */
export function redactUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 60
      ? parsed.pathname.slice(0, 60) + "..."
      : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return String(url || "").slice(0, 80);
  }
}

/**
 * Truncate text to a safe preview length.
 */
export function redactText(text, max = 120) {
  const str = String(text || "");
  if (str.length <= max) return str;
  return str.slice(0, max) + "...";
}

/**
 * Redact sensitive keys from an object (shallow).
 * Returns a new object with sensitive values replaced by "[REDACTED]".
 */
/**
 * Redact sensitive keys from an object.
 * Supports 1-level nesting for nested objects.
 */
export function redactObject(obj, allowlist = null) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => typeof item === "object" ? redactObject(item, allowlist) : item);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("key") || lowerKey.includes("token") || lowerKey.includes("secret")) {
      result[key] = "[REDACTED]";
    } else if (lowerKey === "email" || lowerKey === "phone") {
      result[key] = typeof value === "string" ? redactEmail(value) : "[REDACTED]";
    } else if (allowlist && !allowlist.has(key)) {
      continue;
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value, allowlist);
    } else if (typeof value === "string" && value.length > 200) {
      result[key] = redactText(value, 200);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Partially mask email addresses.
 * "user@example.com" → "u***@example.com"
 */
export function redactEmail(email) {
  const str = String(email || "");
  const atIndex = str.indexOf("@");
  if (atIndex <= 0) return str;
  return str[0] + "***" + str.slice(atIndex);
}
