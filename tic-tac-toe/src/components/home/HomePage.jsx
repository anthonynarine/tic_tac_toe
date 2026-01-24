// # Filename: src/components/home/HomePage.jsx
// ✅ New Code

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast/Toast";
import { useUserContext } from "../context/userContext";
import useGameCreation from "../hooks/game/useGameCreation";

import {
  CiGrid42,
  CiPlay1,
  CiCloudOn,
  CiLock,
  CiTimer,
} from "react-icons/ci";

const HomePage = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useUserContext();
  const { createNewGame } = useGameCreation();

  // Step 1: Define your “hub catalog” (future-ready)
  const games = useMemo(
    () => [
      {
        id: "ttt",
        title: "Tic-Tac-Toe",
        subtitle: "Fast, real-time multiplayer with AI mode.",
        transport: "WebSocket",
        status: "LIVE",
        icon: CiGrid42,
        actions: [
          {
            id: "ttt-mp",
            label: "Multiplayer",
            enabled: true,
            onClick: async () => {
              // # Step 1: Auth gate
              if (!isLoggedIn) {
                navigate("/login");
                return;
              }

              // # Step 2: Create multiplayer game -> lobby route
              try {
                const newGame = await createNewGame(false);
                if (newGame?.id) navigate(`/lobby/${newGame.id}`);
              } catch (err) {
                console.error("Create multiplayer game failed:", err);
                showToast("error", "Failed to create a multiplayer game.");
              }
            },
          },
          {
            id: "ttt-ai",
            label: "Play vs AI",
            enabled: true,
            onClick: async () => {
              if (!isLoggedIn) {
                navigate("/login");
                return;
              }

              try {
                const newGame = await createNewGame(true);
                if (newGame?.id) navigate(`/games/${newGame.id}`);
              } catch (err) {
                console.error("Create AI game failed:", err);
                showToast("error", "Failed to create an AI game.");
              }
            },
          },
        ],
      },
      {
        id: "connect4",
        title: "Connect 4",
        subtitle: "Bigger board. Same real-time energy.",
        transport: "WebSocket",
        status: "COMING_SOON",
        icon: CiPlay1,
      },
      {
        id: "sudoku",
        title: "Sudoku",
        subtitle: "Solo puzzle mode (HTTP-only).",
        transport: "HTTP",
        status: "COMING_SOON",
        icon: CiTimer,
      },
      {
        id: "checkers",
        title: "Checkers",
        subtitle: "Classic turn strategy (HTTP first, WS later).",
        transport: "HTTP",
        status: "COMING_SOON",
        icon: CiCloudOn,
      },
    ],
    [createNewGame, isLoggedIn, navigate]
  );

  const handleComingSoon = (gameTitle) => {
    showToast("info", `${gameTitle} is coming soon.`);
  };

  return (
    <div className="w-full px-4 pt-8 pb-14">
      {/* Hero / Identity */}
      <div className="mx-auto max-w-5xl">
        <div
          className="
            relative overflow-hidden
            rounded-2xl
            border border-[#1DA1F2]/20
            bg-black/70
            shadow-[0_0_30px_rgba(29,161,242,0.10)]
            backdrop-blur
            p-6 sm:p-8
          "
        >
          {/* subtle radial glow */}
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(29,161,242,0.18) 0%, rgba(0,0,0,0) 70%)",
            }}
          />

          <div className="relative">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-[#1DA1F2] drop-shadow">
                  GameHub
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-200/80 max-w-xl">
                  A minimal real-time platform. Tic-Tac-Toe is live now — more games
                  are queued behind the reactor.
                </p>
              </div>

              {!isLoggedIn ? (
                <button
                  type="button"
                  onClick={async () => navigate("/login")}
                  className="
                    inline-flex items-center gap-2
                    rounded-xl px-4 py-2
                    border border-[#1DA1F2]/30
                    bg-[#1DA1F2]/10
                    text-[#1DA1F2] font-semibold
                    hover:bg-[#1DA1F2]/15
                    transition
                  "
                >
                  <CiLock size={20} />
                  Login to Play
                </button>
              ) : (
                <div className="text-xs text-slate-200/70">
                  Status:{" "}
                  <span className="text-[#1DA1F2] font-semibold">Online</span>
                </div>
              )}
            </div>

            {/* Platform chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#1DA1F2]/25 bg-[#1DA1F2]/10 px-3 py-1 text-xs text-[#1DA1F2]">
                WebSockets • Multiplayer
              </span>
              <span className="rounded-full border border-[#1DA1F2]/25 bg-[#1DA1F2]/10 px-3 py-1 text-xs text-[#1DA1F2]">
                HTTP • Puzzle modes
              </span>
              <span className="rounded-full border border-slate-500/25 bg-white/5 px-3 py-1 text-xs text-slate-200/80">
                More games soon
              </span>
            </div>
          </div>
        </div>

        {/* Game Catalog */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => {
            const Icon = game.icon;

            const isLive = game.status === "LIVE";
            const isWs = game.transport === "WebSocket";

            return (
              <div
                key={game.id}
                className="
                  group relative
                  rounded-2xl
                  border border-[#1DA1F2]/15
                  bg-black/60
                  backdrop-blur
                  p-5
                  shadow-[0_0_18px_rgba(29,161,242,0.06)]
                "
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="
                          grid h-10 w-10 place-items-center
                          rounded-xl
                          border border-[#1DA1F2]/20
                          bg-[#1DA1F2]/8
                          text-[#1DA1F2]
                        "
                      >
                        <Icon size={24} />
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-slate-100 truncate">
                            {game.title}
                          </h3>

                          <span
                            className={[
                              "text-[11px] px-2 py-[2px] rounded-full border",
                              isWs
                                ? "border-[#1DA1F2]/30 text-[#1DA1F2] bg-[#1DA1F2]/10"
                                : "border-slate-500/25 text-slate-200/80 bg-white/5",
                            ].join(" ")}
                            title={game.transport}
                          >
                            {game.transport}
                          </span>

                          <span
                            className={[
                              "text-[11px] px-2 py-[2px] rounded-full border",
                              isLive
                                ? "border-emerald-400/30 text-emerald-300 bg-emerald-500/10"
                                : "border-slate-500/25 text-slate-200/70 bg-white/5",
                            ].join(" ")}
                          >
                            {isLive ? "LIVE" : "COMING SOON"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-200/70">
                          {game.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {isLive ? (
                    game.actions?.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={async () => await a.onClick()}
                        className="
                          inline-flex items-center justify-center
                          rounded-xl px-3 py-2
                          text-sm font-semibold
                          border border-[#1DA1F2]/25
                          bg-[#1DA1F2]/10
                          text-[#1DA1F2]
                          hover:bg-[#1DA1F2]/15
                          transition
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
                        inline-flex items-center justify-center gap-2
                        rounded-xl px-3 py-2
                        text-sm font-semibold
                        border border-slate-500/25
                        bg-white/5
                        text-slate-200/80
                        hover:bg-white/10
                        transition
                      "
                    >
                      Coming soon
                    </button>
                  )}
                </div>

                {/* Subtle bottom accent line */}
                <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-[#1DA1F2]/25 to-transparent" />
              </div>
            );
          })}
        </div>

        {/* Optional: “What’s next” mini section */}
        <div className="mt-6 rounded-2xl border border-[#1DA1F2]/15 bg-black/55 p-5 backdrop-blur">
          <div className="text-sm text-slate-200/75">
            <span className="text-[#1DA1F2] font-semibold">Next up:</span>{" "}
            Connect 4 (WebSocket), Sudoku (HTTP), then a shared “game engine” layer so
            new games plug in cleanly.
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
