const { cacheResponse } = require("../src/middleware/cache");
const { createLoginRateLimit } = require("../src/middleware/loginRateLimit");

function response() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("cache middleware serves a user-scoped Redis hit", async () => {
  const redis = {
    get: async (key) => (key.includes("cache-version") ? "3" : JSON.stringify({ cached: true })),
  };
  const req = { userId: "42", originalUrl: "/api/reports/monthly-trend?months=6" };
  const res = response();
  const next = jest.fn();

  await cacheResponse(60, { getClient: async () => redis })(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.headers["X-Cache"]).toBe("HIT");
  expect(res.body).toEqual({ cached: true });
});

test("cache middleware stores a successful miss with a TTL", async () => {
  const writes = [];
  const redis = {
    get: async (key) => (key.includes("cache-version") ? "0" : null),
    set: async (...args) => writes.push(args),
  };
  const req = { userId: "7", originalUrl: "/api/categories" };
  const res = response();

  await new Promise((resolve) => {
    cacheResponse(45, { getClient: async () => redis })(req, res, () => {
      res.json({ categories: [] });
      setImmediate(resolve);
    });
  });

  expect(res.headers["X-Cache"]).toBe("MISS");
  expect(writes).toHaveLength(1);
  expect(writes[0].slice(1)).toEqual([JSON.stringify({ categories: [] }), { EX: 45 }]);
});

test("login limiter blocks attempts above the configured maximum", async () => {
  let count = 0;
  const redis = {
    incr: async () => ++count,
    expire: async () => true,
    ttl: async () => 60,
  };
  const middleware = createLoginRateLimit({
    maxAttempts: 2,
    windowSeconds: 60,
    getClient: async () => redis,
  });
  const req = { ip: "127.0.0.1", body: { email: "person@example.com" } };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const next = jest.fn();
    await middleware(req, response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  }

  const blocked = response();
  const blockedNext = jest.fn();
  await middleware(req, blocked, blockedNext);

  expect(blockedNext).not.toHaveBeenCalled();
  expect(blocked.statusCode).toBe(429);
  expect(blocked.headers["Retry-After"]).toBe("60");
});
