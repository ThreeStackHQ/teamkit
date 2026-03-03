/**
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production, replace with Redis-backed implementation.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, newEntry);
    return { allowed: true, remaining: limit - 1, resetAt: newEntry.resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  return {
    allowed: entry.count <= limit,
    remaining,
    resetAt: entry.resetAt,
  };
}

export function getRateLimitKey(req: Request): {
  ipKey: string;
  apiKeyKey?: string;
} {
  const ip =
    (req as any).headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
    (req as any).headers?.get?.("x-real-ip") ??
    "unknown";

  const apiKey = (req as any).headers?.get?.("x-api-key");

  return {
    ipKey: `ip:${ip}`,
    apiKeyKey: apiKey ? `apikey:${apiKey}` : undefined,
  };
}
