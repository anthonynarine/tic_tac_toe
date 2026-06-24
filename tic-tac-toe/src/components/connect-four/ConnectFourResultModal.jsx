import React from "react";
import { useNavigate } from "react-router-dom";
import { LuTrophy } from "react-icons/lu";
import { AiFillHome } from "react-icons/ai";
import { PIECE } from "./utils/c4Logic";

export default function ConnectFourResultModal({
  status,
  winner,
  myPiece,
  p1Name,
  p2Name,
  isAI,
  onPlayAgain,
}) {
  const navigate = useNavigate();

  if (status !== "won" && status !== "draw") return null;

  const isDraw = status === "draw";
  const iWon = !isDraw && winner === myPiece;

  const headline = isDraw
    ? "It's a Draw!"
    : iWon
    ? "You Win!"
    : myPiece
    ? "You Lose"
    : winner === PIECE.ONE
    ? `${p1Name || "Player 1"} Wins!`
    : `${isAI ? "AI" : (p2Name || "Player 2")} Wins!`;

  const iconColor = isDraw
    ? "text-slate-400/70"
    : iWon
    ? "text-[#1DA1F2]/80"
    : "text-[#EF4444]/80";

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 bg-black/75 backdrop-blur-md">
      <div className="
        w-[360px] max-w-[90%] rounded-[20px] p-8 text-center
        bg-[#0e1117] border border-slate-700/50
        shadow-[0_0_40px_rgba(29,161,242,0.12)]
      ">
        <div className="flex justify-center mb-4">
          {isDraw ? (
            <span className="text-5xl leading-none">🤝</span>
          ) : (
            <LuTrophy size={44} className={iconColor} />
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-100/90 mb-5">{headline}</h2>

        <div className="flex flex-wrap justify-center gap-3">
          {onPlayAgain && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="
                px-5 py-2.5 rounded-xl text-sm font-semibold
                border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 text-[#1DA1F2]/90
                hover:bg-[#1DA1F2]/20 transition focus:outline-none
              "
            >
              Play Again
            </button>
          )}
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
