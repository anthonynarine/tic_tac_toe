
// # Filename: src/components/game/AIGamePage.jsx

import React from "react";
import { useParams } from "react-router-dom";

import GameLoader from "../../utils/gameLoader/Gameloader";
import ResponsiveBoard from "./board/ResponsiveBoard";

import AIGameManager from "./managers/AIGameManager";
import { AIResultModal } from "../resultModal/AIResultModal";

/**
 * AIGamePage
 * - HTTP-only
 * - NEVER touches GameWebSocketProvider / useGameWebSocketContext
 *
 * Note:
 * - Hooks cannot be used inside render-prop callbacks.
 * - For a 9-cell board, computing cellValues inline is trivial.
 */
export default function AIGamePage() {
  const { id: gameId } = useParams();

  return (
    <AIGameManager gameId={gameId}>
      {({ game, loading, error, handleCellClick, createNewAIGame }) => {
        // Step 1: Derive board values (cheap, 9 cells)
        const boardState = game?.board_state || "_________";
        const cellValues = boardState.split("").map((c) => (c === "_" ? "" : c));

        // Step 2: Game over + winner
        const winner = game?.winner || null;
        const isGameOver = Boolean(game?.is_game_over || winner);

        return (
          <div className="w-full min-h-[calc(100dvh-180px)] sm:min-h-[620px] pt-1 sm:pt-4 md:pt-8 xl:pt-10 flex flex-col items-center justify-start">
            <GameLoader loading={loading} error={error} />

            {!loading && !error && game && (
              <>
                <ResponsiveBoard
                  cellValues={cellValues}
                  winningCombination={game?.winning_combination || []}
                  handleCellClick={handleCellClick}
                  isDisabled={isGameOver}
                  playerRole="X"
                  currentTurn={game?.current_turn}
                  winner={winner}
                  isGameOver={isGameOver}
                />

                {/* Step 3: AI-only result UI */}
                <AIResultModal
                  isGameOver={isGameOver}
                  winner={winner}
                  onNewGameClicked={createNewAIGame}
                />
              </>
            )}
          </div>
        );
      }}
    </AIGameManager>
  );
}
