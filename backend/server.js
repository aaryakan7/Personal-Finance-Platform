require("dotenv").config();

const app = require("./src/app");
const { pool } = require("./src/config/db");
const { closeRedis } = require("./src/config/redis");

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`walletapp backend listening on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await Promise.allSettled([pool.end(), closeRedis()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
