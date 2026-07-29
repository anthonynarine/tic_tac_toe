import React, { useEffect, useCallback, useState } from "react";

import { sudokuApi } from "../../api/sudokuApi";
import { statsApi } from "../../api/statsApi";
import { formatSeconds } from "../leaderboard/formatSeconds";
import { useSudokuGame } from "./hooks/useSudokuGame";
import { useSudokuTimer } from "./hooks/useSudokuTimer";
import { useSudokuSession } from "./hooks/useSudokuSession";

import SudokuBoard from "./SudokuBoard";
import SudokuControls from "./SudokuControls";
import SudokuStatusBar from "./SudokuStatusBar";
import SudokuResultModal from "./SudokuResultModal";

const DIFFICULTIES = ["easy", "medium", "hard", "expert"];

export default function SudokuPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");

  const { state, dispatch, conflictSet, peerSet, selectedValue } = useSudokuGame();
  const isRunning = state.status === "playing";

  const [myBests, setMyBests] = useState({});
  const refreshMyBests = useCallback(() => {
    statsApi.getMySudokuBests().then(setMyBests).catch(() => {});
  }, []);
  useEffect(() => { refreshMyBests(); }, [refreshMyBests]);
  useEffect(() => {
    if (state.status === "won") refreshMyBests();
  }, [state.status, refreshMyBests]);

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
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 md:pt-10 pb-20 sm:pb-24">
      <div
        className="mx-auto max-w-lg flex flex-col items-center gap-3 sm:gap-5"
        style={{ minHeight: "clamp(520px, calc(100dvh - 180px), 710px)" }}
      >
        {/* Header */}
        <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="hidden text-[11px] tracking-[0.28em] text-text-muted uppercase sm:block">
              Puzzle
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-wide">Sudoku</h1>
          </div>

          {/* Difficulty picker */}
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDifficultyChange(d)}
                disabled={loading}
                className={[
                  "px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition focus:outline-none",
                  difficulty === d
                    ? "border border-brand-cyan/40 bg-brand-cyan/12 text-brand-cyan"
                    : "border border-border-soft bg-transparent text-text-muted hover:text-text-secondary",
                ].join(" ")}
              >
                {d}
              </button>
            ))}
            </div>
            <div className="text-[11px] text-text-faint">
              Best: <span className="text-brand-cyan font-semibold">{formatSeconds(myBests[difficulty])}</span>
            </div>
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
          <div className="text-text-secondary text-sm py-2">Generating puzzle…</div>
        )}
        {error && !loading && (
          <div className="text-brand-rose text-sm py-4">{error}</div>
        )}

        {/* Board */}
        {state.board.length > 0 ? (
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
        ) : (
          <>
            <div
              className="
                grid grid-cols-9
                border-2 border-brand-cyan/20
                rounded-lg overflow-hidden
                w-full max-w-[min(90vw,480px)]
                mx-auto aspect-square bg-surface/40
              "
            >
              {Array.from({ length: 81 }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-square border border-border-soft/40"
                />
              ))}
            </div>

            <div className="w-full max-w-[min(90vw,480px)] min-h-[96px]" />
          </>
        )}

        {/* New game button */}
        {!loading && state.board.length > 0 && state.status === "playing" && (
          <button
            type="button"
            onClick={handlePlayAgain}
            className="
              text-xs text-text-faint hover:text-text-secondary
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
