import React from "react";
import { AiFillHome } from "react-icons/ai";
import { LuRefreshCcw } from "react-icons/lu";
import { useNavigate } from "react-router-dom";

export default function CheckersResult({ isCompleted, winner, myPiece, onPlayAgain }) {
  const navigate = useNavigate();
  if (!isCompleted) return null;

  const text = winner === myPiece ? "You win" : winner ? "You lose" : "Draw";

  return (
    <div className="w-full rounded-xl border border-brand-cyan/20 bg-surface p-3 text-center">
      <div className="text-sm font-semibold text-text-primary">{text}</div>
      <div className="mt-3 flex justify-center gap-2">
        {onPlayAgain ? (
          <button
            type="button"
            onClick={onPlayAgain}
            className="h-9 w-9 grid place-items-center rounded-lg border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan"
            aria-label="Play again"
            title="Play again"
          >
            <LuRefreshCcw size={16} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="h-9 w-9 grid place-items-center rounded-lg border border-border-soft bg-background-app-panel text-text-secondary"
          aria-label="Home"
          title="Home"
        >
          <AiFillHome size={16} />
        </button>
      </div>
    </div>
  );
}
