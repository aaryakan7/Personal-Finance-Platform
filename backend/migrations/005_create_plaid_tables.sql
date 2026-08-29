CREATE TABLE IF NOT EXISTS plaid_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    item_id TEXT NOT NULL UNIQUE,

    -- Access tokens are encrypted before persistence.
    access_token_encrypted TEXT NOT NULL,

    institution_name TEXT,

    -- Plaid sync resumes from the last committed cursor.
    cursor TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items (user_id);

CREATE TABLE IF NOT EXISTS plaid_accounts (
    id BIGSERIAL PRIMARY KEY,
    plaid_item_id BIGINT NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,

    account_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    mask VARCHAR(4),
    type VARCHAR(30),
    subtype VARCHAR(30),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item_id ON plaid_accounts (plaid_item_id);

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'plaid')),
    -- The unique Plaid id makes repeated syncs idempotent.
    ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS plaid_account_id BIGINT REFERENCES plaid_accounts(id) ON DELETE SET NULL;
