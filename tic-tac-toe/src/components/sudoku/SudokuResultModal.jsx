import React from "react";
import { useNavigate } from "react-router-dom";
import { LuTrophy } from "react-icons/lu";
import { AiFillHome } from "react-icons/ai";

export default function SudokuResultModal({ status, timerFormatted, onPlayAgain }) {
  const navigate = useNavigate();
  const won = status === "won";

  if (status !== "won" && status !== "failed") return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 bg-black/75 backdrop-blur-md">
      <div
        className="
          w-[360px] max-w-[90%] rounded-[20px] p-8 text-center
          bg-[#0e1117] border border-slate-700/50
          shadow-[0_0_40px_rgba(29,161,242,0.12)]
          animate-[fadeInScale_0.4s_ease-out]
        "
      >
        <div className="flex justify-center mb-4">
          {won ? (
            <LuTrophy size={42} className="text-[#1DA1F2]/80" />
          ) : (
            <span className="text-5xl text-red-400/80 leading-none select-none">✕</span>
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-100/90 mb-1">
          {won ? "Puzzle Solved!" : "Game Over"}
        </h2>

        {won && (
          <p className="text-slate-400/70 text-sm mb-6">
            Completed in <span className="text-[#1DA1F2]/80 font-semibold">{timerFormatted}</span>
          </p>
        )}
        {!won && (
          <p className="text-slate-400/70 text-sm mb-6">Too many mistakes. Better luck next time!</p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="
              px-5 py-2.5 rounded-xl text-sm font-semibold
              border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 text-[#1DA1F2]/90
              hover:bg-[#1DA1F2]/20 transition focus:outline-none
            "
          >
            New Puzzle
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="
              flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              border border-slate-700/50 bg-slate-900/60 text-slate-300/80
              hover:bg-slate-800/60 hover:text-slate-100/90 transition focus:outline-none
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
