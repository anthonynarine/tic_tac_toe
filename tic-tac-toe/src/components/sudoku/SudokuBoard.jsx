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
        border-2 border-brand-cyan/40
        rounded-lg overflow-hidden
        shadow-glow-cyan
        w-full max-w-[min(90vw,480px)]
        mx-auto
      "
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
