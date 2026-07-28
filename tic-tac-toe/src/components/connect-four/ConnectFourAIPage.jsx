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
    <div className="w-full px-4 pt-8 md:pt-12 xl:pt-14 pb-24">
      <div className="mx-auto max-w-lg min-h-[620px] flex flex-col items-center gap-5">
        {/* Header */}
        <div className="w-full">
          <div className="text-[11px] tracking-[0.28em] text-text-muted uppercase">
            vs AI
          </div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-wide">
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

        <div className="w-full min-h-[96px] flex items-start justify-center">
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
