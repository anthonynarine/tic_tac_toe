import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuRefreshCcw, LuTrophy } from "react-icons/lu";
import { AiFillHome, AiOutlineCheck, AiOutlineClose } from "react-icons/ai";
import { PIECE } from "./utils/c4Logic";

export default function ConnectFourResultModal({
  status,
  winner,
  myPiece,
  p1Name,
  p2Name,
  isAI,
  onPlayAgain,
  rematchMessage = "",
  rematchShowActions = false,
  rematchPending = false,
  rematchButtonLocked = false,
  onAcceptRematch,
  onDeclineRematch,
}) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  const isOpen = status === "won" || status === "draw";

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      return undefined;
    }

    const id = window.setTimeout(() => setIsVisible(true), 1100);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  if (!isOpen || !isVisible) return null;

  const isDraw = status === "draw";
  const iWon = !isDraw && winner === myPiece;

  const headline = isDraw
    ? "It's a Draw!"
    : iWon
    ? "You Win!"
    : myPiece
    ? "You Lose"
    : winner === PIECE.ONE
    ? `${p1Name || "Player 1"} Wins!`
    : `${isAI ? "AI" : (p2Name || "Player 2")} Wins!`;

  const iconColor = isDraw
    ? "text-text-secondary"
    : iWon
    ? "text-blue-400"
    : "text-red-500";

  return (
    <div className="w-full max-w-[min(92vw,480px)] rounded-lg border border-border-soft bg-background-app-panel/90 p-3 text-center shadow-glow-cyan sm:rounded-card sm:p-4">
      <div className="flex items-center justify-center gap-2 mb-2 sm:gap-3 sm:mb-3">
        {isDraw ? (
          <span className="h-2.5 w-2.5 rounded-full bg-text-secondary" />
        ) : (
          <LuTrophy size={24} className={iconColor} />
        )}

        <h2 className="text-base font-bold text-text-primary sm:text-lg">{headline}</h2>
      </div>

      {rematchMessage && (
        <p className="mb-2 text-xs font-medium text-text-secondary sm:mb-3">
          {rematchShowActions ? rematchMessage : `${rematchMessage} Waiting...`}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {rematchShowActions ? (
          <>
            <button
              type="button"
              onClick={onAcceptRematch}
              disabled={rematchButtonLocked}
              aria-label="Accept rematch"
              title="Accept rematch"
              className="
                grid h-10 w-10 place-items-center rounded-full text-lg
                border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan
                hover:bg-brand-cyan/20 transition focus:outline-none
                disabled:opacity-45 disabled:cursor-not-allowed
              "
            >
              <AiOutlineCheck />
            </button>
            <button
              type="button"
              onClick={onDeclineRematch}
              disabled={rematchButtonLocked}
              aria-label="Decline rematch"
              title="Decline rematch"
              className="
                grid h-10 w-10 place-items-center rounded-full text-lg
                border border-red-500/35 bg-red-500/10 text-red-400
                hover:bg-red-500/20 transition focus:outline-none
                disabled:opacity-45 disabled:cursor-not-allowed
              "
            >
              <AiOutlineClose />
            </button>
          </>
        ) : onPlayAgain && !rematchPending ? (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={rematchButtonLocked}
            aria-label={isAI ? "Play again" : "Request rematch"}
            title={isAI ? "Play again" : "Request rematch"}
            className="
              grid h-10 w-10 place-items-center rounded-full text-lg
              border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan
              hover:bg-brand-cyan/20 transition focus:outline-none
              disabled:opacity-45 disabled:cursor-not-allowed
            "
          >
            <LuRefreshCcw />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Go home"
          title="Go home"
          className="
            grid h-10 w-10 place-items-center rounded-full text-lg
            border border-border-soft bg-surface text-text-secondary
            hover:bg-surface-elevated hover:text-text-primary transition focus:outline-none
          "
        >
          <AiFillHome />
        </button>
      </div>
    </div>
  );
}
