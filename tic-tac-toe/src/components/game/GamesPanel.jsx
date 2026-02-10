// # Filename: src/components/friends/GamesPanel.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp } from "react-icons/ci";

const LS_KEY = "ui.gamesPanel.isOpen";

export default function GamesPanel({
  isLoggedIn, // kept for future use
  onStartMultiplayer,
  onStartAI,
  onGoHome,
}) {
  // Step 1: Initialize from localStorage (default false)
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw === "true";
    } catch {
      return false;
    }
  });

  const userToggledRef = useRef(false);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setIsOpen((v) => !v);
  }, []);

  // Step 2: Persist to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, String(isOpen));
    } catch {
      // ignore storage errors (private mode, quota)
    }
  }, [isOpen]);

  const bodyClassName = useMemo(() => {
    const base =
      "transition-all duration-300 ease-out will-change-[max-height,opacity]";
    return isOpen
      ? `${base} max-h-[320px] opacity-100 mt-3`
      : `${base} max-h-0 opacity-0 mt-0 pointer-events-none`;
  }, [isOpen]);

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 text-left select-none"
        aria-expanded={isOpen}
        aria-controls="games-panel-body"
      >
        <h3 className="text-sm font-medium tracking-wide text-[#1DA1F2] truncate">
          Games
        </h3>

        <span
          className="
            h-9 w-9 grid place-items-center rounded-lg
            text-[#1DA1F2]/90 hover:text-[#1DA1F2]
            hover:bg-[#1DA1F2]/10
            focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35
          "
          aria-hidden="true"
        >
          {isOpen ? <CiCircleChevUp size={26} /> : <CiCircleChevDown size={26} />}
        </span>
      </button>

      <div id="games-panel-body" className={bodyClassName}>
        <div className="mt-2 space-y-2">
          <button
            type="button"
            onClick={onGoHome}
            className="
              w-full text-left px-4 py-3 rounded-xl
              border border-slate-700/40 bg-slate-900/35
              text-slate-200 hover:text-white
              hover:border-[#1DA1F2]/30 hover:bg-slate-900/45
              transition
            "
          >
            Home
          </button>

          <button
            type="button"
            onClick={onStartMultiplayer}
            className="
              w-full text-left px-4 py-3 rounded-xl
              border border-slate-700/40 bg-slate-900/35
              text-slate-200 hover:text-white
              hover:border-[#1DA1F2]/30 hover:bg-slate-900/45
              transition
            "
          >
            Create Multiplayer Game
          </button>

          <button
            type="button"
            onClick={onStartAI}
            className="
              w-full text-left px-4 py-3 rounded-xl
              border border-slate-700/40 bg-slate-900/35
              text-slate-200 hover:text-white
              hover:border-[#1DA1F2]/30 hover:bg-slate-900/45
              transition
            "
          >
            Play vs AI
          </button>

          <div className="text-xs text-slate-600 px-1 pt-1">
            More games coming (Connect 4, etc.)
          </div>
        </div>
      </div>
    </section>
  );
}
