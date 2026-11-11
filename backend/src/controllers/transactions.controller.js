const { invalidateCommittedMutation } = require("../middleware/cache");
const { pool } = require("../config/db");

async function assertCategoryOwnership(categoryId, userId, type) {
  if (categoryId === undefined || categoryId === null) return true;
  const result = await pool.query("SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND type = $3", [
    categoryId,
    userId,
    type,
  ]);
  return result.rows.length > 0;
}

async function list(req, res, next) {
  try {
    const { type, categoryId } = req.query;

    const conditions = ["user_id = $1"];
    const params = [req.userId];

    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (categoryId) {
      params.push(categoryId);
      conditions.push(`category_id = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT id, category_id, amount, type, description, transaction_date, created_at, source
       FROM transactions
       WHERE ${conditions.join(" AND ")}
       ORDER BY transaction_date DESC, created_at DESC`,
      params
    );

    res.json({ transactions: result.rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { amount, type, description, transactionDate, categoryId } = req.body;

    if (!(await assertCategoryOwnership(categoryId, req.userId, type))) {
      return res.status(400).json({ error: "Choose a category on your account that matches the transaction type" });
    }

    const result = await pool.query(
      `INSERT INTO transactions (user_id, category_id, amount, type, description, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category_id, amount, type, description, transaction_date, created_at, source`,
      [req.userId, categoryId ?? null, amount, type, description ?? null, transactionDate]
    );

    await invalidateCommittedMutation(req);
    res.status(201).json({ transaction: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { amount, type, description, transactionDate, categoryId } = req.body;

    const result = await pool.query(
      `UPDATE transactions
       SET amount = COALESCE($1, amount),
           type = COALESCE($2, type),
           description = CASE WHEN $8 THEN $3 ELSE description END,
           transaction_date = COALESCE($4, transaction_date),
           category_id = CASE WHEN $9 THEN $5 ELSE category_id END,
           updated_at = now()
       WHERE id = $6 AND user_id = $7
         AND ((CASE WHEN $9 THEN $5 ELSE category_id END) IS NULL OR EXISTS (
           SELECT 1 FROM categories c
           WHERE c.id = CASE WHEN $9 THEN $5 ELSE transactions.category_id END
             AND c.user_id = transactions.user_id
             AND c.type = COALESCE($2, transactions.type)
         ))
       RETURNING id, category_id, amount, type, description, transaction_date, created_at, source`,
      [amount ?? null, type ?? null, description ?? null, transactionDate ?? null, categoryId ?? null, req.params.id, req.userId, description !== undefined, categoryId !== undefined]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query("SELECT 1 FROM transactions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
      if (existing.rowCount) return res.status(400).json({ error: "Choose a category on your account that matches the transaction type" });
      return res.status(404).json({ error: "Transaction not found" });
    }

    await invalidateCommittedMutation(req);
    res.json({ transaction: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await pool.query(
      "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    await invalidateCommittedMutation(req);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
