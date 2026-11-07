import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "../server/rate-limiter.js";

test("createRateLimiter: 時間窓内で limit 回を超えると拒否する", () => {
  let current = 0;
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => current });

  assert.equal(limiter.tryConsume("k"), true);
  assert.equal(limiter.tryConsume("k"), true);
  assert.equal(limiter.tryConsume("k"), true);
  assert.equal(limiter.tryConsume("k"), false);
});

test("createRateLimiter: 時間窓が過ぎると再び許可する", () => {
  let current = 0;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => current });

  assert.equal(limiter.tryConsume("k"), true);
  current = 999;
  assert.equal(limiter.tryConsume("k"), false);
  current = 1000;
  assert.equal(limiter.tryConsume("k"), true);
});

test("createRateLimiter: キーごとに独立して数える", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

  assert.equal(limiter.tryConsume("a"), true);
  assert.equal(limiter.tryConsume("b"), true);
  assert.equal(limiter.tryConsume("a"), false);
});
