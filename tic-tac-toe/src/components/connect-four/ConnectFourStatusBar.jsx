import React from "react";
import { PIECE } from "./utils/c4Logic";

const DOT = {
  [PIECE.ONE]: "bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.35)]",
  [PIECE.TWO]: "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.38)]",
};

export default function ConnectFourStatusBar({
  status,
  currentTurn,
  myPiece,
  winner,
  p1Name,
  p2Name,
  isAI,
  wsStatus,
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
    <div
      className="
        w-full mx-auto
        rounded-t-2xl border-2 border-b-0 border-brand-cyan/25
        bg-surface backdrop-blur
        px-3 pt-2.5 pb-2
        [@media(min-width:768px)_and_(max-height:700px)]:pt-1.5
        [@media(min-width:768px)_and_(max-height:700px)]:pb-1
      "
      style={{ maxWidth: "min(92vw, 640px, calc((100dvh - 465px) * 7 / 6))" }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 [@media(min-width:768px)_and_(max-height:700px)]:mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
          {isAI ? "vs AI" : "Multiplayer"}
        </span>
        {wsStatus ? (
          <span className="rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-2 py-0.5 text-[10px] text-brand-cyan">
            WS: {wsStatus === "connected" ? "LIVE" : wsStatus}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Player labels */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${DOT[PIECE.ONE]}`} />
          <span className="text-xs text-text-secondary">{p1Label}</span>
        </div>

        {/* Status */}
        <span className="text-xs font-semibold text-text-primary text-center">
          {statusText()}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">{p2Label}</span>
          <div className={`w-3 h-3 rounded-full ${DOT[PIECE.TWO]}`} />
        </div>
      </div>
    </div>
  );
}
