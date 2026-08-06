import React from "react";
import { LuClock } from "react-icons/lu";

export default function SudokuStatusBar({ timerFormatted, mistakes, maxMistakes = 3 }) {
  return (
    <div className="flex items-center gap-4 w-full">
      {/* mistake pips */}
      <div className="flex items-center gap-1">
        {Array.from({ length: maxMistakes }).map((_, i) => (
          <span
            key={i}
            className={[
              "text-sm leading-none select-none",
              i < mistakes ? "text-brand-rose" : "text-text-faint",
            ].join(" ")}
          >
            ✕
          </span>
        ))}
      </div>

      {/* timer */}
      <div className="flex items-center gap-1 text-text-secondary text-sm tabular-nums">
        <LuClock size={13} />
        {timerFormatted}
      </div>
    </div>
  );
}
