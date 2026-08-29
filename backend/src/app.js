const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const categoriesRoutes = require("./routes/categories.routes");
const transactionsRoutes = require("./routes/transactions.routes");
const budgetsRoutes = require("./routes/budgets.routes");
const plaidRoutes = require("./routes/plaid.routes");
const reportsRoutes = require("./routes/reports.routes");
const insightsRoutes = require("./routes/insights.routes");
const { invalidateUserCacheOnMutation } = require("./middleware/cache");
const { pool } = require("./config/db");
const { getRedisClient, isRedisConfigured } = require("./config/redis");

const app = express();

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const redis = await getRedisClient();
    if (isRedisConfigured() && !redis?.isReady) throw new Error("Redis is not ready");
    res.json({ status: "ready", database: "ok", redis: redis ? "ok" : "disabled" });
  } catch (err) {
    res.status(503).json({ status: "not_ready" });
  }
});

app.use(invalidateUserCacheOnMutation);

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/budgets", budgetsRoutes);
app.use("/api/plaid", plaidRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/insights", insightsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

module.exports = app;
