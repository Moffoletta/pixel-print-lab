export class RateLimiter {
  constructor(options = {}) {
    const { windowMs = 0, max = 0 } = options ?? {};
    this.windowMs = windowMs;
    this.max = max;
    this.attempts = new Map();
  }

  isEnabled() {
    return this.max > 0 && this.windowMs > 0;
  }

  check(key) {
    if (!this.isEnabled()) return { allowed: true };
    if (typeof key !== "string" || key.length === 0) {
      return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) };
    }

    const now = Date.now();
    for (const [entryKey, entry] of this.attempts) {
      if (entry.resetAt <= now) this.attempts.delete(entryKey);
    }

    const attempt = this.attempts.get(key);
    if (attempt && attempt.resetAt > now && attempt.count >= this.max) {
      return { allowed: false, retryAfter: Math.ceil((attempt.resetAt - now) / 1000) };
    }
    return { allowed: true };
  }

  record(key) {
    if (!this.isEnabled()) return;
    if (typeof key !== "string" || key.length === 0) return;

    const now = Date.now();
    const existing = this.attempts.get(key);
    if (existing && existing.resetAt > now) {
      existing.count += 1;
    } else {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    }
  }
}

export function rateLimitMiddleware(limiter, { keyGenerator = (request) => request.ip } = {}) {
  return (request, response, next) => {
    const key = keyGenerator(request);
    const result = limiter.check(key);
    if (!result.allowed) {
      response.setHeader("Retry-After", String(result.retryAfter));
      return response.status(429).json({
        error: { code: "RATE_LIMITED", message: "Troppe richieste. Riprova piu tardi." },
      });
    }
    limiter.record(key);
    next();
  };
}
