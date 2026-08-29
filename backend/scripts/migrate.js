require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../src/config/db");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

// Applied filenames make repeated deploys idempotent.
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("No pending migrations. Database is up to date.");
      return;
    }

    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, "utf8");

      console.log(`Applying ${filename}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.log(`  done.`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${filename} failed: ${err.message}`);
      }
    }

    console.log("All migrations applied.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
