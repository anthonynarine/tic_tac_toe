// # Filename: src/components/friends/AccountPanel.jsx

import React, { useMemo } from "react";
import { CiLogin, CiLogout } from "react-icons/ci";

export default function AccountPanel({ isLoggedIn, user, onLogin, onLogout }) {
  const displayName = useMemo(() => {
    if (!isLoggedIn) return "";
    return user?.first_name ? String(user.first_name).trim() : "";
  }, [isLoggedIn, user]);

  const initial = useMemo(() => {
    const source = displayName || user?.email || "?";
    return source.charAt(0).toUpperCase();
  }, [displayName, user]);

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={onLogin}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border-soft bg-surface text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-elevated transition"
      >
        <span className="text-sm font-medium">Sign in</span>
        <CiLogin size={20} className="text-text-muted" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-sm font-semibold">
        {initial}
      </span>

      <span
        className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate"
        title={displayName || user?.email}
      >
        {displayName || user?.email || "Account"}
      </span>

      <button
        type="button"
        onClick={onLogout}
        className="h-9 w-9 shrink-0 grid place-items-center rounded-lg text-text-muted hover:text-brand-rose hover:bg-brand-rose/10 transition focus:outline-none"
        title="Logout"
        aria-label="Logout"
      >
        <CiLogout size={20} />
      </button>
    </div>
  );
}
