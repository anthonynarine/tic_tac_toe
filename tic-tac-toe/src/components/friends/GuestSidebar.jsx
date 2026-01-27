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
        <div
          className="
            rounded-2xl
            border border-[#1DA1F2]/15
            bg-black/30
            p-4
            shadow-[0_0_18px_rgba(29,161,242,0.08)]
          "
        >
          <div className="text-[#1DA1F2] font-semibold text-sm">
            Multiplayer Hub
          </div>

          <div className="mt-1 text-xs text-slate-200/65 leading-relaxed">
            Sign in to access Friends, Invites, Presence, and Direct Messages.
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={goLogin}
              className="
                w-full
                flex items-center justify-center gap-2
                rounded-xl
                border border-[#1DA1F2]/20
                bg-[#1DA1F2]/10
                px-3 py-2
                text-sm text-[#1DA1F2]
                hover:bg-[#1DA1F2]/15
                transition
              "
            >
              <CiLogin size={18} />
              Log In
            </button>

            <button
              type="button"
              onClick={goRegister}
              className="
                w-full
                flex items-center justify-center gap-2
                rounded-xl
                border border-white/10
                bg-white/5
                px-3 py-2
                text-sm text-slate-100
                hover:bg-white/10
                transition
              "
            >
              <CiUser size={18} />
              Sign Up
            </button>
          </div>

          <div className="mt-4 text-[11px] text-slate-200/45">
            You can still explore the Home page as a guest.
          </div>
        </div>
      </div>
    </div>
  );
}
