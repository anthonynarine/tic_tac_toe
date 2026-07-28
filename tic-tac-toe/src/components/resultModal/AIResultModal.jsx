// ✅ New Code
// Filename: src/components/game/AIResultModal.jsx

import classNames from "classnames";
import { useEffect, useState } from "react";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export const AIResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isGameOver) {
      setIsVisible(false);
      return undefined;
    }

    const id = window.setTimeout(() => setIsVisible(true), 1100);
    return () => window.clearTimeout(id);
  }, [isGameOver]);

  if (!isGameOver || !isVisible) return null;

  const resultMessage = winner === "D" ? "It's a Draw!" : `${winner} Wins`;

  const handlePlayAgain = async () => {
    // Step 1: Create the next AI game (HTTP)
    const created = await onNewGameClicked?.();

    // Step 2: Support returning either {id: ...} or raw id
    const newId =
      typeof created === "string" || typeof created === "number" ? created : created?.id;

    if (!newId) {
      console.error("[AIResultModal] onNewGameClicked must return the new game id.", {
        created,
      });
      return;
    }

    // Step 3: Navigate to AI route (no WS provider)
    navigate(`/games/ai/${newId}`);
  };

  return (
    <div className="w-full max-w-[min(92vw,480px)] mx-auto mt-4">
      <div
        className={classNames(
          "w-full rounded-card p-4 text-center",
          "bg-background-app-panel border border-brand-cyan/25 shadow-glow-cyan"
        )}
      >
        <div className="mb-3 text-lg font-bold text-brand-cyan">{resultMessage}</div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handlePlayAgain}
            className={classNames(
              "px-5 py-2.5 text-sm font-semibold rounded-button",
              "bg-brand-cyan/10 text-brand-cyan",
              "border border-brand-cyan/30",
              "transition-all duration-300",
              "hover:bg-brand-cyan/15 hover:-translate-y-[2px] hover:shadow-glow-cyan"
            )}
          >
            Play Again
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className={classNames(
              "px-5 py-2.5 text-sm font-semibold rounded-button",
              "bg-surface text-text-primary",
              "border border-border-soft",
              "transition-all duration-300 flex items-center justify-center",
              "hover:bg-surface-elevated hover:-translate-y-[2px] hover:border-border-strong"
            )}
          >
            <AiFillHome className="mr-2 text-lg" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
