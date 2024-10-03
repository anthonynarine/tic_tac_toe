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

/**
 * createNewGame
 * 
 * Function to create a new Tic-Tac-Toe game by sending a POST request to the backend.
 * 
 * Satisfies the backend `perform_create` logic by:
 * - Automatically assigning the user making the request as player_x.
 * - If it's a multiplayer game, includes player_o (opponent's email) in the request.
 * - If it's an AI game, no player_o is included in the request, and the backend assigns the AI as player_o.
 * 
 * @param {string} playerOEmail - The email of the second player (if it's a multiplayer game).
 * @param {boolean} isAIGame - A flag indicating if the game is against AI.
 */
 const createNewGame = useCallback(async (playerOEmail, isAIGame = false) => {
    if (!authAxios) {
        setError("Authorization service unavailable"); // Handle missing axios instance
        return;
    }

    setLoading(true); // Indicate that the request is in progress
    setError(null); // Reset any previous error

    try {
        // Payload to send in the POST request
        const payload = {
            is_ai_game: isAIGame, // Flag for whether this is an AI game
        };

        if (!isAIGame && playerOEmail) {
            // If it's a multiplayer game, include the email for player_o
            payload.player_o = playerOEmail;
        }

        // Send POST request to create a new game
        const response = await authAxios.post("/games/", payload);

        // Update the state with the newly created game data
        setGameData(response.data);
    } catch (error) {
        // Extract and set the error message in case of failure
        setError(extractErrorMessage(error));
    } finally {
        // Indicate that the request is complete
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
