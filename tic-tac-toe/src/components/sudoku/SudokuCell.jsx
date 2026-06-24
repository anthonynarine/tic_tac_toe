import React from "react";

export default function SudokuCell({
  cell,
  idx,
  isSelected,
  isPeer,
  isConflict,
  isSameValue,
  onClick,
}) {
  const { value, isGiven, notes } = cell;

  const borderClasses = (() => {
    const row = Math.floor(idx / 9);
    const col = idx % 9;
    const parts = [];
    if (col % 3 === 0 && col !== 0) parts.push("border-l-2 border-l-[#1DA1F2]/40");
    if (row % 3 === 0 && row !== 0) parts.push("border-t-2 border-t-[#1DA1F2]/40");
    return parts.join(" ");
  })();

  const bgClass = isSelected
    ? "bg-[#1DA1F2]/20"
    : isConflict
    ? "bg-red-500/20"
    : isSameValue && value !== 0
    ? "bg-[#1DA1F2]/10"
    : isPeer
    ? "bg-slate-800/40"
    : "bg-transparent";

  const textClass = isGiven
    ? "text-slate-100/90 font-semibold"
    : isConflict
    ? "text-red-400"
    : "text-[#1DA1F2]/90";

  return (
    <button
      type="button"
      onClick={() => onClick(idx)}
      className={[
        "relative flex items-center justify-center",
        "w-full aspect-square",
        "border border-slate-700/40",
        "transition-colors duration-100 cursor-pointer select-none",
        "focus:outline-none",
        bgClass,
        borderClasses,
      ].join(" ")}
    >
      {value !== 0 ? (
        <span className={["text-base sm:text-lg leading-none", textClass].join(" ")}>
          {value}
        </span>
      ) : notes.size > 0 ? (
        <span className="grid grid-cols-3 gap-0 w-full h-full p-[1px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <span
              key={n}
              className={[
                "flex items-center justify-center text-[7px] sm:text-[8px] leading-none",
                notes.has(n) ? "text-slate-400/80" : "text-transparent",
              ].join(" ")}
            >
              {n}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}
