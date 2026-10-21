type RateLimitRecord = {
  count: number;
  resetAt: number;
};

// In-memory token bucket/sliding window map keyed by identifier (e.g., client IP or phone)
const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given key.
 * @param key Unique key (e.g. `create-ride:${ip}` or `offer:${phone}`)
 * @param maxRequests Maximum requests allowed within windowMs
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitMap.set(key, newRecord);
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: newRecord.resetAt,
    };
  }

  if (current.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: current.resetAt,
    };
  }

  current.count += 1;
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - current.count,
    reset: current.resetAt,
  };
}

/**
 * Helper to extract client IP from NextRequest headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
