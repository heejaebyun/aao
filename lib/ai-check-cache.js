// lib/ai-check-cache.js — Cache operations
// Extracted from ai-check.js — no business logic changes

import { normalizeEntityInput, hashString } from "./ai-check-entity.js";

export const AI_CHECK_CACHE_VERSION = "v7";
export const aiCheckCache = new Map();

export function buildCacheKey(baseResponse, entityInput) {
  const entity = normalizeEntityInput(entityInput);
  const crawlSnapshotToken = hashString(JSON.stringify(entity.crawlSnapshot || {}));
  return [
    AI_CHECK_CACHE_VERSION,
    baseResponse.engine,
    baseResponse.mode,
    baseResponse.intent,
    entity.companyName,
    entity.domain,
    baseResponse.query,
    crawlSnapshotToken,
  ].join("::");
}

export function cloneCachedResult(result) {
  return JSON.parse(JSON.stringify(result));
}

export function getCachedResult(baseResponse, entityInput) {
  const key = buildCacheKey(baseResponse, entityInput);
  const cached = aiCheckCache.get(key);

  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    aiCheckCache.delete(key);
    return null;
  }

  return cloneCachedResult(cached.result);
}

export function pruneAiCheckCache(maxEntries) {
  for (const [key, cached] of aiCheckCache.entries()) {
    if (!cached || cached.expiresAt <= Date.now()) {
      aiCheckCache.delete(key);
    }
  }

  while (aiCheckCache.size > maxEntries) {
    const oldestKey = aiCheckCache.keys().next().value;
    if (!oldestKey) break;
    aiCheckCache.delete(oldestKey);
  }
}

export function setCachedResult(baseResponse, entityInput, result, cacheTtlMs, cacheMaxEntries) {
  const key = buildCacheKey(baseResponse, entityInput);
  if (aiCheckCache.has(key)) {
    aiCheckCache.delete(key);
  }
  aiCheckCache.set(key, {
    expiresAt: Date.now() + cacheTtlMs,
    result: cloneCachedResult(result),
  });
  pruneAiCheckCache(cacheMaxEntries);
}
