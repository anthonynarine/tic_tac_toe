// # Filename: src/home/HomePage.jsx
import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CiPen, CiStreamOn } from "react-icons/ci";
import { LuUserRound, LuTrophy } from "react-icons/lu";

import HomeFeatureCard from "./HomeFeatureCard";
import HomeGameCard from "./HomeGameCard";
import { TicTacToeIcon, ConnectFourIcon, SudokuIcon, CheckersIcon, PokerIcon } from "./GameIcons";
import Button from "../ui/Button";
import { useUserContext } from "../../context/userContext";
import { useAuth } from "../../auth/hooks/useAuth";
import authAxios from "../../auth/authAxios";
import useGameCreation from "../game/hooks/useGameCreation";
import { showToast } from "../../utils/toast/Toast";
import { connectFourApi } from "../../api/connectFourApi";
import { checkersApi } from "../../api/checkersApi";
import { pokerApi } from "../../api/pokerApi";

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useUserContext();
  const { loginWithTokens } = useAuth();
  const { createNewGame } = useGameCreation();

  const displayName = useMemo(() => {
    const first = user?.first_name?.trim();
    if (first) return first;
    const email = user?.email || "";
    if (email.includes("@")) return email.split("@")[0];
    return "Summoner";
  }, [user]);

  const safeNavigate = useCallback(async (url) => {
    const before = `${window.location.pathname}${window.location.search}`;
    navigate(url);
    setTimeout(() => {
      if (`${window.location.pathname}${window.location.search}` === before)
        window.location.assign(url);
    }, 0);
  }, [navigate]);

  const handleComingSoon = useCallback((label) => {
    showToast("info", `${label} is coming soon.`);
  }, []);

  const handleGuestSignIn = useCallback(async () => {
    try {
      const { data } = await authAxios.post("demo/login/guest/");
      const { access, refresh } = data || {};
      if (!access || !refresh) throw new Error("missing demo tokens");
      await loginWithTokens({ access, refresh });
      showToast("success", "Signed in as guest.");
      navigate("/");
    } catch (err) {
      console.error("[HomePage] guest sign-in failed:", err);
      showToast(
        "error",
        err?.response?.data?.detail || "Guest sign-in is unavailable."
      );
    }
  }, [loginWithTokens, navigate]);

  const handleCreateMultiplayer = useCallback(async () => {
    if (!isLoggedIn) { navigate("/login"); return; }
    try {
      const g = await createNewGame(false);
      if (!g?.id) throw new Error("missing id");
      const qs = new URLSearchParams();
      if (g.sessionKey) qs.set("sessionKey", String(g.sessionKey));
      await safeNavigate(`/lobby/tic_tac_toe/${g.id}${qs.toString() ? `?${qs}` : ""}`);
    } catch {
      showToast("error", "Failed to create a multiplayer game.");
    }
  }, [isLoggedIn, navigate, createNewGame, safeNavigate]);

  const handleCreateAI = useCallback(async () => {
    if (!isLoggedIn) { navigate("/login"); return; }
    try {
      const g = await createNewGame(true);
      if (!g?.id) throw new Error("missing id");
      await safeNavigate(`/games/ai/${g.id}`);
    } catch {
      showToast("error", "Failed to create an AI game.");
    }
  }, [isLoggedIn, navigate, createNewGame, safeNavigate]);

  const games = useMemo(() => [
    {
      id: "ttt",
      title: "Tic-Tac-Toe",
      statusText: "Live",
      icon: TicTacToeIcon,
      featured: true,
      actions: [
        { id: "ai", label: "vs AI",     onClick: handleCreateAI },
        { id: "mp", label: "vs Friend", onClick: handleCreateMultiplayer },
      ],
    },
    {
      id: "connect-four",
      title: "Connect Four",
      statusText: "Live",
      icon: ConnectFourIcon,
      actions: [
        { id: "ai", label: "vs AI", onClick: () => { if (!isLoggedIn) { navigate("/login"); return; } navigate("/games/connect-four/ai"); } },
        {
          id: "mp", label: "vs Friend",
          onClick: async () => {
            if (!isLoggedIn) { navigate("/login"); return; }
            try {
              const g = await connectFourApi.createGame(false);
              const qs = new URLSearchParams();
              if (g.sessionKey) qs.set("sessionKey", String(g.sessionKey));
              await safeNavigate(`/lobby/connect_four/${g.id}${qs.toString() ? `?${qs}` : ""}`);
            }
            catch { showToast("error", "Could not create game."); }
          },
        },
      ],
    },
    {
      id: "checkers",
      title: "Checkers",
      statusText: "Live",
      icon: CheckersIcon,
      actions: [
        { id: "ai", label: "vs AI", onClick: () => { if (!isLoggedIn) { navigate("/login"); return; } navigate("/games/checkers/ai"); } },
        {
          id: "mp", label: "vs Friend",
          onClick: async () => {
            if (!isLoggedIn) { navigate("/login"); return; }
            try {
              const g = await checkersApi.createGame(false);
              const qs = new URLSearchParams();
              if (g.sessionKey) qs.set("sessionKey", String(g.sessionKey));
              await safeNavigate(`/lobby/checkers/${g.id}${qs.toString() ? `?${qs}` : ""}`);
            }
            catch { showToast("error", "Could not create game."); }
          },
        },
      ],
    },
    {
      id: "poker",
      title: "Poker",
      statusText: "Live",
      icon: PokerIcon,
      actions: [
        { id: "ai", label: "vs AI", onClick: () => { if (!isLoggedIn) { navigate("/login"); return; } navigate("/games/poker/ai"); } },
        {
          id: "mp", label: "vs Friend",
          onClick: async () => {
            if (!isLoggedIn) { navigate("/login"); return; }
            try {
              const g = await pokerApi.createGame(false);
              const qs = new URLSearchParams();
              if (g.sessionKey) qs.set("sessionKey", String(g.sessionKey));
              await safeNavigate(`/lobby/poker/${g.id}${qs.toString() ? `?${qs}` : ""}`);
            }
            catch { showToast("error", "Could not create game."); }
          },
        },
      ],
    },
    {
      id: "sudoku",
      title: "Sudoku",
      statusText: "Live",
      icon: SudokuIcon,
      actions: [
        { id: "play", label: "Play", onClick: () => { if (!isLoggedIn) { navigate("/login"); return; } navigate("/games/sudoku"); } },
      ],
    },
  ], [handleCreateAI, handleCreateMultiplayer, isLoggedIn, navigate, safeNavigate]);

  const features = useMemo(() => [
    { key: "tweets", title: "Feed", description: "Short posts and reactions.",      icon: <CiStreamOn size={14} />, badge: "SOON" },
    { key: "blog",   title: "Blog", description: "Long-form writing and profiles.", icon: <CiPen size={14} />,     badge: "SOON" },
  ], []);

  const [featuredGame, ...secondaryGames] = games;

  return (
    <div className="w-full px-1 sm:px-4 pt-1 pb-4 sm:pb-8 [@media(min-width:768px)_and_(max-height:700px)]:pb-3">
      <div className="mx-auto max-w-3xl">

        {/* ── HERO ─────────────────────────────── */}
        <div className="relative mb-6 sm:mb-10 [@media(min-width:768px)_and_(max-height:700px)]:mb-4">
          <div className="absolute -top-8 -left-8 -z-10 h-44 w-44 bg-radial-cyan-glow opacity-50 sm:h-64 sm:w-64 sm:opacity-60" />
          <p className="text-[10px] tracking-[0.32em] sm:tracking-[0.4em] uppercase font-semibold mb-3 sm:mb-4 text-text-muted [@media(min-width:768px)_and_(max-height:700px)]:mb-2">
            Game Hub
          </p>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight mb-2 sm:mb-3 text-text-primary [@media(min-width:768px)_and_(max-height:700px)]:text-4xl [@media(min-width:768px)_and_(max-height:700px)]:mb-2">
            {isLoggedIn ? (
              <>Welcome back, <span className="text-brand-cyan">{displayName}</span></>
            ) : (
              <>Enter the <span className="text-brand-cyan">Arena</span></>
            )}
          </h1>
          <p className="text-sm max-w-sm leading-relaxed text-text-secondary">
            Multiplayer games, AI opponents, and live chat with friends.
          </p>

          {!isLoggedIn && (
            <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={handleGuestSignIn}
              >
                <LuUserRound size={16} />
                Sign in as Guest
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
            </div>
          )}
        </div>

        {/* ── GAMES ────────────────────────────── */}
        <div className="mb-7 sm:mb-10 [@media(min-width:768px)_and_(max-height:700px)]:mb-4">
          <SectionDivider label="Games" />
          <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3 [@media(min-width:768px)_and_(max-height:700px)]:mt-3 [@media(min-width:768px)_and_(max-height:700px)]:space-y-2.5">
            <HomeGameCard game={featuredGame} featured onComingSoon={handleComingSoon} />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 [@media(min-width:768px)_and_(max-height:700px)]:gap-2.5">
              {secondaryGames.map((game) => (
                <HomeGameCard key={game.id} game={game} onComingSoon={handleComingSoon} />
              ))}
            </div>
          </div>

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => navigate("/leaderboard")}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-brand-cyan transition-colors [@media(min-width:768px)_and_(max-height:700px)]:mt-2"
            >
              <LuTrophy size={14} />
              View friends leaderboard
            </button>
          )}
        </div>

        {/* ── COMING SOON ──────────────────────── */}
        <div>
          <SectionDivider label="Coming Soon" muted />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 [@media(min-width:768px)_and_(max-height:700px)]:mt-3">
            {features.map((f) => (
              <HomeFeatureCard
                key={f.key}
                title={f.title}
                description={f.description}
                icon={f.icon}
                badge={f.badge}
                disabled
                onClick={() => handleComingSoon(f.title)}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function SectionDivider({ label, muted = false }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-[10px] tracking-[0.35em] uppercase font-semibold shrink-0 ${
          muted ? "text-text-faint" : "text-text-muted"
        }`}
      >
        {label}
      </span>
      <div className={`flex-1 h-px bg-gradient-to-r ${muted ? "from-border-soft/40" : "from-border-soft"} to-transparent`} />
    </div>
  );
}
