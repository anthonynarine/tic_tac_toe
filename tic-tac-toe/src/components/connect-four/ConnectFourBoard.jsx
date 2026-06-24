import React, { useState } from "react";
import { ROWS, COLS, PIECE } from "./utils/c4Logic";
import ConnectFourCell from "./ConnectFourCell";

export default function ConnectFourBoard({
  board,
  winCells,
  myPiece,
  currentTurn,
  isGameOver,
  isDisabled,
  lastDrop,
  onColumnClick,
}) {
  const [hoveredCol, setHoveredCol] = useState(null);

  if (!board) return null;

  const winSet = new Set(
    (winCells ?? []).map(([r, c]) => r * COLS + c)
  );

  const canInteract = !isDisabled && !isGameOver && currentTurn === myPiece;

  return (
    <div
      className="
        rounded-2xl border-2 border-[#1DA1F2]/25
        bg-slate-900/60 backdrop-blur
        p-2 sm:p-3
        shadow-[0_0_30px_rgba(29,161,242,0.08)]
        w-full max-w-[min(92vw,480px)]
        mx-auto select-none
      "
    >
      <div className="grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {/* Column click zones (top row hover handles) */}
        {Array.from({ length: COLS }, (_, col) => (
          <button
            key={`col-${col}`}
            type="button"
            disabled={!canInteract}
            onClick={() => canInteract && onColumnClick(col)}
            onMouseEnter={() => setHoveredCol(col)}
            onMouseLeave={() => setHoveredCol(null)}
            className="
              h-5 sm:h-6 flex items-center justify-center
              focus:outline-none cursor-pointer disabled:cursor-default
            "
          >
            {canInteract && hoveredCol === col && (
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: myPiece === PIECE.ONE ? "#1DA1F2" : "#EF4444",
                  opacity: 0.7,
                }}
              />
            )}
          </button>
        ))}

        {/* Cells */}
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const idx = row * COLS + col;
            return (
              <ConnectFourCell
                key={idx}
                piece={board[idx] ?? PIECE.NONE}
                isWinCell={winSet.has(idx)}
                isHovered={hoveredCol === col && row === 0 && board[idx] === PIECE.NONE}
                hoverPiece={myPiece}
                isLastDrop={lastDrop?.row === row && lastDrop?.col === col}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
