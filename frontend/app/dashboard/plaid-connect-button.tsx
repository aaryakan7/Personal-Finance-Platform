"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createPlaidLinkToken, exchangePlaidPublicToken, syncPlaidTransactions } from "@/lib/api";

export default function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "linking" | "syncing">("idle");
  const [error, setError] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken) => {
      if (!publicToken) return;
      setStatus("syncing");
      try {
        await exchangePlaidPublicToken(publicToken);
        await syncPlaidTransactions();
        onConnected();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to finish connecting");
      } finally {
        setStatus("idle");
        setLinkToken(null);
      }
    },
    onExit: () => {
      setStatus("idle");
      setLinkToken(null);
    },
  });

  // Plaid Link can open only after both its script and link token are ready.
  useEffect(() => {
    if (ready && linkToken && status === "starting") {
      setStatus("linking");
      open();
    }
  }, [ready, linkToken, status, open]);

  async function handleClick() {
    setError(null);
    setStatus("starting");
    try {
      const { linkToken: token } = await createPlaidLinkToken();
      setLinkToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start bank connection");
      setStatus("idle");
    }
  }

  const labels: Record<typeof status, string> = {
    idle: "Connect a bank account",
    starting: "Starting…",
    linking: "Waiting for Plaid…",
    syncing: "Importing transactions…",
  };

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={status !== "idle"}>
        {labels[status]}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
