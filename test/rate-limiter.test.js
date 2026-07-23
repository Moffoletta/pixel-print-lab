import assert from "node:assert/strict";
import { before, test } from "node:test";
import { RateLimiter, rateLimitMiddleware } from "../src/rate-limiter.js";

let limiter;

before(() => {
  limiter = new RateLimiter({ windowMs: 1000, max: 2 });
});

test("permette richieste fino al limite", () => {
  assert.equal(limiter.check("a").allowed, true);
  limiter.record("a");
  assert.equal(limiter.check("a").allowed, true);
  limiter.record("a");
});

test("blocca oltre il limite", () => {
  assert.equal(limiter.check("a").allowed, false);
  const result = limiter.check("a");
  assert.ok(result.retryAfter > 0);
});

test("usa chiavi diverse", () => {
  assert.equal(limiter.check("b").allowed, true);
  limiter.record("b");
});

test("disabilitato quando max o window sono zero", () => {
  const disabled = new RateLimiter({ windowMs: 0, max: 0 });
  for (let i = 0; i < 5; i += 1) {
    assert.equal(disabled.check("k").allowed, true);
    disabled.record("k");
  }
});

test("disabilitato quando passato false", () => {
  const disabled = new RateLimiter(false);
  assert.equal(disabled.check("k").allowed, true);
});

test("middleware restituisce 429 quando limitato", () => {
  const middlewareLimiter = new RateLimiter({ windowMs: 1000, max: 1 });
  const middleware = rateLimitMiddleware(middlewareLimiter);
  let status;
  let jsonSent;
  const response = {
    setHeader: () => {},
    status: (code) => { status = code; return { json: (body) => { jsonSent = body; } }; },
  };
  middleware({ ip: "1.2.3.4" }, response, () => {});
  middleware({ ip: "1.2.3.4" }, response, () => {});
  assert.equal(status, 429);
  assert.equal(jsonSent.error.code, "RATE_LIMITED");
});
