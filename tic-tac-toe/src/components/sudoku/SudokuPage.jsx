import React, { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { sudokuApi } from "../../api/sudokuApi";
import { useSudokuGame } from "./hooks/useSudokuGame";
import { useSudokuTimer } from "./hooks/useSudokuTimer";
import { useSudokuSession } from "./hooks/useSudokuSession";

import SudokuBoard from "./SudokuBoard";
import SudokuControls from "./SudokuControls";
import SudokuStatusBar from "./SudokuStatusBar";
import SudokuResultModal from "./SudokuResultModal";

const DIFFICULTIES = ["easy", "medium", "hard", "expert"];

export default function SudokuPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");

  const { state, dispatch, conflictSet, peerSet, selectedValue } = useSudokuGame();
  const isRunning = state.status === "playing";

  const { elapsed, formatted: timerFormatted } = useSudokuTimer(
    state.savedElapsed ?? 0,
    isRunning
  );

  const { scheduleSave } = useSudokuSession(state.sessionId);

  const startNewGame = useCallback(
    async (diff = difficulty) => {
      setLoading(true);
      setError(null);
      try {
        const sessionData = await sudokuApi.newPuzzle(diff);
        dispatch({ type: "LOAD", sessionData });
      } catch {
        setError("Failed to load puzzle. Check your connection.");
      } finally {
        setLoading(false);
      }
    },
    [difficulty, dispatch]
  );

  useEffect(() => {
    startNewGame(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on board change
  useEffect(() => {
    if (state.status === "idle" || !state.sessionId) return;
    const completed = state.status === "won";
    scheduleSave(state.board, {}, elapsed, state.mistakes, completed);
  }, [state.board, state.mistakes, state.status, elapsed, scheduleSave, state.sessionId]);

  const handleCellClick = useCallback(
    (idx) => dispatch({ type: "SELECT", idx }),
    [dispatch]
  );

  const handleNumber = useCallback(
    (num) => {
      if (state.selected === null) return;
      dispatch({ type: "ENTER", idx: state.selected, num });
    },
    [state.selected, dispatch]
  );

  const handleErase = useCallback(
    () => dispatch({ type: "ERASE", idx: state.selected }),
    [state.selected, dispatch]
  );

  const handleToggleNotes = useCallback(
    () => dispatch({ type: "TOGGLE_NOTES" }),
    [dispatch]
  );

  const handleDifficultyChange = useCallback(
    (diff) => {
      setDifficulty(diff);
      startNewGame(diff);
    },
    [startNewGame]
  );

  const handlePlayAgain = useCallback(
    () => startNewGame(difficulty),
    [startNewGame, difficulty]
  );

  // Keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "1" && e.key <= "9") handleNumber(parseInt(e.key, 10));
      else if (e.key === "Backspace" || e.key === "Delete") handleErase();
      else if (e.key === "n" || e.key === "N") dispatch({ type: "TOGGLE_NOTES" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNumber, handleErase, dispatch]);

  const currentDifficulty = state.sessionId
    ? state.board.length > 0
      ? difficulty
      : "medium"
    : difficulty;

  return (
    <div className="w-full px-4 pt-6 pb-24">
      <div className="mx-auto max-w-lg flex flex-col items-center gap-5">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[0.28em] text-slate-400/70 uppercase">
              Puzzle
            </div>
            <h1 className="text-2xl font-semibold text-slate-100/90 tracking-wide">Sudoku</h1>
          </div>

          {/* Difficulty picker */}
          <div className="flex gap-1">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDifficultyChange(d)}
                disabled={loading}
                className={[
                  "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition focus:outline-none",
                  difficulty === d
                    ? "border border-[#1DA1F2]/40 bg-[#1DA1F2]/12 text-[#1DA1F2]/90"
                    : "border border-slate-700/50 bg-transparent text-slate-400/70 hover:text-slate-200/80",
                ].join(" ")}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        {state.board.length > 0 && (
          <SudokuStatusBar
            difficulty={currentDifficulty}
            timerFormatted={timerFormatted}
            mistakes={state.mistakes}
          />
        )}

        {/* Loading / error states */}
        {loading && (
          <div className="text-slate-400/70 text-sm py-8">Generating puzzle…</div>
        )}
        {error && !loading && (
          <div className="text-red-400/80 text-sm py-4">{error}</div>
        )}

        {/* Board */}
        {!loading && state.board.length > 0 && (
          <>
            <SudokuBoard
              board={state.board}
              selected={state.selected}
              conflictSet={conflictSet}
              peerSet={peerSet}
              selectedValue={selectedValue}
              onCellClick={handleCellClick}
            />

            <SudokuControls
              notesMode={state.notesMode}
              onNumber={handleNumber}
              onErase={handleErase}
              onToggleNotes={handleToggleNotes}
            />
          </>
        )}

        {/* New game button */}
        {!loading && state.board.length > 0 && state.status === "playing" && (
          <button
            type="button"
            onClick={handlePlayAgain}
            className="
              text-xs text-slate-500/70 hover:text-slate-300/80
              underline underline-offset-2 transition
            "
          >
            New puzzle
          </button>
        )}
      </div>

      {/* Result modal */}
      <SudokuResultModal
        status={state.status}
        timerFormatted={timerFormatted}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  );
}
