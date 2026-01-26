
// # Filename: src/components/game/GamePage.jsx

import React, { useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import GameLoader from "../../utils/gameLoader/Gameloader";
import MultiplayerGameManager from "./managers/MultiplayerGameManager";
import GameResult from "./GameResult";
import ResponsiveBoard from "./board/ResponsiveBoard";

/**
 * GamePage (Multiplayer only)
 * --------------------------------------------
 * This route is WS-backed and MUST be entered via lobby flow.
 * AI games should use /games/ai/:id (HTTP-only) and AIGamePage.
 */
export const GamePage = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Step 1: Guard against incorrect direct entry (prevents weird WS state)
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hasLobby = Boolean(query.get("lobby"));
  const hasSessionKey = Boolean(query.get("sessionKey"));

  // ✅ If user lands on /games/:id without lobby context, redirect to lobby
  if (!hasLobby && !hasSessionKey) {
    navigate(`/lobby/${gameId}`, { replace: true });
    return null;
  }

  return (
    <MultiplayerGameManager gameId={gameId}>
      {({ state, loading, error, handleCellClick, finalizeGame, requestRematch }) => {
        const { game, isGameOver, winner, winningCombination, cellValues } = state;

        // Step 2: Determine player role (fallback if not assigned yet)
        const playerRole =
          state.playerRole || (game?.player_x === state.userEmail ? "X" : "O");

        // Step 3: Disable clicks when game over or not your turn
        const isDisabled = Boolean(isGameOver || game?.current_turn !== playerRole);

        // Step 4: Multiplayer "Play Again" maps to WS rematch flow
        const handleNewGameClicked = async () => {
          // Step 1: Multiplayer uses WS rematch flow
          return requestRematch();
        };

        return (
          <>
            <GameLoader loading={loading} error={error} />

            {!loading && !error && game && (
              <>
                <ResponsiveBoard
                  cellValues={cellValues}
                  winningCombination={winningCombination}
                  handleCellClick={handleCellClick}
                  isDisabled={isDisabled}
                  playerRole={playerRole}
                  currentTurn={game.current_turn}
                  winner={winner}
                  isGameOver={isGameOver}
                />

                <GameResult
                  isGameOver={isGameOver}
                  isAI={false}
                  winner={winner}
                  onNewGameClicked={handleNewGameClicked}
                  onCompleteGame={() => finalizeGame(gameId, winner, state.isCompleted)}
                />
              </>
            )}
          </>
        );
      }}
    </MultiplayerGameManager>
  );
};

export default GamePage;
