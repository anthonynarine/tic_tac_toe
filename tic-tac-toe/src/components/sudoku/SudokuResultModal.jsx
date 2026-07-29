import React from "react";
import { useNavigate } from "react-router-dom";
import { LuTrophy } from "react-icons/lu";
import { AiFillHome } from "react-icons/ai";

export default function SudokuResultModal({ status, timerFormatted, onPlayAgain }) {
  const navigate = useNavigate();
  const won = status === "won";

  if (status !== "won" && status !== "failed") return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-3 bg-black/75 backdrop-blur-md">
      <div
        className="
          w-full max-w-[min(90vw,360px)] rounded-lg p-5 text-center sm:rounded-card sm:p-8
          bg-background-app-panel border border-border-soft
          shadow-glow-cyan
          animate-[fadeInScale_0.4s_ease-out]
        "
      >
        <div className="flex justify-center mb-3 sm:mb-4">
          {won ? (
            <LuTrophy size={34} className="text-brand-cyan sm:size-[42px]" />
          ) : (
            <span className="text-5xl text-brand-rose leading-none select-none">✕</span>
          )}
        </div>

        <h2 className="text-xl font-bold text-text-primary mb-1 sm:text-2xl">
          {won ? "Puzzle Solved!" : "Game Over"}
        </h2>

        {won && (
          <p className="text-text-secondary text-sm mb-4 sm:mb-6">
            Completed in <span className="text-brand-cyan font-semibold">{timerFormatted}</span>
          </p>
        )}
        {!won && (
          <p className="text-text-secondary text-sm mb-4 sm:mb-6">Too many mistakes. Better luck next time!</p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="
              px-3 py-2.5 rounded-button text-sm font-semibold sm:px-5
              border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan
              hover:bg-brand-cyan/20 transition focus:outline-none
            "
          >
            New Puzzle
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="
              flex items-center justify-center gap-2 px-3 py-2.5 rounded-button text-sm font-semibold sm:px-5
              border border-border-soft bg-surface text-text-secondary
              hover:bg-surface-elevated hover:text-text-primary transition focus:outline-none
            "
          >
            <AiFillHome size={14} />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
