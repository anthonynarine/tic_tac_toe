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
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 pb-20 sm:pb-24 md:pb-4 min-h-[calc(100dvh-180px)] sm:min-h-[620px] md:min-h-0 md:h-full flex flex-col">
      {/* Board section - centered within remaining space; nav breadcrumb already shows the game name, so status bar attaches directly to the board as one connected unit instead of a separate duplicate title */}
      <div className="w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-5">
        <div className="w-full flex flex-col items-center">
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
        </div>

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
