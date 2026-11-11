"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Budget,
  Category,
  PlaidItem,
  Transaction,
  createBudget,
  createCategory,
  createTransaction,
  deleteBudget,
  deleteCategory,
  deletePlaidItem,
  deleteTransaction,
  getBudgets,
  getCategories,
  getPlaidItems,
  getTransactions,
  syncPlaidTransactions,
  updateTransactionCategory,
} from "@/lib/api";
import PlaidConnectButton from "./plaid-connect-button";

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

export default function DashboardPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetMonth, setBudgetMonth] = useState(currentMonthValue);
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [savingCategory, setSavingCategory] = useState<number | null>(null);
  const [budgetRevision, refreshBudgets] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"income" | "expense">("expense");

  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>("");

  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  async function loadData() {
    try {
      const [categoriesRes, transactionsRes, plaidItemsRes] = await Promise.all([
        getCategories(),
        getTransactions(),
        getPlaidItems(),
      ]);
      setCategories(categoriesRes.categories);
      setTransactions(transactionsRes.transactions);
      refreshBudgets((revision) => revision + 1);
      setPlaidItems(plaidItemsRes.items);
    } catch (err) {
      if (err instanceof Error && /invalid or expired token|missing or malformed/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load your data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("walletapp_token")) {
      router.push("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!budgetMonth || !localStorage.getItem("walletapp_token")) return;
    let active = true;
    getBudgets(budgetMonth).then(({ budgets }) => {
      if (active) setBudgets(budgets);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Failed to load budgets");
    });
    return () => { active = false; };
  }, [budgetMonth, budgetRevision]);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCategory({ name: categoryName, type: categoryType });
      setCategoryName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  async function handleDeleteCategory(id: number) {
    setError(null);
    try {
      await deleteCategory(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createTransaction({
        amount: Number(amount),
        type: txType,
        description: description || undefined,
        transactionDate,
        categoryId: categoryId ? Number(categoryId) : null,
      });
      setAmount("");
      setDescription("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add transaction");
    }
  }

  async function handleDeleteTransaction(id: number) {
    setError(null);
    try {
      await deleteTransaction(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete transaction");
    }
  }

  async function handleAddBudget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createBudget({
        categoryId: Number(budgetCategoryId),
        month: budgetMonth,
        amount: Number(budgetAmount),
      });
      setBudgetCategoryId("");
      setBudgetAmount("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add budget");
    }
  }

  async function handleDeleteBudget(id: number) {
    setError(null);
    try {
      await deleteBudget(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete budget");
    }
  }

  async function handleUnlinkItem(id: number) {
    setError(null);
    try {
      await deletePlaidItem(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink account");
    }
  }

  async function handleSyncNow() {
    setError(null);
    setSyncing(true);
    try {
      const { outcomes } = await syncPlaidTransactions();
      await loadData();
      const failed = outcomes.filter((outcome) => outcome.status === "failed").length;
      if (failed > 0) setError(`Sync failed for ${failed} bank connection(s). Select Sync now to retry.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync transactions");
    } finally {
      setSyncing(false);
    }
  }

  async function handleTransactionCategory(id: number, value: string) {
    setSavingCategory(id);
    setError(null);
    try {
      const { transaction } = await updateTransactionCategory(id, value ? Number(value) : null);
      setTransactions((rows) => rows.map((row) => row.id === id ? transaction : row));
      refreshBudgets((revision) => revision + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSavingCategory(null);
    }
  }

  const needsReview = transactions.filter((t) => t.source === "plaid" && t.category_id === null);
  const visibleTransactions = reviewOnly ? needsReview : transactions;

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const budgetableCategories = expenseCategories.filter(
    (c) => !budgets.some((b) => b.category_id === c.id)
  );

  if (loading) {
    return (
      <main className="dashboard">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <h1>Dashboard</h1>
      {error && <p className="error">{error}</p>}

      <div className="dashboard-columns">
        <div className="panel">
          <h2>Categories</h2>

          <form className="stacked" onSubmit={handleAddCategory}>
            <input
              placeholder="Category name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
            <select value={categoryType} onChange={(e) => setCategoryType(e.target.value as "income" | "expense")}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <button type="submit">Add category</button>
          </form>

          {categories.length === 0 ? (
            <p className="empty">No categories yet.</p>
          ) : (
            <ul className="row-list">
              {categories.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.name} <span className={`badge ${c.type}`}>{c.type}</span>
                  </span>
                  <button type="button" className="icon-button" onClick={() => handleDeleteCategory(c.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h2>Transactions</h2>

          <form onSubmit={handleAddTransaction}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <select value={txType} onChange={(e) => {
              setTxType(e.target.value as "income" | "expense");
              setCategoryId("");
            }}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories
                .filter((c) => c.type === txType)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit">Add transaction</button>
          </form>

          <label>
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
            Review uncategorized bank transactions ({needsReview.length})
          </label>
          {visibleTransactions.length === 0 ? (
            <p className="empty">{reviewOnly ? "No bank transactions to review." : "No transactions yet."}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.transaction_date.slice(0, 10)}</td>
                    <td>
                      {t.description || "—"}{" "}
                      {t.source === "plaid" && <span className="badge bank">bank</span>}
                    </td>
                    <td>
                      <select
                        aria-label={`Category for ${t.description || "transaction"} on ${t.transaction_date.slice(0, 10)}`}
                        value={t.category_id ?? ""}
                        disabled={savingCategory !== null}
                        onChange={(e) => handleTransactionCategory(t.id, e.target.value)}
                      >
                        <option value="">Uncategorized</option>
                        {categories.filter((c) => c.type === t.type || c.id === t.category_id).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="amount" style={{ color: t.type === "income" ? "#1a7f37" : "#c0362c" }}>
                      {t.type === "income" ? "+" : "−"}${Number(t.amount).toFixed(2)}
                    </td>
                    <td>
                      <button type="button" className="icon-button" onClick={() => handleDeleteTransaction(t.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel budgets-panel">
        <div className="budgets-header">
          <h2>Budgets</h2>
          <input
            type="month"
            value={budgetMonth}
            onChange={(e) => {
              setBudgets([]);
              setBudgetCategoryId("");
              setBudgetMonth(e.target.value);
            }}
            aria-label="Budget month"
          />
        </div>

        <form onSubmit={handleAddBudget}>
          <select value={budgetCategoryId} onChange={(e) => setBudgetCategoryId(e.target.value)} required>
            <option value="" disabled>
              Choose a category…
            </option>
            {budgetableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Monthly limit"
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
            required
          />
          <button type="submit" disabled={!budgetMonth || budgetableCategories.length === 0}>
            Add budget
          </button>
        </form>

        {expenseCategories.length === 0 ? (
          <p className="empty">Add an expense category first to set a budget against it.</p>
        ) : budgets.length === 0 ? (
          <p className="empty">No budgets set for this month yet.</p>
        ) : (
          <ul className="row-list budget-list">
            {budgets.map((b) => {
              const limit = Number(b.amount);
              const spent = Number(b.spent);
              const rawPct = limit > 0 ? (spent / limit) * 100 : 0;
              const pct = Math.min(rawPct, 100);
              const over = spent > limit;
              const near = !over && rawPct >= 80;
              const status = over ? "Over budget" : near ? "Near budget" : "On track";
              const statusClass = over ? "over" : near ? "near" : "on-track";
              return (
                <li key={b.id} className="budget-row">
                  <div className="budget-row-top">
                    <span>{b.category_name}</span>
                    <span className={`budget-status ${statusClass}`}>{status}</span>
                    <span className={`budget-amount ${statusClass}`}>
                      ${spent.toFixed(2)} / ${limit.toFixed(2)}
                    </span>
                    <button type="button" className="icon-button" onClick={() => handleDeleteBudget(b.id)}>
                      Delete
                    </button>
                  </div>
                  <div className="budget-bar-track">
                    <div
                      className={`budget-bar-fill ${statusClass}`}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-label={`${b.category_name} budget used`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(pct)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="budgets-header">
          <h2>Linked Bank Accounts</h2>
          {plaidItems.length > 0 && (
            <button type="button" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          )}
        </div>

        <p className="empty" style={{ marginTop: 0 }}>
          Sandbox mode — connect a fake bank with fake data. Pick any institution, then use username{" "}
          <code>user_good</code> and password <code>pass_good</code> when Plaid asks.
        </p>

        <PlaidConnectButton onConnected={() => loadData()} />

        {plaidItems.length > 0 && (
          <ul className="row-list" style={{ marginTop: 16 }}>
            {plaidItems.map((item) => (
              <li key={item.id}>
                <span>
                  {item.institution_name || "Connected bank"}
                  {" — "}
                  {item.accounts.map((a) => `${a.name}${a.mask ? ` ••${a.mask}` : ""}`).join(", ")}
                </span>
                <button type="button" className="icon-button" onClick={() => handleUnlinkItem(item.id)}>
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
