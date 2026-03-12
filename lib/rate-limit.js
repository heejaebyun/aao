import { createHash } from "node:crypto";
import net from "node:net";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
const HEADER_CANDIDATES = [
  "cf-connecting-ip",
  "fly-client-ip",
  "fastly-client-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
];

const memoryStore = globalThis.__AAO_RATE_LIMIT_STORE__ || new Map();
let lastPruneAt = globalThis.__AAO_RATE_LIMIT_LAST_PRUNE_AT__ || 0;
let upstashWarningShown = globalThis.__AAO_RATE_LIMIT_UPSTASH_WARNED__ || false;

globalThis.__AAO_RATE_LIMIT_STORE__ = memoryStore;
globalThis.__AAO_RATE_LIMIT_LAST_PRUNE_AT__ = lastPruneAt;
globalThis.__AAO_RATE_LIMIT_UPSTASH_WARNED__ = upstashWarningShown;

export async function rateLimit(
  request,
  { namespace = "global", maxRequests = 10, windowMs = DEFAULT_WINDOW_MS } = {}
) {
  // Skip rate limiting in development / debug mode
  if (process.env.NODE_ENV === "development" || process.env.AAO_DEBUG_LOG === "1") {
    return { allowed: true, remaining: maxRequests, resetIn: 0, client: "dev-bypass", store: "none" };
  }

  const client = extractClientDescriptor(request);
  const key = createHash("sha256")
    .update(`${namespace}:${client.fingerprint}`)
    .digest("hex");

  const upstashConfig = getUpstashConfig();

  if (upstashConfig) {
    try {
      const result = await rateLimitWithUpstash(upstashConfig, key, maxRequests, windowMs);
      return { ...result, client: client.label, store: "upstash" };
    } catch (error) {
      if (!upstashWarningShown) {
        console.warn("[AAO] Upstash rate limit fallback:", error.message);
        upstashWarningShown = true;
        globalThis.__AAO_RATE_LIMIT_UPSTASH_WARNED__ = true;
      }
    }
  }

  const result = rateLimitInMemory(key, maxRequests, windowMs);
  return { ...result, client: client.label, store: "memory" };
}

export function buildRateLimitHeaders(limit, maxRequests) {
  const resetIn = Number(limit?.resetIn ?? 0);
  const resetAt = Math.floor(Date.now() / 1000) + Math.max(resetIn, 0);

  return {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(limit?.remaining ?? 0),
    "X-RateLimit-Reset": String(resetAt),
    "X-RateLimit-Reset-After": String(Math.max(resetIn, 0)),
    ...(limit?.allowed ? {} : { "Retry-After": String(Math.max(resetIn, 0)) }),
  };
}

function extractClientDescriptor(request) {
  const headers = request?.headers;
  const ip = extractClientIp(headers);

  if (ip) {
    return {
      label: ip,
      fingerprint: `ip:${ip}`,
    };
  }

  const userAgent = normalizeHeaderValue(headers?.get("user-agent"));
  const acceptLanguage = normalizeHeaderValue(headers?.get("accept-language"));
  const anonymousId = createHash("sha256")
    .update(`${userAgent}|${acceptLanguage}`)
    .digest("hex")
    .slice(0, 24);

  return {
    label: `anon:${anonymousId}`,
    fingerprint: `anon:${anonymousId}`,
  };
}

function extractClientIp(headers) {
  for (const headerName of HEADER_CANDIDATES) {
    const value = normalizeIp(headers?.get(headerName));
    if (value) return value;
  }

  const forwardedFor = headers?.get("x-forwarded-for");
  if (!forwardedFor) return "";

  for (const part of forwardedFor.split(",")) {
    const value = normalizeIp(part);
    if (value) return value;
  }

  return "";
}

function normalizeIp(rawValue) {
  let value = String(rawValue || "").trim();
  if (!value) return "";

  value = value.replace(/^for=/i, "").trim();
  value = value.replace(/^"|"$/g, "");
  value = value.split(";")[0].trim();

  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.split(":")[0];
  }

  if (value.toLowerCase().startsWith("::ffff:")) {
    value = value.slice(7);
  }

  return net.isIP(value) ? value.toLowerCase() : "";
}

function normalizeHeaderValue(value) {
  return String(value || "").trim().slice(0, 256);
}

function rateLimitInMemory(key, maxRequests, windowMs) {
  const now = Date.now();
  pruneMemoryStore(now);

  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(maxRequests - 1, 0),
      resetIn: Math.ceil(windowMs / 1000),
    };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return finalizeLimit(current.count, maxRequests, current.resetAt - now, windowMs);
}

function pruneMemoryStore(now) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;

  for (const [key, entry] of memoryStore.entries()) {
    if (!entry || entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }

  lastPruneAt = now;
  globalThis.__AAO_RATE_LIMIT_LAST_PRUNE_AT__ = lastPruneAt;
}

async function rateLimitWithUpstash(config, key, maxRequests, windowMs) {
  const [countResult, ttlResult] = await runUpstashCommands(config, [
    ["INCR", key],
    ["PTTL", key],
  ]);

  const count = Number(getUpstashResult(countResult));
  let ttlMs = Number(getUpstashResult(ttlResult));

  if (!Number.isFinite(count)) {
    throw new Error("Invalid INCR result from Upstash.");
  }

  if (count === 1 || !Number.isFinite(ttlMs) || ttlMs < 0) {
    await runUpstashCommands(config, [["PEXPIRE", key, String(windowMs)]]);
    ttlMs = windowMs;
  }

  return finalizeLimit(count, maxRequests, ttlMs, windowMs);
}

async function runUpstashCommands(config, commands) {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash error ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

function getUpstashResult(entry) {
  if (entry && typeof entry === "object" && "result" in entry) {
    return entry.result;
  }
  return entry;
}

function finalizeLimit(count, maxRequests, ttlMs, windowMs) {
  const resetInSeconds = Math.ceil((Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : windowMs) / 1000);
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(maxRequests - count, 0),
    resetIn: resetInSeconds,
  };
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}
