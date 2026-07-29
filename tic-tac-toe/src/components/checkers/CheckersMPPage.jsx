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
    <div className="w-full px-4 pt-8 md:pt-12 xl:pt-14 pb-24">
      <div className="mx-auto max-w-lg min-h-[620px] flex flex-col items-center gap-5">
        <div className="w-full">
          <div className="text-[11px] tracking-[0.28em] text-text-muted uppercase">
            Multiplayer
          </div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-wide">
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
            <div className="w-full min-h-[96px] flex items-start justify-center">
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
