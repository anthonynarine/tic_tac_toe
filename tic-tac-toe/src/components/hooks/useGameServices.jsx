import { useState, useEffect, useCallback } from "react";
import useAuthAxios from "./useAuthAxios";

const useGameServices = () => {
    const { authAxios } = useAuthAxios();
    const [gameData, setGameData] = useState(null);
    const [joinableGames, setJoinableGames] = useState([]); // For open games
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);

    // Helper function to extract error message
    const extractErrorMessage = (error) => {
        return error.response?.data?.error || "An error occurred";
    };

    // Helper function to start loading
    const initializeRequest = () => {
        setLoading(true);
        setError(null);
    };

    // Helper function to stop loading
    const stopLoading = () => setLoading(false);

    // Fetch joinable games
    const fetchJoinableGames = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();
        try {
            const response = await authAxios.get("/games/open-games/");
            setJoinableGames(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }
    }, [authAxios]);

    // Fetch user's ongoing games
    const fetchUserGames = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();
        try {
            const response = await authAxios.get("/games/"); // Assuming /games/ returns user's games
            setGameData(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }
    }, [authAxios]);

    /**
     * Creates a new Tic-Tac-Toe game.
     * 
     * This function is responsible for sending a POST request to the backend to create a new game.
     * By default, it creates a multiplayer game, but if the `isAIGame` flag is set to `true`, 
     * it will create a game against an AI opponent. 
     * 
     * This function is often called by a higher-level handler (e.g., `handleCreateGame`) as part of a 
     * process known as **function delegation**, where the handler function manages user interaction
     * or event logic and delegates the game creation task to this function.
     * 
     * @param {string|null} player_o - Not used in this case since player_o is assigned in the backend (AI or during multiplayer game joining).
     * @param {boolean} isAIGame - Flag to indicate if the game is against an AI. Defaults to false (multiplayer game).
     * @returns {Object} - The response data containing the created game.
     */
    const createNewGame = useCallback(async (player_o = null, isAIGame = false) => {
        // Ensure authAxios is available before making the request
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        // Initialize the request by setting the loading state
        initializeRequest();

        try {
            // Construct the payload with the is_ai_game flag to indicate the type of game
            const payload = {
                is_ai_game: isAIGame,  // Flag to specify if the game is AI vs player (true) or multiplayer (false)
            };

            // Send POST request to create a new game
            console.log("Payload for creating game:", { is_ai_game: isAIGame });
            const response = await authAxios.post("/games/", payload);
            console.log("Response from creating game:", response.data);

            // Return the created game data
            return response.data;
        } catch (error) {
            // Handle any errors that occur during the request
            setError(extractErrorMessage(error));
        } finally {
            // Ensure loading state is stopped, whether the request succeeds or fails
            stopLoading();
        }
    }, [authAxios]);

    /**
     * Makes a move in the current game. 
     * 
     * This function sends the player's move to the backend to update the game state.
     * 
     * @param {string} gameId - The ID of the current game. 
     * @param {number} position - The index of the cell the player clicked. 
     * @returns {object} - The updated game data from the backend. 
     */
    const makeMove = useCallback(async (gameId, position) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();

        try {
            const payload = { position }; // Payload contains the cell position the player clicked

            const response = await authAxios.post(`/games/${gameId}/move/`, payload);
            return response.data; // Return the updated game data
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }
    }, [authAxios]);

    const resetGame = useCallback(async(gameId) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();

        try {
            const response = await authAxios.post(`/games/${gameId}/reset/`)
            return response.data; // Return the restted gamed data 
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }
    }, [authAxios]);


    return {
        fetchJoinableGames,
        fetchUserGames,
        joinableGames,
        gameData,
        loading,
        error,
        createNewGame,
        makeMove
    };
};

export default useGameServices;
