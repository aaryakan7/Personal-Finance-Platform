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

  async function loadData(month: string) {
    try {
      const [categoriesRes, transactionsRes, budgetsRes, plaidItemsRes] = await Promise.all([
        getCategories(),
        getTransactions(),
        getBudgets(month),
        getPlaidItems(),
      ]);
      setCategories(categoriesRes.categories);
      setTransactions(transactionsRes.transactions);
      setBudgets(budgetsRes.budgets);
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
    loadData(budgetMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetMonth]);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCategory({ name: categoryName, type: categoryType });
      setCategoryName("");
      await loadData(budgetMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  async function handleDeleteCategory(id: number) {
    setError(null);
    try {
      await deleteCategory(id);
      await loadData(budgetMonth);
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
      await loadData(budgetMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add transaction");
    }
  }

  async function handleDeleteTransaction(id: number) {
    setError(null);
    try {
      await deleteTransaction(id);
      await loadData(budgetMonth);
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
      await loadData(budgetMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add budget");
    }
  }

  async function handleDeleteBudget(id: number) {
    setError(null);
    try {
      await deleteBudget(id);
      await loadData(budgetMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete budget");
    }
  }

  async function handleUnlinkItem(id: number) {
    setError(null);
    try {
      await deletePlaidItem(id);
      await loadData(budgetMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink account");
    }
  }

  async function handleSyncNow() {
    setError(null);
    setSyncing(true);
    try {
      await syncPlaidTransactions();
      await loadData(budgetMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync transactions");
    } finally {
      setSyncing(false);
    }
  }

  function categoryName_(id: number | null) {
    if (id === null) return "Uncategorized";
    return categories.find((c) => c.id === id)?.name || "Uncategorized";
  }

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
            <select value={txType} onChange={(e) => setTxType(e.target.value as "income" | "expense")}>
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

          {transactions.length === 0 ? (
            <p className="empty">No transactions yet — add your first one above.</p>
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
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.transaction_date.slice(0, 10)}</td>
                    <td>
                      {t.description || "—"}{" "}
                      {t.source === "plaid" && <span className="badge bank">bank</span>}
                    </td>
                    <td>{categoryName_(t.category_id)}</td>
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
            onChange={(e) => setBudgetMonth(e.target.value)}
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
          <button type="submit" disabled={budgetableCategories.length === 0}>
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

        <PlaidConnectButton onConnected={() => loadData(budgetMonth)} />

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
