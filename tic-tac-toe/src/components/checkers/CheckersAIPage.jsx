import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { checkersApi } from "../../api/checkersApi";
import CheckersBoard from "./CheckersBoard";
import CheckersStatusBar from "./CheckersStatusBar";
import CheckersResult from "./CheckersResult";
import { useCheckersGame } from "./hooks/useCheckersGame";
import { showToast } from "../../utils/toast/Toast";

export default function CheckersAIPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [gameId, setGameId] = useState(params.id || null);
  const { state, move, createAiRematch } = useCheckersGame(gameId, { multiplayer: false });
  const { game, myPiece, status, error } = state;

  const createInitial = useCallback(async () => {
    try {
      const game = await checkersApi.createGame(true);
      setGameId(String(game.id));
      navigate(`/games/checkers/ai/${game.id}`, { replace: true });
    } catch {
      showToast("error", "Could not create checkers game.");
    }
  }, [navigate]);

  useEffect(() => {
    if (!gameId) createInitial();
  }, [gameId, createInitial]);

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
                p1Name="You"
                p2Name="AI"
                isAI
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
                onPlayAgain={createAiRematch}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
