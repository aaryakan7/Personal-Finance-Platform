"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavAuth() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(localStorage.getItem("walletapp_token")));
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem("walletapp_token");
    window.location.href = "/login";
  }

  if (!loggedIn) return null;

  return (
    <>
      <a href="/dashboard">Dashboard</a>
      <a href="/reports">Reports</a>
      <a href="/insights">Insights</a>
      <span className="spacer" />
      <button type="button" className="link" onClick={handleLogout}>
        Log out
      </button>
    </>
  );
}
