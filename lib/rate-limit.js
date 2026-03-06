// lib/rate-limit.js — simple in-memory rate limiting
// Replace with Redis/Upstash for multi-instance production deployments.

const rateLimitMap = new Map();
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export function rateLimit(ip, maxRequests = 10, windowMs = DEFAULT_WINDOW_MS) {
  const key = ip || "unknown";
  const now = Date.now();
  const windowStart = now - windowMs;
  const existing = rateLimitMap.get(key) || [];
  const timestamps = existing.filter((timestamp) => timestamp > windowStart);

  if (timestamps.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((timestamps[0] + windowMs - now) / 1000),
    };
  }

  timestamps.push(now);
  rateLimitMap.set(key, timestamps);

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
  };
}

setInterval(() => {
  const now = Date.now();

  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((timestamp) => timestamp > now - DEFAULT_WINDOW_MS);

    if (valid.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, valid);
    }
  }
}, 10 * 60 * 1000);
