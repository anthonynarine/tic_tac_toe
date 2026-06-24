import { useCallback, useRef } from "react";
import { sudokuApi } from "../../../api/sudokuApi";

export function useSudokuSession(sessionId) {
  const timerRef = useRef(null);

  const save = useCallback(
    (board, notes, elapsed, mistakes, completed = false) => {
      if (!sessionId) return;

      const current_board = board.map((c) => c.value);
      const notesPayload = {};
      board.forEach((c, i) => {
        if (c.notes.size > 0) notesPayload[String(i)] = [...c.notes];
      });

      const payload = {
        current_board,
        notes: notesPayload,
        elapsed_seconds: elapsed,
        mistakes,
        completed,
        ...(completed ? { completed_at: new Date().toISOString() } : {}),
      };

      sudokuApi.saveSession(sessionId, payload).catch(() => {});
    },
    [sessionId]
  );

  const scheduleSave = useCallback(
    (board, notes, elapsed, mistakes, completed = false) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (completed) {
        save(board, notes, elapsed, mistakes, true);
        return;
      }
      timerRef.current = setTimeout(() => save(board, notes, elapsed, mistakes, false), 2000);
    },
    [save]
  );

  return { scheduleSave };
}
