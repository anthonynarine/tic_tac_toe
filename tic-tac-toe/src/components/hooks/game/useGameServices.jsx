import { useState, useCallback } from "react";
import useAuthAxios from "../../auth/hooks/useAuthAxios"
import { showToast } from "../../../utils/toast/Toast";
import { useGameWebSocketContext } from "../../websocket/GameWebsocketContext";
import { useNavigate } from "react-router-dom";

const useGameServices = () => {
    const { authAxios } = useAuthAxios();
    const [gameData, setGameData] = useState(null);
    const [joinableGames, setJoinableGames] = useState([]); // For open games
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);
    const { dispatch } = useGameWebSocketContext();
    const navigate = useNavigate();

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

        /**
     * Fetches the game state from the backend for a given game ID.
     *
     * This function sends a GET request to the backend to retrieve the full game object,
     * including the current board state, turn, winner, and other game details.
     *
     * @param {string} gameId - The ID of the game to fetch.
     * @returns {Object|null} - The fetched game data or null if an error occurs.
     */
    const fetchGame = useCallback(async (gameId) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return null;
        }

        initializeRequest();

        try {
            const response = await authAxios.get(`/games/${gameId}/`);
            console.log("Fetched Game:", response.data);
            return response.data;
        } catch (error) {
            setError(extractErrorMessage(error));
            console.error("Error fetching game:", extractErrorMessage(error));
            return null;
        } finally {
            stopLoading();
        }
    }, [authAxios]);

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
            console.error("🔥 Game creation failed:", error.response?.data || error.message);
            throw error; // 💥 needed for upstream to react
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
            console.log("Move Response:", response.data); // Log the backend response
            return response.data; // Return the updated game data
        } catch (error) {
            const errorMessage = extractErrorMessage(error); // Extract error message
            console.error("Error making move:", errorMessage); // Log the error
            showToast("error", errorMessage); // Show error toast notification
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

    /**
     * Marks the game as completed on the backend.
     * Updates player stats and finalizes the game record.
     *
     * @param {string} gameId - The ID of the game to complete.
     * @returns {Object|null} - The response data from the backend or null if an error occurs.
     */
    const completeGame = useCallback(async (gameId, winner) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return null;
        }

        initializeRequest();

        try {
            // Send the winner information to the backend to complete the game
            const response = await authAxios.post(`/games/${gameId}/complete/`, {
                winner, 
            });

            // Server returns { message: "...", game: {...} }
            // Just need the updated game object:
            const updateGame = response.data.game;
            console.log("Complete Game Response:", response.data.game); // Log response for debugging
            return updateGame; 
        } catch (error) {
            if (
                error.response?.status === 400 &&
                error.response?.data?.detail === "Game is already completed."
            ) {
                dispatch({ type: "MARK_COMPLETED"});
            }
            setError(extractErrorMessage(error)); // Set the error message in the state
            console.error("Error completing the game:", error); // Log the error for debugging
            return null; // Return null if the request fails
        } finally {
            stopLoading(); // Stop the loading state
        }
    }, [authAxios, dispatch]); // Include state.winner as a dependency

    /**
     * Finalizes the game by checking if it's completed and updating the state.
     * 
     * @param {String} gameId - The ID of the game to finalize.
     * @param {String} winner - The winner of the game ("X", "O", or draw).
     * @param {Boolean} isCompleted - Indicates whether the game is already completed.
     * @returns {Object|null} - The updated game data or null if the game is already completed.
     */
    const finalizeGame = useCallback(async (gameId, winner, isCompleted = false) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return null; // Return early if authAxios is unavailable
        }

        console.log("FinalizeGame called:");
        console.log("Game ID:", gameId);
        console.log("Winner:", winner);
        console.log("IsCompleted:", isCompleted);

        // Prevent duplicate requests if the game is already completed
        if (isCompleted) {
            console.log("Game is already completed. Skipping finalizeGame request.");
            return null;
        }

        // Check for missing parameters
        if (!gameId || !winner) {
            console.error("Missing required parameters: gameId or winner");
            return null;
        }

        try {
            console.log(`Finalizing game with ID: ${gameId} and winner: ${winner}`);

            // Call the completeGame function to send the request to the backend
            const updatedGame = await completeGame(gameId, winner);

            if (updatedGame) {
                console.log("Game finalized successfully:", updatedGame);

                // Dispatch updated game state with isCompleted set to true
                dispatch({ type: "SET_GAME", payload: updatedGame });

                return updatedGame; // Return the updated game for further use
            }
        } catch (error) {
            console.error("Error finalizing the game:", error);
            setError(extractErrorMessage(error));
            return null; // Return null if there's an error
        }
    }, [authAxios, completeGame, dispatch]);

    // Function to create a new AI game
    const playAgainAI = async () => {
        console.log("Play Again AI triggered");
        // Dispatch reset action to clear the game state before starting a new game
        dispatch({ type: "RESET_GAME_STATE" });

        initializeRequest(); // Start the loading state
    
        try {
            console.log("Creating a new AI game");
    
            // Create a new AI game
            const newGame = await createNewGame(null, true); // `true` indicates an AI game
    
            if (newGame) {
                console.log("New AI game created:", newGame);
    
                // Dispatch the newly created game to update the state
                dispatch({ type: "SET_GAME", payload: newGame });
    
                // Navigate to the new game
                navigate(`/games/${newGame.id}`);
            } else {
                console.error("Failed to create a new AI game.");
            }
        } catch (error) {
            console.error("Error creating new AI game:", error);
        } finally {
            stopLoading(); // Stop the loading state after the request completes
        }
    };

        // Function to create a new multiplayer game
    const playAgainMultiplayer = async () => {
        initializeRequest(); // Start the loading state

        try {
            console.log("Creating a new multiplayer game");

            // Create a new multiplayer game
            const newGame = await createNewGame(null, false); // false for multiplayer game

            if (newGame) {
                console.log("New multiplayer game created:", newGame);

                // Update the game state with the new game details
                dispatch({ type: "SET_GAME", payload: newGame });

                // Navigate to the new game's page
                navigate(`/games/${newGame.id}`);
            } else {
                console.error("Failed to create a new multiplayer game.");
            }
        } catch (error) {
            console.error("Error creating new multiplayer game:", error);
        } finally {
            stopLoading(); // Stop the loading state
        }
    };
    

    return {
        fetchJoinableGames,
        fetchUserGames,
        finalizeGame,
        joinableGames,
        fetchGame,
        gameData,
        loading,
        error,
        createNewGame,
        makeMove,
        resetGame,
        completeGame,
        playAgainAI,
        playAgainMultiplayer
    };
};

export default useGameServices;
