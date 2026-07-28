// ✅ New Code
import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CiLogin, CiUser } from "react-icons/ci";

export default function GuestSidebar() {
  const navigate = useNavigate();

  // # Step 1: Navigation actions
  const goLogin = useCallback(() => navigate("/login"), [navigate]);
  const goRegister = useCallback(() => navigate("/register"), [navigate]);

  return (
    <div className="h-full flex flex-col">
      {/* # Step 2: Guest-only top rail (navbar extension) */}


      {/* # Step 3: Drop content down to align with the hub area */}
      <div className="px-4 pt-20">
        <div className="rounded-2xl border border-brand-cyan/15 bg-surface p-4 shadow-glow-cyan">
          <div className="text-brand-cyan font-semibold text-sm">
            Multiplayer Hub
          </div>

          <div className="mt-1 text-xs text-text-secondary leading-relaxed">
            Sign in to access Friends, Invites, Presence, and Direct Messages.
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={goLogin}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-2 text-sm text-brand-cyan hover:bg-brand-cyan/15 transition"
            >
              <CiLogin size={18} />
              Log In
            </button>

            <button
              type="button"
              onClick={goRegister}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border-soft bg-surface-elevated px-3 py-2 text-sm text-text-primary hover:bg-surface-strong transition"
            >
              <CiUser size={18} />
              Sign Up
            </button>
          </div>

          <div className="mt-4 text-[11px] text-text-faint">
            You can still explore the Home page as a guest.
          </div>
        </div>
      </div>
    </div>
  );
}
