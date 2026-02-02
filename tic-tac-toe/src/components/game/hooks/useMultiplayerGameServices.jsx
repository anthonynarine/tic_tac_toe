
// # Filename: src/components/hooks/game/useMultiplayerGameServices.jsx

import { useCallback, useState } from "react";
import useAuthAxios from "../../../auth/hooks/useAuthAxios";
import { showToast } from "../../../utils/toast/Toast";

/**
 * Multiplayer Game Services (HTTP-only)
 *
 * Rules:
 * - NO WebSocket context imports
 * - WS sync is handled by MultiplayerGameManager
 */
const useMultiplayerGameServices = () => {
  const { authAxios } = useAuthAxios();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: Normalize backend errors
  const extractErrorMessage = (err) =>
    err?.response?.data?.error || err?.message || "An error occurred";

  // Step 2: Fetch game (HTTP)
  const fetchGame = useCallback(
    async (gameId) => {
      if (!authAxios) {
        setError("Authorization service unavailable");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await authAxios.get(`/games/${gameId}/`);
        return res.data;
      } catch (err) {
        const msg = extractErrorMessage(err);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [authAxios]
  );

  // Step 3: Make move (HTTP)
  const makeMove = useCallback(
    async (gameId, position) => {
      if (!authAxios) {
        setError("Authorization service unavailable");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await authAxios.post(`/games/${gameId}/move/`, { position });
        return res.data;
      } catch (err) {
        const msg = extractErrorMessage(err);
        setError(msg);
        showToast("error", msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [authAxios]
  );

  // Step 4: Finalize/Complete (HTTP)
  const finalizeGame = useCallback(
    async (gameId, winner) => {
      if (!authAxios) {
        setError("Authorization service unavailable");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await authAxios.post(`/games/${gameId}/complete/`, { winner });
        return res.data?.game || res.data;
      } catch (err) {
        const msg = extractErrorMessage(err);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [authAxios]
  );

  return {
    loading,
    error,
    fetchGame,
    makeMove,
    finalizeGame,
  };
};

export default useMultiplayerGameServices;
