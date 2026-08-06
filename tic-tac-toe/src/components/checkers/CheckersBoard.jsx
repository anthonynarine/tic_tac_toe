import React, { useMemo, useState } from "react";

const PIECES = {
  1: { label: "A", cls: "bg-red-500 border-red-300 text-white" },
  2: { label: "B", cls: "bg-blue-500 border-blue-300 text-white" },
  3: { label: "A", king: true, cls: "bg-red-500 border-amber-300 text-white" },
  4: { label: "B", king: true, cls: "bg-blue-500 border-amber-300 text-white" },
};

function ownerOf(piece) {
  if (piece === 1 || piece === 3) return 1;
  if (piece === 2 || piece === 4) return 2;
  return null;
}

export default function CheckersBoard({
  board,
  legalMoves = [],
  myPiece,
  currentTurn,
  isGameOver,
  onMove,
}) {
  const [selected, setSelected] = useState(null);
  const cells = useMemo(() => Array.from(board || "").map(Number), [board]);
  const movesFromSelected = useMemo(
    () => legalMoves.filter((move) => Number(move.from) === Number(selected)),
    [legalMoves, selected]
  );
  const selectable = useMemo(
    () => new Set(legalMoves.map((move) => Number(move.from))),
    [legalMoves]
  );
  const targets = useMemo(
    () => new Set(movesFromSelected.map((move) => Number(move.to))),
    [movesFromSelected]
  );

  const canPlay = !isGameOver && myPiece === currentTurn;

  const handleCell = (idx) => {
    if (!canPlay) return;
    if (targets.has(idx) && selected !== null) {
      onMove(selected, idx);
      setSelected(null);
      return;
    }
    if (selectable.has(idx) && ownerOf(cells[idx]) === myPiece) {
      setSelected(idx);
      return;
    }
    setSelected(null);
  };

  return (
    <div
      className="w-full aspect-square rounded-xl overflow-hidden border border-brand-cyan/20 bg-background-app shadow-[0_18px_60px_rgba(0,0,0,0.4)] mx-auto"
      style={{ maxWidth: "min(88vw, 640px, 66dvh)" }}
    >
      <div className="grid grid-cols-8 h-full">
        {cells.map((piece, idx) => {
          const row = Math.floor(idx / 8);
          const col = idx % 8;
          const dark = (row + col) % 2 === 1;
          const isSelected = selected === idx;
          const isTarget = targets.has(idx);
          const canSelect = selectable.has(idx) && ownerOf(piece) === myPiece && canPlay;
          const meta = PIECES[piece];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCell(idx)}
              className={[
                "relative flex items-center justify-center",
                dark ? "bg-slate-800" : "bg-slate-200/80",
                canSelect ? "cursor-pointer" : "cursor-default",
                isSelected ? "ring-2 ring-brand-cyan ring-inset" : "",
              ].join(" ")}
              aria-label={`Square ${idx}`}
            >
              {isTarget ? (
                <span className="absolute h-4 w-4 rounded-full bg-brand-cyan/70 shadow-glow-cyan" />
              ) : null}
              {meta ? (
                <span
                  className={[
                    "relative h-[70%] w-[70%] rounded-full border-2 grid place-items-center",
                    "shadow-[inset_0_4px_12px_rgba(255,255,255,0.18),0_10px_24px_rgba(0,0,0,0.35)]",
                    meta.cls,
                  ].join(" ")}
                >
                  {meta.king ? (
                    <span className="text-[11px] font-black text-amber-100">K</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
