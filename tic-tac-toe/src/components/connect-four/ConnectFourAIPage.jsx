import React from "react";
import { useConnectFourAI } from "./hooks/useConnectFourAI";
import { PIECE } from "./utils/c4Logic";
import ConnectFourBoard from "./ConnectFourBoard";
import ConnectFourStatusBar from "./ConnectFourStatusBar";
import ConnectFourResultModal from "./ConnectFourResultModal";

export default function ConnectFourAIPage() {
  const { state, dropHuman, reset } = useConnectFourAI();
  const { board, currentTurn, winner, winCells, status, lastDrop, isThinking } = state;

  const isGameOver = status === "won" || status === "draw";

  return (
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 md:flex md:h-full md:min-h-0 md:items-center md:justify-center md:pt-0 pb-20 sm:pb-24 md:pb-0">
      <div className="mx-auto max-w-2xl min-h-[calc(100dvh-180px)] sm:min-h-[620px] md:min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-5">
        {/* Header */}
        <div className="w-full">
          <div className="hidden text-[11px] tracking-[0.28em] text-text-muted uppercase sm:block">
            vs AI
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-wide">
            Connect Four
          </h1>
        </div>

        <ConnectFourStatusBar
          status={isGameOver ? (status === "draw" ? "draw" : "won") : isThinking ? "playing" : "playing"}
          currentTurn={currentTurn}
          myPiece={PIECE.ONE}
          winner={winner}
          p1Name="You"
          p2Name="AI"
          isAI
        />

        <ConnectFourBoard
          board={board}
          winCells={winCells}
          myPiece={PIECE.ONE}
          currentTurn={currentTurn}
          isGameOver={isGameOver}
          isDisabled={isThinking || isGameOver}
          lastDrop={lastDrop}
          onColumnClick={dropHuman}
        />

        {!isGameOver && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-text-faint hover:text-text-secondary underline underline-offset-2 transition"
          >
            New game
          </button>
        )}

        <div className="w-full min-h-[76px] sm:min-h-[96px] flex items-start justify-center">
          <ConnectFourResultModal
            status={status}
            winner={winner}
            myPiece={PIECE.ONE}
            p1Name="You"
            p2Name="AI"
            isAI
            onPlayAgain={reset}
          />
        </div>
      </div>
    </div>
  );
}
