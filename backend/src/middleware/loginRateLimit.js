const crypto = require("crypto");
const { getRedisClient } = require("../config/redis");

const fallbackCounters = new Map();

function loginKey(req) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const identity = `${req.ip || req.socket?.remoteAddress || "unknown"}:${email}`;
  return crypto.createHash("sha256").update(identity).digest("hex");
}

function incrementFallback(key, windowMs, now = Date.now()) {
  const current = fallbackCounters.get(key);
  if (!current || current.expiresAt <= now) {
    const next = { count: 1, expiresAt: now + windowMs };
    fallbackCounters.set(key, next);
    return next;
  }
  current.count += 1;
  return current;
}

function createLoginRateLimit(options = {}) {
  const windowSeconds = options.windowSeconds || Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS || 900);
  const maxAttempts = options.maxAttempts || Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
  const getClient = options.getClient || getRedisClient;

  return async function loginRateLimit(req, res, next) {
    const key = loginKey(req);
    let count;
    let retryAfter;

    try {
      const redis = await getClient();
      if (redis) {
        const redisKey = `walletapp:login-limit:${key}`;
        count = await redis.incr(redisKey);
        if (count === 1) await redis.expire(redisKey, windowSeconds);
        retryAfter = await redis.ttl(redisKey);
      } else {
        const counter = incrementFallback(key, windowSeconds * 1000);
        count = counter.count;
        retryAfter = Math.max(1, Math.ceil((counter.expiresAt - Date.now()) / 1000));
      }
    } catch (err) {
      console.error("Login rate limiter failed over to memory", err.message);
      const counter = incrementFallback(key, windowSeconds * 1000);
      count = counter.count;
      retryAfter = Math.max(1, Math.ceil((counter.expiresAt - Date.now()) / 1000));
    }

    res.set("RateLimit-Limit", String(maxAttempts));
    res.set("RateLimit-Remaining", String(Math.max(0, maxAttempts - count)));
    res.set("RateLimit-Reset", String(retryAfter));

    if (count > maxAttempts) {
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many login attempts. Try again later." });
    }
    next();
  };
}

module.exports = { createLoginRateLimit, loginKey, incrementFallback };
