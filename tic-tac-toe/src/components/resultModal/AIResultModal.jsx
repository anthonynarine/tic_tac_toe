// ✅ New Code
// Filename: src/components/game/AIResultModal.jsx

import classNames from "classnames";
import { AiFillHome } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export const AIResultModal = ({ isGameOver, winner, onNewGameClicked }) => {
  const navigate = useNavigate();

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

  const modalClass = classNames(
    "fixed inset-0 z-[1000] flex items-center justify-center px-4",
    "bg-black/75 backdrop-blur-md transition-opacity duration-300",
    {
      "opacity-100 pointer-events-auto": isGameOver,
      "opacity-0 pointer-events-none": !isGameOver,
    }
  );

  return (
    <div className={modalClass} aria-hidden={!isGameOver}>
      <div
        className={classNames(
          "w-[400px] max-w-[90%] rounded-[20px] p-8 text-center",
          "bg-[#0e1117] text-[#63c6ff]",
          "glow-border tron-frame",
          "animate-[fadeInScale_0.45s_ease-in]"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-6 text-[1.6rem] font-bold text-[#1da1f2]">{resultMessage}</div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handlePlayAgain}
            className={classNames(
              "px-6 py-3 text-base font-bold rounded-[10px]",
              "bg-black text-[var(--primary-color)]",
              "border-2 border-[var(--border-color)]",
              "transition-all duration-300",
              "shadow-[0_0_8px_var(--glow-color-soft),0_0_14px_var(--glow-color)]",
              "hover:bg-[#0d0d0d] hover:-translate-y-[2px] hover:scale-[1.04]",
              "hover:shadow-[0_0_16px_var(--glow-color),0_0_30px_var(--glow-color-soft)]"
            )}
          >
            Play Again
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className={classNames(
              "px-6 py-3 text-base font-bold rounded-[10px]",
              "bg-black text-[var(--primary-color)]",
              "border-2 border-[var(--border-color)]",
              "transition-all duration-300 flex items-center justify-center",
              "shadow-[0_0_8px_var(--glow-color-soft),0_0_14px_var(--glow-color)]",
              "hover:bg-[#0d0d0d] hover:-translate-y-[2px] hover:scale-[1.04]",
              "hover:shadow-[0_0_16px_var(--glow-color),0_0_30px_var(--glow-color-soft)]"
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
