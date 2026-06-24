import React from "react";
import { LuClock } from "react-icons/lu";

const DIFFICULTY_COLORS = {
  easy: "text-emerald-400/80",
  medium: "text-yellow-400/80",
  hard: "text-orange-400/80",
  expert: "text-red-400/80",
};

export default function SudokuStatusBar({ difficulty, timerFormatted, mistakes, maxMistakes = 3 }) {
  const diffColor = DIFFICULTY_COLORS[difficulty] ?? "text-slate-400/70";

  return (
    <div className="flex items-center justify-between w-full max-w-[min(90vw,480px)] mx-auto px-1">
      <span className={["text-xs font-semibold uppercase tracking-widest", diffColor].join(" ")}>
        {difficulty}
      </span>

      <div className="flex items-center gap-4">
        {/* mistake pips */}
        <div className="flex items-center gap-1">
          {Array.from({ length: maxMistakes }).map((_, i) => (
            <span
              key={i}
              className={[
                "text-sm leading-none select-none",
                i < mistakes ? "text-red-400/90" : "text-slate-700/60",
              ].join(" ")}
            >
              ✕
            </span>
          ))}
        </div>

        {/* timer */}
        <div className="flex items-center gap-1 text-slate-400/70 text-sm tabular-nums">
          <LuClock size={13} />
          {timerFormatted}
        </div>
      </div>
    </div>
  );
}
