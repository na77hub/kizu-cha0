// server/rate-limiter.js

const SWEEP_THRESHOLD = 1000;

// 時間窓方式の連投制限。windowMs の間に limit 回まで許可する。
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const history = new Map(); // key -> 許可した時刻の配列

  function sweep(current) {
    for (const [key, times] of history) {
      if (times.every((time) => current - time >= windowMs)) history.delete(key);
    }
  }

  return {
    // 許可するなら true を返して記録し、制限超過なら false を返す。
    tryConsume(key) {
      const current = now();
      const times = (history.get(key) ?? []).filter((time) => current - time < windowMs);
      if (times.length >= limit) {
        history.set(key, times);
        return false;
      }
      times.push(current);
      history.set(key, times);
      if (history.size > SWEEP_THRESHOLD) sweep(current);
      return true;
    },
  };
}
