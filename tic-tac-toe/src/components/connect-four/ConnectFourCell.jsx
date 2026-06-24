import React from "react";
import { PIECE } from "./utils/c4Logic";

const PIECE_COLORS = {
  [PIECE.ONE]: "bg-[#1DA1F2] shadow-[0_0_10px_rgba(29,161,242,0.6)]",
  [PIECE.TWO]: "bg-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.6)]",
};

const HOVER_COLORS = {
  [PIECE.ONE]: "bg-[#1DA1F2]/30",
  [PIECE.TWO]: "bg-[#EF4444]/30",
};

export default function ConnectFourCell({ piece, isWinCell, isHovered, hoverPiece, isLastDrop }) {
  const filled = piece !== PIECE.NONE;

  const pieceClass = filled
    ? [
        "w-full h-full rounded-full transition-all duration-200",
        PIECE_COLORS[piece] ?? "bg-slate-600",
        isWinCell ? "scale-110 brightness-125 animate-pulse" : "",
        isLastDrop ? "animate-[dropIn_0.25s_ease-out]" : "",
      ].join(" ")
    : isHovered && hoverPiece
    ? `w-full h-full rounded-full ${HOVER_COLORS[hoverPiece] ?? ""} transition-all duration-100`
    : null;

  return (
    <div className="p-[3px] sm:p-[4px]">
      <div className="w-full aspect-square rounded-full bg-slate-950/80 border border-slate-700/30 overflow-hidden flex items-center justify-center">
        {pieceClass && <div className={pieceClass} />}
      </div>
    </div>
  );
}
