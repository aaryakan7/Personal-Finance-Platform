const { createClient } = require("redis");

let client = null;
let connecting = null;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

async function getRedisClient() {
  if (!isRedisConfigured()) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000),
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });

  client.on("error", (err) => {
    console.error("Redis error", err.message);
  });

  connecting = client
    .connect()
    .then(() => client)
    .catch((err) => {
      console.error("Redis unavailable; continuing without distributed cache", err.message);
      client = null;
      return null;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

async function closeRedis() {
  if (client?.isOpen) await client.quit();
}

module.exports = { getRedisClient, isRedisConfigured, closeRedis };
