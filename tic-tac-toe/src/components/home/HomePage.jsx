// # Filename: src/components/home/HomePage.jsx
// ✅ New Code

import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast/Toast";
import { useUserContext } from "../context/userContext";
import useGameCreation from "../game/hooks/useGameCreation";
import FooterTicker from "./FooterTicker";

import {
  CiGrid42,
  CiPlay1,
  CiCloudOn,
  CiTimer,
  CiWifiOn,
  CiUser,
  CiHome,
} from "react-icons/ci";

const HomePage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useUserContext();
  const { createNewGame } = useGameCreation();

  const displayName = useMemo(() => {
    const first = user?.first_name?.trim();
    if (first) return first;
    const email = user?.email || "";
    if (email.includes("@")) return email.split("@")[0];
    return "Player";
  }, [user]);

  // # Step 1: Multiplayer MUST enter via Lobby (host uses sessionKey when available)
  // ✅ New Code (hardened navigation + fallback)
  const navigateToMultiplayerGame = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    try {
      console.log("[HomePage] MP click fired");

      // Step 1: Create multiplayer game
      const newGame = await createNewGame(false);
      console.log("[HomePage] Multiplayer game created:", newGame);

      if (!newGame?.id) throw new Error("Create multiplayer game: missing id");

      // Step 2: Always navigate. Use sessionKey if present, otherwise fall back.
      const qs = new URLSearchParams();
      if (newGame?.sessionKey) {
        qs.set("sessionKey", String(newGame.sessionKey));
      }

      const targetUrl = `/lobby/${newGame.id}${qs.toString() ? `?${qs}` : ""}`;

      // Step 3: SPA navigate
      console.log("[HomePage] Navigating to:", targetUrl);
      navigate(targetUrl);

      // Step 4: Safety fallback — if SPA navigation is swallowed, force it
      window.setTimeout(() => {
        const current = `${window.location.pathname}${window.location.search}`;
        if (current !== targetUrl) {
          console.warn(
            "[HomePage] SPA navigate did not change URL. Forcing location:",
            targetUrl
          );
          window.location.assign(targetUrl);
        }
      }, 50);
    } catch (err) {
      console.error("Create multiplayer game failed:", err);
      showToast("error", "Failed to create a multiplayer game.");
    }
  }, [isLoggedIn, navigate, createNewGame]);

  // # Step 2: AI games are HTTP-only (/games/ai/:id)
  const navigateToAIGame = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    try {
      const newGame = await createNewGame(true);

      if (!newGame?.id) throw new Error("Create AI game: missing id");

      navigate(`/games/ai/${newGame.id}`);
    } catch (err) {
      console.error("Create AI game failed:", err);
      showToast("error", "Failed to create an AI game.");
    }
  }, [isLoggedIn, navigate, createNewGame]);

  // # Step 3: Utility actions
  const handleGoHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleComingSoon = useCallback((gameTitle) => {
    showToast("info", `${gameTitle} is coming soon.`);
  }, []);

  const games = useMemo(
    () => [
      {
        id: "ttt",
        title: "Tic-Tac-Toe",
        statusText: "Live",
        icon: CiGrid42,
        actions: [
          {
            id: "ttt-mp",
            label: "Multiplayer",
            onClick: async () => {
              await navigateToMultiplayerGame();
            },
          },
          {
            id: "ttt-ai",
            label: "Play vs AI",
            onClick: async () => {
              await navigateToAIGame();
            },
          },
        ],
      },
      {
        id: "connect4",
        title: "Connect 4",
        statusText: "Coming soon",
        icon: CiPlay1,
      },
      {
        id: "sudoku",
        title: "Sudoku",
        statusText: "Coming soon",
        icon: CiTimer,
      },
      {
        id: "checkers",
        title: "Checkers",
        statusText: "Coming soon",
        icon: CiCloudOn,
      },
    ],
    [navigateToAIGame, navigateToMultiplayerGame]
  );

  const nextUpItems = useMemo(
    () => [
      "Connect 4 — real-time matchmaking.",
      "Sudoku — clean solo mode.",
      "Checkers — classic strategy, then real-time.",
      "Social layer stays consistent across games: invites + chat + presence.",
    ],
    []
  );

  return (
    <div className="w-full px-4 pt-8 pb-24">
      <div className="mx-auto max-w-5xl">
        {/* Nexus Hero (quiet / rich) */}
        <div
          className="
            relative overflow-hidden
            rounded-2xl
            border border-slate-800/70
            bg-black/70
            backdrop-blur
            p-6 sm:p-8
            shadow-[0_0_30px_rgba(29,161,242,0.08)]
          "
        >
          {/* Subtle glow */}
          <div
            className="pointer-events-none absolute -top-56 left-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(circle, rgba(29,161,242,0.14) 0%, rgba(0,0,0,0) 70%)",
            }}
          />

          {/* Soft interior sheen */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "linear-gradient(120deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 28%, rgba(29,161,242,0.05) 62%, rgba(0,0,0,0) 100%)",
            }}
          />

          <div className="relative">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-[11px] tracking-[0.28em] uppercase text-slate-300/55">
                  hub
                </p>

                <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-wide text-slate-200/85">
                  Welcome back,{" "}
                  <span className="text-[#1DA1F2]/85">{displayName}</span>
                </h1>

                <p className="mt-2 text-sm sm:text-base text-slate-300/70"></p>
              </div>

              {/* Status + Home */}
              <div className="flex items-center gap-3">
                <div
                  className="
                    inline-flex items-center gap-2
                    rounded-xl
                    border border-slate-800/70
                    bg-slate-950/35
                    px-3 py-2
                    text-xs text-slate-300/70
                  "
                >
                  <CiUser size={18} className="text-[#1DA1F2]/75" />
                  <span>Status</span>
                  <span className="text-slate-500/70">•</span>
                  <span
                    className={[
                      "font-semibold inline-flex items-center gap-1",
                      isLoggedIn ? "text-emerald-300/85" : "text-slate-300/60",
                    ].join(" ")}
                  >
                    <CiWifiOn
                      size={18}
                      className={
                        isLoggedIn
                          ? "text-emerald-300/85"
                          : "text-slate-400/60"
                      }
                    />
                    {isLoggedIn ? "Online" : "Guest"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoHome}
                  className="
                    inline-flex items-center gap-2
                    rounded-xl
                    border border-slate-800/70
                    bg-slate-950/25
                    px-3 py-2
                    text-xs font-semibold
                    text-slate-300/70
                    hover:bg-[#1DA1F2]/08
                    hover:border-[#1DA1F2]/25
                    hover:text-[#1DA1F2]/85
                    transition
                    focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/20
                  "
                  title="Home"
                  aria-label="Go to home"
                >
                  <CiHome size={18} />
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Game Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => {
            const Icon = game.icon;
            const isLive = game.statusText === "Live";

            return (
              <div
                key={game.id}
                className="
                  group relative
                  rounded-2xl
                  border border-slate-800/70
                  bg-black/55
                  backdrop-blur
                  p-5
                  shadow-[0_0_18px_rgba(29,161,242,0.04)]
                  transition
                  hover:border-[#1DA1F2]/25
                  hover:shadow-[0_0_22px_rgba(29,161,242,0.08)]
                "
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="
                        grid h-11 w-11 place-items-center
                        rounded-xl
                        border border-slate-800/70
                        bg-slate-950/35
                        text-[#1DA1F2]/75
                        transition
                        group-hover:border-[#1DA1F2]/25
                        group-hover:bg-[#1DA1F2]/08
                        group-hover:text-[#1DA1F2]/90
                      "
                    >
                      <Icon size={26} />
                    </span>

                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-200/80 truncate">
                        {game.title}
                      </h3>

                      <p
                        className={[
                          "mt-1 text-xs tracking-wide",
                          isLive
                            ? "text-emerald-300/70"
                            : "text-slate-400/70",
                        ].join(" ")}
                      >
                        {game.statusText}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {game.actions ? (
                    game.actions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={async () => await a.onClick()}
                        className="
                          inline-flex items-center justify-center
                          rounded-xl px-3 py-2
                          text-sm font-semibold
                          border border-slate-800/70
                          bg-slate-950/35
                          text-slate-200/70
                          hover:bg-[#1DA1F2]/08
                          hover:border-[#1DA1F2]/25
                          hover:text-[#1DA1F2]/85
                          transition
                          focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/20
                        "
                      >
                        {a.label}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={async () => handleComingSoon(game.title)}
                      className="
                        inline-flex items-center justify-center
                        rounded-xl px-3 py-2
                        text-sm font-semibold
                        border border-slate-800/70
                        bg-slate-950/25
                        text-slate-300/65
                        hover:bg-slate-900/30
                        hover:text-slate-200/75
                        transition
                      "
                    >
                      Coming soon
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FooterTicker items={nextUpItems} />
    </div>
  );
};

export default HomePage;
