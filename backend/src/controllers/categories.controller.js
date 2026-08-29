const { pool } = require("../config/db");

async function list(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT id, name, type, created_at FROM categories WHERE user_id = $1 ORDER BY type, name",
      [req.userId]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, type } = req.body;

    const result = await pool.query(
      `INSERT INTO categories (user_id, name, type)
       VALUES ($1, $2, $3)
       RETURNING id, name, type, created_at`,
      [req.userId, name, type]
    );

    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "You already have a category with that name" });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, type } = req.body;

    const result = await pool.query(
      `UPDATE categories
       SET name = COALESCE($1, name), type = COALESCE($2, type)
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, type, created_at`,
      [name ?? null, type ?? null, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "You already have a category with that name" });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await pool.query(
      "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
