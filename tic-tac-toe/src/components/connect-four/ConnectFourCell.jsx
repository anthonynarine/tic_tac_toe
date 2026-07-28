import React from "react";
import { PIECE } from "./utils/c4Logic";

const PIECE_COLORS = {
  [PIECE.ONE]: "bg-blue-500 shadow-[0_0_36px_rgba(59,130,246,0.24)]",
  [PIECE.TWO]: "bg-red-500 shadow-[0_0_36px_rgba(239,68,68,0.26)]",
};

const HOVER_COLORS = {
  [PIECE.ONE]: "bg-blue-500/30",
  [PIECE.TWO]: "bg-red-500/30",
};

export default function ConnectFourCell({ piece, isWinCell, isHovered, hoverPiece, isLastDrop }) {
  const filled = piece !== PIECE.NONE;

  const pieceClass = filled
    ? [
        "w-full h-full rounded-full transition-all duration-200",
        PIECE_COLORS[piece] ?? "bg-text-faint",
        isWinCell ? "scale-110 brightness-125 animate-pulse" : "",
        isLastDrop ? "animate-[dropIn_0.25s_ease-out]" : "",
      ].join(" ")
    : isHovered && hoverPiece
    ? `w-full h-full rounded-full ${HOVER_COLORS[hoverPiece] ?? ""} transition-all duration-100`
    : null;

  return (
    <div className="p-[3px] sm:p-[4px]">
      <div className="w-full aspect-square rounded-full bg-background-app border border-border-soft overflow-hidden flex items-center justify-center">
        {pieceClass && <div className={pieceClass} />}
      </div>
    </div>
  );
}
