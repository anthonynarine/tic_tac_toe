
// # Filename: src/components/game/managers/MultiplayerGameManager.jsx

import { useEffect, useState, useCallback, useRef } from "react";
import { useGameWebSocketContext } from "../../websocket/GameWebsocketContext";
import useMultiplayerGameServices from "../hooks/useMultiplayerGameServices";
import { showToast } from "../../../utils/toast/Toast";

/**
 * MultiplayerGameManager
 *
 * WebSocket-backed manager for REAL-TIME multiplayer games.
 *
 * Rules:
 * - Requires <GameWebSocketProvider> higher in the tree.
 * - Services are HTTP-only. WS sync happens here.
 */
const MultiplayerGameManager = ({ gameId, children }) => {
  const { state, dispatch, sendMessage } = useGameWebSocketContext();
  const { fetchGame, makeMove, finalizeGame } = useMultiplayerGameServices();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const initializeRequest = () => {
    setLoading(true);
    setError(null);
  };

  const stopLoading = () => setLoading(false);

  // Step 1: Fetch game on mount / when id changes
  useEffect(() => {
    const loadGame = async () => {
      initializeRequest();

      try {
        const fetchedGame = await fetchGame(gameId);
        if (fetchedGame) {
          dispatch({ type: "SET_GAME", payload: fetchedGame });
        }
      } catch (err) {
        console.error("[MultiplayerGameManager] fetchGame failed:", err);
        setError("Failed to load game");
      } finally {
        stopLoading();
      }
    };

    void loadGame();
  }, [gameId, dispatch, fetchGame]);

  // Step 2: Finalize game once when it ends
  const finalizeCalledRef = useRef(false);

  useEffect(() => {
    const { isGameOver, winner, isCompleted } = state;

    if (isGameOver && winner && !isCompleted && !finalizeCalledRef.current) {
      finalizeCalledRef.current = true;

      // Step 1: finalize on backend (HTTP)
      (async () => {
        const updated = await finalizeGame(gameId, winner);

        if (updated) {
          dispatch({ type: "SET_GAME", payload: updated });
        }

        // Step 2: mark completed in WS state (prevents re-finalize storms)
        dispatch({ type: "MARK_COMPLETED" });
      })();
    }

    // Step 3: Reset guard if a brand new game loads
    if (!isGameOver && !isCompleted) {
      finalizeCalledRef.current = false;
    }
  }, [state.isGameOver, state.winner, state.isCompleted, gameId, finalizeGame, dispatch]);

  // Step 3: Handle moves (HTTP call, but synchronized via WS state)
  const handleCellClick = useCallback(
    async (cellIndex) => {
      if (state.isGameOver || state.cellValues[cellIndex] !== "") return;

      const isCurrentPlayerTurn =
        (state.xIsNext && state.game?.current_turn === "X") ||
        (!state.xIsNext && state.game?.current_turn === "O");

      if (!isCurrentPlayerTurn) {
        showToast("info", "It's not your turn!");
        return;
      }

      try {
        const updatedGame = await makeMove(gameId, cellIndex);

        if (updatedGame) {
          dispatch({ type: "MAKE_MOVE", payload: updatedGame });
        }
      } catch (err) {
        console.error("[MultiplayerGameManager] makeMove failed:", err);
      }
    },
    [state, gameId, makeMove, dispatch]
  );

  // Step 4: Rematch (WS message)
  const requestRematch = useCallback(() => {
    sendMessage({ type: "rematch_request" });
  }, [sendMessage]);

  // Step 5: Derived state (avoid accidental mutation)
  const derivedState = { ...state, game: { ...state.game } };

  return children({
    state: derivedState,
    loading,
    error,
    handleCellClick,
    requestRematch,
  });
};

export default MultiplayerGameManager;
