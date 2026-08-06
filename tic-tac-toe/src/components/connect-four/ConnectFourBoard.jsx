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
        rounded-b-2xl border-2 border-t-0 border-brand-cyan/25
        bg-surface backdrop-blur
        p-2 sm:p-3
        shadow-glow-cyan
        w-full shrink-0 mx-auto select-none
      "
      style={{ maxWidth: "min(92vw, 640px, calc((100dvh - 465px) * 7 / 6))" }}
    >
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
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

        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {Array.from({ length: COLS }, (_, col) => (
            <button
              key={`col-${col}`}
              type="button"
              disabled={!canInteract}
              aria-label={`Drop piece in column ${col + 1}`}
              onClick={() => canInteract && onColumnClick(col)}
              onMouseEnter={() => setHoveredCol(col)}
              onMouseLeave={() => setHoveredCol(null)}
              className="
                relative h-full min-h-full rounded-md
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70
                cursor-pointer disabled:cursor-default
              "
            >
              {canInteract && hoveredCol === col && (
                <span
                  className="absolute left-1/2 top-1 -translate-x-1/2 w-3 h-3 rounded-full"
                  style={{
                    background: myPiece === PIECE.ONE ? "#3B82F6" : "#EF4444",
                    opacity: 0.7,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
