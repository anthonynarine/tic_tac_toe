
// # Filename: src/components/game/managers/AIGameManager.jsx

import { useCallback, useEffect, useRef, useState } from "react";
import useAIGameServices from "../hooks/useAIGameServices"
import useGameCreation from "../hooks/useGameCreation";

/**
 * AIGameManager
 *
 * HTTP-only manager for AI games.
 *
 * Rules:
 * - NO WebSocket imports.
 * - "Play Again" MUST create an AI game via createNewGame(true).
 */
const AIGameManager = ({ gameId, children }) => {
  const { fetchGame, makeMove, finalizeGame } = useAIGameServices();
  const { createNewGame } = useGameCreation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null);

  // Step 1: Fetch AI game
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const fetched = await fetchGame(gameId);
        setGame(fetched);
      } catch (err) {
        console.error("[AIGameManager] fetchGame failed:", err);
        setError("Failed to load AI game");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [gameId, fetchGame]);

  // Step 2: Finalize once
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (!game) return;

    const isGameOver = Boolean(game?.is_game_over);
    const winner = game?.winner;

    if (isGameOver && winner && !finalizedRef.current) {
      finalizedRef.current = true;
      // Step 1: finalize on backend (HTTP)
      void finalizeGame(gameId, winner);
    }

    if (!isGameOver) {
      finalizedRef.current = false;
    }
  }, [game, gameId, finalizeGame]);

  // Step 3: Handle move (HTTP)
  const handleCellClick = useCallback(
    async (cellIndex) => {
      if (!game) return;

      const cellValues = (game?.board_state || "").split("");
      if (cellValues[cellIndex] && cellValues[cellIndex] !== "_") return;
      if (game?.is_game_over) return;

      try {
        const updated = await makeMove(gameId, cellIndex);
        if (updated) setGame(updated);
      } catch (err) {
        console.error("[AIGameManager] makeMove failed:", err);
      }
    },
    [game, gameId, makeMove]
  );

  // Step 4: Create a new AI game for "Play Again"
  const createNewAIGame = useCallback(async () => {
    try {
      // Step 1: MUST pass true so we create an AI game (not multiplayer)
      const created = await createNewGame(true);

      if (!created?.id) {
        console.error("[AIGameManager] createNewGame(true) returned no id:", created);
        return null;
      }

      // Step 2: Return the created game (AIResultModal expects this)
      return created;
    } catch (err) {
      console.error("[AIGameManager] createNewGame(true) failed:", err);
      return null;
    }
  }, [createNewGame]);

  return children({
    game,
    loading,
    error,
    handleCellClick,
    createNewAIGame,
  });
};

export default AIGameManager;
