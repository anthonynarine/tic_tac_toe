// # Filename: src/home/HomePage.jsx
import React, { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CiGrid42,
  CiChat1,
  CiPen,
  CiStreamOn,
  CiCircleInfo,
  CiUser,
  CiWifiOn,
  CiHome,
} from "react-icons/ci";

import HomeFeatureCard from "./HomeFeatureCard";
import HomeGameCard from "./HomeGameCard";

// NOTE: Keep your existing import paths if they differ.
import { useUserContext } from "../../context/userContext";
import useGameCreation from "../game/hooks/useGameCreation";
import { showToast } from "../../utils/toast/Toast";

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useUserContext();
  const { createNewGame } = useGameCreation();

  // Step 0: Display name (mobile header uses this)
  const displayName = useMemo(() => {
    const first = user?.first_name?.trim();
    if (first) return first;
    const email = user?.email || "";
    if (email.includes("@")) return email.split("@")[0];
    return "Player";
  }, [user]);

  // Step 1: Harden navigation (SPA first, hard redirect fallback)
  const safeNavigate = useCallback(
    async (targetUrl) => {
      const before = `${window.location.pathname}${window.location.search}`;
      navigate(targetUrl);

      setTimeout(() => {
        const after = `${window.location.pathname}${window.location.search}`;
        if (after === before) window.location.assign(targetUrl);
      }, 0);
    },
    [navigate]
  );

  const handleComingSoon = useCallback(async (label) => {
    showToast("info", `${label} is coming soon.`);
  }, []);

  const handleCreateMultiplayer = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    try {
      const newGame = await createNewGame(false);
      if (!newGame?.id) throw new Error("Create multiplayer game: missing id");

      const qs = new URLSearchParams();
      if (newGame?.sessionKey) qs.set("sessionKey", String(newGame.sessionKey));

      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      await safeNavigate(`/lobby/${newGame.id}${suffix}`);
    } catch (err) {
      console.error("[HomePage] Create multiplayer failed:", err);
      showToast("error", "Failed to create a multiplayer game.");
    }
  }, [isLoggedIn, navigate, createNewGame, safeNavigate]);

  const handleCreateAI = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    try {
      const newGame = await createNewGame(true);
      if (!newGame?.id) throw new Error("Create AI game: missing id");
      await safeNavigate(`/games/ai/${newGame.id}`);
    } catch (err) {
      console.error("[HomePage] Create AI failed:", err);
      showToast("error", "Failed to create an AI game.");
    }
  }, [isLoggedIn, navigate, createNewGame, safeNavigate]);

  const liveGame = useMemo(
    () => ({
      id: "ttt",
      title: "Tic-Tac-Toe",
      statusText: "Live • More games coming",
      icon: CiGrid42,
      actions: [
        { id: "mp", label: "Multiplayer", onClick: handleCreateMultiplayer },
        { id: "ai", label: "Play vs AI", onClick: handleCreateAI },
      ],
    }),
    [handleCreateAI, handleCreateMultiplayer]
  );

  const features = useMemo(
    () => [
      {
        key: "tweets",
        title: "Feed / Tweets",
        description: "Short posts + reactions in a clean timeline.",
        icon: <CiStreamOn size={26} />,
        badge: "SOON",
      },
      {
        key: "groups",
        title: "Group Chats",
        description: "Rooms, presence, and real-time chat.",
        icon: <CiChat1 size={26} />,
        badge: "SOON",
      },
      {
        key: "blog",
        title: "Blog / Writing",
        description: "Long-form posts, drafts, and profiles.",
        icon: <CiPen size={26} />,
        badge: "SOON",
      },
    ],
    []
  );

  return (
    <div className="w-full px-4 pt-6 pb-24">
      <div className="mx-auto max-w-5xl">
        {/* UPDATED HEADER (mobile-friendly + welcome back) */}
        <div
          className="
            relative overflow-hidden
            rounded-3xl
            border border-slate-800/70
            bg-black/55
            backdrop-blur
            p-5 sm:p-6
            shadow-[0_0_26px_rgba(29,161,242,0.06)]
            mb-5
          "
        >
          {/* subtle top glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-[#1DA1F2]/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.28em] text-slate-400/70">
                HUB
              </div>

              <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-slate-100/90 tracking-wide">
                Welcome back,{" "}
                <span className="text-[#1DA1F2]/90">{displayName}</span>
              </h1>

              <p className="mt-2 text-sm sm:text-[15px] text-slate-400/75 max-w-2xl">
                Real-time multiplayer hub with invites, presence, and fast state sync.
                <span className="text-slate-200/70"> Tic-Tac-Toe</span> is live now —
                more games and modules are on the way.
              </p>
            </div>

            {/* HUD chips (stack on mobile, row on desktop) */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div
                className="
                  inline-flex items-center gap-2
                  rounded-2xl border border-slate-800/70 bg-black/40
                  px-3 py-2 text-xs text-slate-300/70
                "
              >
                <CiUser size={16} />
                <span>Status</span>
                <span className="mx-1 text-slate-500/60">•</span>
                <CiWifiOn size={16} />
                <span className="text-emerald-300/80">
                  {isLoggedIn ? "Online" : "Guest"}
                </span>
              </div>

              <button
                type="button"
                onClick={async () => navigate("/")}
                className="
                  inline-flex items-center gap-2
                  rounded-2xl border border-slate-800/70 bg-black/40
                  px-3 py-2 text-xs text-slate-300/70
                  hover:border-[#1DA1F2]/25 hover:bg-[#1DA1F2]/08 hover:text-[#1DA1F2]/85
                  transition
                "
              >
                <CiHome size={16} />
                Home
              </button>

              {/* <div className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-300/60 border border-slate-800/70 bg-black/40 rounded-2xl px-3 py-2">
                <CiCircleInfo size={16} />
                <span>Roadmap cards are disabled</span>
              </div> */}
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <HomeGameCard game={liveGame} onComingSoon={handleComingSoon} />
          </div>

          {features.map((f) => (
            <HomeFeatureCard
              key={f.key}
              title={f.title}
              description={f.description}
              icon={f.icon}
              badge={f.badge}
              disabled
              onClick={async () => await handleComingSoon(f.title)}
            />
          ))}
        </div>

        <div className="sm:hidden mt-4 text-xs text-slate-400/65">
          Roadmap modules are marked <span className="text-slate-200/70">SOON</span>{" "}
          and aren’t clickable yet.
        </div>
      </div>
    </div>
  );
}
