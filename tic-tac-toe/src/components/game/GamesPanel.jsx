// # Filename: src/components/game/GamesPanel.jsx
import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CiGrid42, CiBoxes } from "react-icons/ci";

import { connectFourApi } from "../../api/connectFourApi";
import { showToast } from "../../utils/toast/Toast";

export default function GamesPanel({ isLoggedIn, onStartMultiplayer, onStartAI, onGoHome }) {
  const navigate = useNavigate();

  const handleC4AI = useCallback(() => {
    if (!isLoggedIn) { navigate("/login"); return; }
    navigate("/games/connect-four/ai");
  }, [isLoggedIn, navigate]);

  const handleC4MP = useCallback(async () => {
    if (!isLoggedIn) { navigate("/login"); return; }
    try {
      const game = await connectFourApi.createGame(false);
      navigate(`/games/connect-four/${game.id}`);
    } catch {
      showToast("error", "Could not create game.");
    }
  }, [isLoggedIn, navigate]);

  const handleSudoku = useCallback(() => {
    if (!isLoggedIn) { navigate("/login"); return; }
    navigate("/games/sudoku");
  }, [isLoggedIn, navigate]);

  const GAMES = [
    {
      id: "ttt",
      name: "Tic-Tac-Toe",
      Icon: CiGrid42,
      actions: [
        { label: "Multiplayer", onClick: onStartMultiplayer },
        { label: "vs AI",       onClick: onStartAI },
      ],
    },
    {
      id: "connect-four",
      name: "Connect Four",
      Icon: CiBoxes,
      actions: [
        { label: "vs AI",     onClick: handleC4AI },
        { label: "vs Friend", onClick: handleC4MP },
      ],
    },
    {
      id: "sudoku",
      name: "Sudoku",
      Icon: CiBoxes,
      actions: [
        { label: "Play", onClick: handleSudoku },
      ],
    },
  ];

  return (
    <section className="w-full">
      {/* Section label */}
      <p className="text-[10px] tracking-[0.28em] uppercase font-semibold text-text-faint mb-3">
        Games
      </p>

      <div className="space-y-1.5">
        {GAMES.map(({ id, name, Icon, actions }) => (
          <div key={id} className="rounded-xl p-3 bg-surface border border-border-soft">
            {/* Game name row */}
            <div className="flex items-center gap-2 mb-2.5">
              <Icon size={15} className="text-brand-cyan/70" />
              <span className="text-xs font-semibold text-text-secondary">{name}</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5">
              {actions.map(({ label, onClick }, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity duration-150 hover:opacity-80 focus:outline-none border ${
                    i === 0
                      ? "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20"
                      : "bg-surface-elevated text-text-muted border-border-soft"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGoHome}
        className="w-full mt-3 py-2 rounded-xl text-xs text-text-faint hover:text-text-secondary transition-colors border border-border-soft"
      >
        ← Back to hub
      </button>
    </section>
  );
}
