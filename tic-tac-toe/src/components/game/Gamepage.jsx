// # Filename: src/components/game/GamePage.jsx
// ✅ New Code

import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import GameLoader from "../../utils/gameLoader/Gameloader";
import MultiplayerGameManager from "./managers/MultiplayerGameManager";
import GameResult from "./GameResult";
import ResponsiveBoard from "./board/ResponsiveBoard";

/**
 * GamePage (Multiplayer ONLY)
 * --------------------------------------------------
 * - WS-backed
 * - Must be entered from lobby flow
 * - AI games use /games/ai/:id and a DIFFERENT page
 */
const GamePage = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // 🔒 Prevent double-redirect in StrictMode
  const didRedirectRef = useRef(false);

  // # Step 1: Read query params safely
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const hasLobby = Boolean(query.get("lobby"));
  const hasSessionKey = Boolean(query.get("sessionKey"));

  // # Step 2: Redirect logic MUST live in useEffect
  useEffect(() => {
    if (didRedirectRef.current) return;

    // Missing required multiplayer context → bounce back to lobby
    if (!hasLobby && !hasSessionKey && gameId) {
      didRedirectRef.current = true;
      navigate(`/lobby/tic_tac_toe/${gameId}`, { replace: true });
    }
  }, [hasLobby, hasSessionKey, gameId, navigate]);

  // # Step 3: While redirecting, render nothing
  if (!hasLobby && !hasSessionKey) {
    return null;
  }

  return (
    <MultiplayerGameManager gameId={gameId}>
      {({
        state,
        loading,
        error,
        handleCellClick,
        finalizeGame,
        requestRematch,
      }) => {
        const {
          game,
          isGameOver,
          winner,
          winningCombination,
          cellValues,
        } = state;

        // # Step 4: Determine player role safely
        const playerRole =
          state.playerRole ||
          (game?.player_x === state.userEmail ? "X" : "O");

        // # Step 5: Disable clicks when not your turn or game is over
        const isDisabled = Boolean(
          isGameOver || game?.current_turn !== playerRole
        );

        // # Step 6: Multiplayer rematch = WS flow
        const handleNewGameClicked = async () => {
          return requestRematch();
        };

        return (
          <div className="w-full min-h-[calc(100dvh-180px)] sm:min-h-[620px] pt-1 sm:pt-4 md:pt-8 xl:pt-10 flex flex-col items-center justify-start">
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
                  onCompleteGame={() =>
                    finalizeGame(gameId, winner, state.isCompleted)
                  }
                />
              </>
            )}
          </div>
        );
      }}
    </MultiplayerGameManager>
  );
};

export default GamePage;
