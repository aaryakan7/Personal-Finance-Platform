const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { encrypt, decrypt } = require("../utils/crypto");
const { signToken } = require("../utils/jwt");
const { DEFAULT_CATEGORIES } = require("../utils/defaultCategories");

const BCRYPT_ROUNDS = 12;

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
  };
}

async function signup(req, res, next) {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const phoneNumberEncrypted = phoneNumber ? encrypt(phoneNumber) : null;

    const client = await pool.connect();
    let user;
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone_number_encrypted)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, full_name, created_at`,
        [email, passwordHash, fullName, phoneNumberEncrypted]
      );
      user = userResult.rows[0];

      for (const category of DEFAULT_CATEGORIES) {
        await client.query(
          "INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)",
          [user.id, category.name, category.type]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const token = signToken(user);

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT id, email, password_hash, full_name FROM users WHERE email = $1",
      [email]
    );

    // Keep both failure cases identical to prevent account enumeration.
    const genericError = () => res.status(401).json({ error: "Invalid email or password" });

    if (result.rows.length === 0) {
      return genericError();
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return genericError();
    }

    const token = signToken(user);

    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT id, email, full_name, phone_number_encrypted, created_at FROM users WHERE id = $1",
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];
    const user = toPublicUser(row);

    if (row.phone_number_encrypted) {
      user.phoneNumber = decrypt(row.phone_number_encrypted);
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, me };
