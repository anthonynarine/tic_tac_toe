import { useState, useEffect, useCallback } from "react";
import useAuthAxios from "./useAuthAxios";

const useGameServices = (gameId) => {
    const { authAxios } = useAuthAxios();
    const [gameData, setGameData] = useState(null); // Game state
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);

    // Helper function to extract error message
    const extractErrorMessage = (error) => {
        return error.response?.data?.error || "An error occurred";
    };

    // Create new game
    const createNewGame = useCallback(async (playerOUsername, isAIGame = false) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.post("/games", {
                player_o: playerOUsername,
                is_ai_game: isAIGame
            });
            setGameData(response.data); // Update the state with the newly created game   
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [authAxios]);

    // Join an open game
    const joinGame = useCallback(async (gameId) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.post(`/games/${gameId}/join_game/`);
            setGameData(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [authAxios]);

    // Fetch game state from the backend
    const fetchGame = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.get(`/games/${gameId}`);
            setGameData(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [authAxios, gameId]);

    // Make a move in the game
    const makeMove = useCallback(async (position) => {
        if (gameData?.winner) return; // Prevent making a move if the game is over
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.put(`/games/${gameId}`, { position });
            setGameData(response.data); // Update game state with the new data
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [authAxios, gameId, gameData]);

    // Fetch game state on component mount or when the gameId changes
    // useEffect(() => {
    //     fetchGame();
    // }, [fetchGame]);

    return {
        createNewGame,
        joinGame,
        gameData,
        makeMove,
        fetchGame,
        loading,
        error,
    };
};

export default useGameServices;
