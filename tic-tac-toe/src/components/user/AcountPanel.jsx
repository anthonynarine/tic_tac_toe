// # Filename: src/components/friends/AccountPanel.jsx
// ✅ New Code

import React, { useCallback, useMemo, useState } from "react";
import {
  CiCircleChevDown,
  CiCircleChevUp,
  CiLogout,
  CiCircleAlert,
} from "react-icons/ci";

export default function AccountPanel({ isLoggedIn, user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  // Step 1: Preserve your original display rule (first_name)
  const displayName = useMemo(() => {
    if (!isLoggedIn) return "";
    return user?.first_name ? String(user.first_name).trim() : "";
  }, [isLoggedIn, user]);

  const bodyClassName = useMemo(() => {
    const base =
      "transition-all duration-300 ease-out will-change-[max-height,opacity]";
    return isOpen
      ? `${base} max-h-[240px] opacity-100 mt-3`
      : `${base} max-h-0 opacity-0 mt-0 pointer-events-none`;
  }, [isOpen]);

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 text-left select-none"
        aria-expanded={isOpen}
        aria-controls="account-panel-body"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium tracking-wide text-[#1DA1F2] truncate">
            Account
          </h3>

          {/* ✅ Keep logged-in user pill exactly like your working version */}
          {displayName ? (
            <span
              className="
                inline-flex items-center justify-center
                px-2.5 py-[1px] text-xs font-semibold rounded-full
                bg-[#1DA1F2]/12 text-[#1DA1F2]
                border border-[#1DA1F2]/30
              "
              title={`Signed in as ${displayName}`}
              aria-label={`Signed in as ${displayName}`}
            >
              {displayName}
            </span>
          ) : null}
        </div>

        <span
          className="
            h-9 w-9 grid place-items-center
            rounded-lg hover:bg-[#1DA1F2]/10
            text-[#1DA1F2]/90 hover:text-[#1DA1F2]
            focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/40
          "
          aria-hidden="true"
        >
          {isOpen ? <CiCircleChevUp size={26} /> : <CiCircleChevDown size={26} />}
        </span>
      </button>

      <div id="account-panel-body" className={bodyClassName}>
        <div className="mt-2 space-y-2">
          {/* ✅ Profile: under construction */}
          <button
            type="button"
            disabled
            className="
              w-full flex items-center justify-between
              px-4 py-3 rounded-xl
              border border-slate-700/40 bg-slate-900/35
              text-slate-300/70 cursor-not-allowed
            "
            title="Profile is under construction"
            aria-label="Profile (under construction)"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate">Profile</span>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                (under construction)
              </span>
            </span>

            <CiCircleAlert size={22} className="text-[#1DA1F2]/45" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="
              w-full flex items-center justify-between
              px-4 py-3 rounded-xl
              border border-slate-700/40 bg-slate-900/35
              text-slate-200 hover:text-white
              hover:border-[#1DA1F2]/30 hover:bg-slate-900/45
              transition
            "
          >
            <span>Logout</span>
            <CiLogout size={22} className="text-[#1DA1F2]/70" />
          </button>
        </div>
      </div>
    </section>
  );
}
