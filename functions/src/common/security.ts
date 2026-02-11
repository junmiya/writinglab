interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function createRateLimiter(
  limit: number,
  windowMs: number,
): (key: string) => RateLimitResult {
  const buckets = new Map<string, RateBucket>();

  return (key: string): RateLimitResult => {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfterMs: windowMs };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(current.resetAt - now, 0),
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(limit - current.count, 0),
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  };
}

const SENSITIVE_PATTERNS = [
  /OPENAI_API_KEY/gi,
  /GEMINI_API_KEY/gi,
  /ANTHROPIC_API_KEY/gi,
  /Bearer\s+[A-Za-z0-9_.-]+/gi,
];

export function redactErrorMessage(input: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (message, pattern) => message.replace(pattern, '[REDACTED]'),
    input,
  );
}

export function assertRequestSize(value: string, maxChars: number, fieldName: string): void {
  if (value.length > maxChars) {
    throw new Error(`${fieldName.toUpperCase()}_TOO_LARGE`);
  }
}
