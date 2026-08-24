const { getRedisClient } = require("../config/redis");

const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60);

async function userCacheKey(req, getClient = getRedisClient) {
  const redis = await getClient();
  if (!redis) return { redis: null, key: null };

  const versionKey = `walletapp:cache-version:${req.userId}`;
  const version = (await redis.get(versionKey)) || "0";
  return { redis, key: `walletapp:cache:${req.userId}:${version}:${req.originalUrl}` };
}

function cacheResponse(ttlSeconds = DEFAULT_TTL_SECONDS, options = {}) {
  return async function cacheMiddleware(req, res, next) {
    try {
      const { redis, key } = await userCacheKey(req, options.getClient);
      if (!redis) return next();

      const cached = await redis.get(key);
      if (cached) {
        res.set("X-Cache", "HIT");
        return res.json(JSON.parse(cached));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.set(key, JSON.stringify(body), { EX: ttlSeconds }).catch((err) => {
            console.error("Redis cache write failed", err.message);
          });
        }
        res.set("X-Cache", "MISS");
        return originalJson(body);
      };
      next();
    } catch (err) {
      console.error("Redis cache read failed", err.message);
      next();
    }
  };
}

function invalidateUserCacheOnMutation(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  res.on("finish", () => {
    if (!req.userId || res.statusCode < 200 || res.statusCode >= 300) return;
    getRedisClient()
      .then((redis) => redis?.incr(`walletapp:cache-version:${req.userId}`))
      .catch((err) => console.error("Redis cache invalidation failed", err.message));
  });
  next();
}

module.exports = { cacheResponse, invalidateUserCacheOnMutation, userCacheKey };
