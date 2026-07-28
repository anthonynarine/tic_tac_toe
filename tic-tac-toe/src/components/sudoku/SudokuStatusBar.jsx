import React from "react";
import { LuClock } from "react-icons/lu";

const DIFFICULTY_COLORS = {
  easy: "text-brand-emerald",
  medium: "text-brand-amber",
  hard: "text-brand-amber-600",
  expert: "text-brand-rose",
};

export default function SudokuStatusBar({ difficulty, timerFormatted, mistakes, maxMistakes = 3 }) {
  const diffColor = DIFFICULTY_COLORS[difficulty] ?? "text-text-secondary";

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
    </div>
  );
}
