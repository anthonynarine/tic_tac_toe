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
        border-2 border-[#1DA1F2]/40
        rounded-lg overflow-hidden
        shadow-[0_0_24px_rgba(29,161,242,0.10)]
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
