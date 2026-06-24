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
              border border-slate-700/50
              bg-slate-900/60
              text-slate-200/80 text-sm sm:text-base font-semibold
              hover:bg-[#1DA1F2]/12 hover:border-[#1DA1F2]/30 hover:text-[#1DA1F2]/90
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
            border border-slate-700/50 bg-slate-900/60
            text-slate-300/80 text-sm
            hover:bg-slate-800/60 hover:text-slate-100/90
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
              ? "border-[#1DA1F2]/40 bg-[#1DA1F2]/12 text-[#1DA1F2]/90"
              : "border-slate-700/50 bg-slate-900/60 text-slate-300/80 hover:bg-slate-800/60 hover:text-slate-100/90",
          ].join(" ")}
        >
          <LuPencil size={15} />
          Notes {notesMode ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
