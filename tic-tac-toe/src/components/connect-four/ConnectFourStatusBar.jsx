import React from "react";
import { PIECE } from "./utils/c4Logic";

const DOT = {
  [PIECE.ONE]: "bg-[#1DA1F2] shadow-[0_0_6px_rgba(29,161,242,0.8)]",
  [PIECE.TWO]: "bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.8)]",
};

export default function ConnectFourStatusBar({
  status,
  currentTurn,
  myPiece,
  winner,
  p1Name,
  p2Name,
  isAI,
}) {
  const p1Label = p1Name || "Player 1";
  const p2Label = isAI ? "AI" : (p2Name || "Player 2");

  const statusText = () => {
    if (status === "waiting") return "Waiting for opponent…";
    if (status === "loading") return "Loading…";
    if (status === "won") {
      if (winner === myPiece) return "You won!";
      if (myPiece) return "You lost.";
      return winner === PIECE.ONE ? `${p1Label} wins!` : `${p2Label} wins!`;
    }
    if (status === "draw") return "Draw!";
    if (status === "playing") {
      if (myPiece) {
        return currentTurn === myPiece ? "Your turn" : "Opponent's turn";
      }
      return currentTurn === PIECE.ONE ? `${p1Label}'s turn` : `${p2Label}'s turn`;
    }
    return "";
  };

  return (
    <div className="w-full max-w-[min(92vw,480px)] mx-auto flex items-center justify-between px-1">
      {/* Player labels */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${DOT[PIECE.ONE]}`} />
        <span className="text-xs text-slate-300/80">{p1Label}</span>
      </div>

      {/* Status */}
      <span className="text-xs font-semibold text-slate-200/80 text-center">
        {statusText()}
      </span>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-300/80">{p2Label}</span>
        <div className={`w-3 h-3 rounded-full ${DOT[PIECE.TWO]}`} />
      </div>
    </div>
  );
}
