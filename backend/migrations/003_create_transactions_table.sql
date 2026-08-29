CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Preserve transaction history when a category is deleted.
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,

    -- Exact decimal storage avoids floating-point rounding for money.
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    description VARCHAR(255),

    transaction_date DATE NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, transaction_date DESC);
