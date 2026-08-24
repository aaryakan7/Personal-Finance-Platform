// This file owns the one connection pool the whole app shares to talk to Postgres.
//
// Why a "pool" and not just one connection? Opening a fresh database connection is
// slow (it's a network handshake + auth, similar cost to opening a new TCP/TLS
// connection each time). A pool keeps a handful of connections open and hands them
// out to whichever request needs one, then takes them back when the query is done.
// Every request-handling file in this app should import `pool` from here instead of
// creating its own connection.

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill in your Neon connection string."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hosted Postgres providers require TLS. Certificate verification stays enabled
  // by default in production; the opt-out exists only for a local/self-signed DB.
  ssl: {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  },
});

pool.on("error", (err) => {
  // Fires if an idle client in the pool errors out in the background (e.g. the
  // database restarted). Logging here stops one bad connection from silently
  // killing the whole Node process.
  console.error("Unexpected error on idle Postgres client", err);
});

module.exports = { pool };
