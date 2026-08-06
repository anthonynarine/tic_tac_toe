import React from "react";
import { useParams } from "react-router-dom";

import CheckersBoard from "./CheckersBoard";
import CheckersStatusBar from "./CheckersStatusBar";
import CheckersResult from "./CheckersResult";
import { useCheckersGame } from "./hooks/useCheckersGame";

export default function CheckersMPPage() {
  const { id: gameId } = useParams();
  const { state, move } = useCheckersGame(gameId, { multiplayer: true });
  const { game, myPiece, status, error, wsStatus } = state;

  return (
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 md:flex md:h-full md:min-h-0 md:items-center md:justify-center md:pt-0 pb-20 sm:pb-24 md:pb-0">
      <div className="mx-auto max-w-2xl min-h-[calc(100dvh-180px)] sm:min-h-[620px] md:min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-5">
        <div className="w-full">
          <div className="hidden text-[11px] tracking-[0.28em] text-text-muted uppercase sm:block">
            Multiplayer
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-wide">
            Checkers
          </h1>
        </div>

        {status === "loading" && <div className="text-text-secondary text-sm py-8">Loading game...</div>}
        {status === "error" && <div className="text-brand-rose text-sm py-4">{error}</div>}

        {game && status !== "error" ? (
          <>
            <CheckersStatusBar
              currentTurn={game.current_turn}
              myPiece={myPiece}
              winner={game.winner}
              isCompleted={game.is_completed}
              p1Name={game.player_one_name || "Red"}
              p2Name={game.player_two_name || "Blue"}
              wsStatus={wsStatus}
            />
            <CheckersBoard
              board={game.board}
              legalMoves={game.legal_moves}
              myPiece={myPiece}
              currentTurn={game.current_turn}
              isGameOver={game.is_completed}
              onMove={move}
            />
            <div className="w-full min-h-[76px] sm:min-h-[96px] flex items-start justify-center">
              <CheckersResult
                isCompleted={game.is_completed}
                winner={game.winner}
                myPiece={myPiece}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
