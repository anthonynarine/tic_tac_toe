import React from "react";
import { LuEraser, LuPencil } from "react-icons/lu";

export default function SudokuControls({ notesMode, onNumber, onErase, onToggleNotes }) {
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[min(90vw,480px)] mx-auto">
      {/* Number pad */}
      <div className="grid grid-cols-9 gap-1 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onNumber(n)}
            className="
              aspect-square flex items-center justify-center
              rounded-lg
              border border-border-soft
              bg-surface
              text-text-secondary text-sm sm:text-base font-semibold
              hover:bg-brand-cyan/12 hover:border-brand-cyan/30 hover:text-brand-cyan
              transition
              focus:outline-none
            "
          >
            {n}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onErase}
          className="
            flex items-center gap-2 px-4 py-2 rounded-xl
            border border-border-soft bg-surface
            text-text-secondary text-sm
            hover:bg-surface-elevated hover:text-text-primary
            transition focus:outline-none
          "
        >
          <LuEraser size={15} />
          Erase
        </button>

        <button
          type="button"
          onClick={onToggleNotes}
          className={[
            "flex items-center gap-2 px-4 py-2 rounded-xl",
            "border text-sm transition focus:outline-none",
            notesMode
              ? "border-brand-cyan/40 bg-brand-cyan/12 text-brand-cyan"
              : "border-border-soft bg-surface text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
          ].join(" ")}
        >
          <LuPencil size={15} />
          Notes {notesMode ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
