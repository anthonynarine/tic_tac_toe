import React from "react";
import SudokuCell from "./SudokuCell";

export default function SudokuBoard({
  board,
  selected,
  conflictSet,
  peerSet,
  selectedValue,
  onCellClick,
}) {
  return (
    <div
      className="
        grid grid-cols-9
        border-2 border-t-0 border-brand-cyan/40
        rounded-b-lg overflow-hidden
        shadow-glow-cyan
        w-full aspect-square shrink-0 mx-auto
      "
      style={{ maxWidth: "min(90vw, 620px, 58dvh)" }}
    >
      {board.map((cell, idx) => (
        <SudokuCell
          key={idx}
          cell={cell}
          idx={idx}
          isSelected={selected === idx}
          isPeer={peerSet.has(idx)}
          isConflict={conflictSet.has(idx)}
          isSameValue={selectedValue !== 0 && cell.value === selectedValue && selected !== idx}
          onClick={onCellClick}
        />
      ))}
    </div>
  );
}
