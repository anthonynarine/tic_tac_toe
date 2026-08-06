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
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 pb-20 sm:pb-24 md:pb-4 min-h-[calc(100dvh-180px)] sm:min-h-[620px] md:min-h-0 md:h-full flex flex-col">
      {/* Board section - centered within remaining space; nav breadcrumb already shows the game name, so status bar attaches directly to the board as one connected unit instead of a separate duplicate title */}
      <div className="w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-5">
        {status === "loading" && <div className="text-text-secondary text-sm py-8">Loading game...</div>}
        {status === "error" && <div className="text-brand-rose text-sm py-4">{error}</div>}

        {game && status !== "error" ? (
          <>
            <div className="w-full flex flex-col items-center">
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
            </div>
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
