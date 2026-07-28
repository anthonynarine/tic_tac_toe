// # Filename: src/components/navbar/Navbar.jsx
import React, { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CiMenuFries, CiHome } from "react-icons/ci";

import { useUI } from "../../context/uiContext";

const STATIC_TITLES = {
  "/games/sudoku": "Sudoku",
  "/games/connect-four/ai": "Connect Four",
  "/technical-paper": "Tech Overview",
  "/recruiter-demo": "Demo",
};

const DYNAMIC_TITLES = [
  [/^\/games\/ai\//, "Tic-Tac-Toe"],
  [/^\/games\/connect-four\//, "Connect Four"],
  [/^\/games\/\d+/, "Tic-Tac-Toe"],
  [/^\/lobby\//, "Lobby"],
];

function getPageTitle(pathname) {
  if (STATIC_TITLES[pathname] !== undefined) return STATIC_TITLES[pathname];
  for (const [pattern, title] of DYNAMIC_TITLES) {
    if (pattern.test(pathname)) return title;
  }
  return null;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen } = useUI();

  const pageTitle = getPageTitle(location.pathname);
  const isHome = location.pathname === "/";

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(!isSidebarOpen);
  }, [isSidebarOpen, setSidebarOpen]);

  return (
    <header className="sticky top-0 z-50 bg-background-app-panel/90 backdrop-blur-xl border-b border-border-soft">
      {/* thin cyan line at top */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/40 to-transparent" />

      <div className="h-[60px] sm:h-[64px] px-4 grid grid-cols-3 items-center">

        {/* Left: home + wordmark */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className={[
            "group flex items-center gap-2 focus:outline-none w-fit",
            isHome ? "text-brand-cyan" : "text-text-secondary hover:text-brand-cyan",
          ].join(" ")}
          aria-label="Go to Game Hub"
          title="Game Hub"
        >
          <CiHome size={20} className="shrink-0 transition-colors duration-150" />
          <span className="text-[12px] font-semibold tracking-[0.25em] uppercase transition-colors duration-150">
            {pageTitle ?? "GAME HUB"}
          </span>
        </button>

        {/* Center: reserved (Trinity is currently disabled) */}
        <div />

        {/* Right: hamburger (mobile only -- account now lives in the sidebar footer) */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="h-9 w-9 grid place-items-center lg:hidden focus:outline-none text-text-muted transition-colors duration-150 hover:text-brand-cyan"
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          >
            <CiMenuFries size={20} />
          </button>
        </div>

      </div>
    </header>
  );
}
