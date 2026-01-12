import { useEffect, useState, useCallback, useRef } from "react";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import useGameServices from "../hooks/game/useGameServices"
import { showToast } from "../../utils/toast/Toast";

/**
 * GameManager Component
 *
 * Manages game state, handles game logic, and communicates with the backend.
 * Provides state and handler functions to children via a render prop pattern.
 *
 * Props:
 * - gameId (string): The ID of the game to manage.
 * - children (function): A render function that receives game state and handlers.
 *
 * Example Usage:
 * ```jsx
 * <GameManager gameId={gameId}>
 *   {({ state, loading, error, handleCellClick, playAgainAI, completeGame }) => (
 *     <GameComponent
 *       state={state}
 *       loading={loading}
 *       error={error}
 *       onCellClick={handleCellClick}
 *       onPlayAgain={playAgainAI}
 *       onCompleteGame={completeGame}
 *     />
 *   )}
 * </GameManager>
 * ```
 */
const GameManager = ({ gameId, children }) => {
    // Context and state
    const { state, dispatch, sendMessage } = useGameWebSocketContext();
    const { fetchGame, makeMove, playAgainAI, completeGame, finalizeGame } = useGameServices();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Loading helpers
    const initializeRequest = () => {
        setLoading(true);
        setError(null);
    };
    const stopLoading = () => setLoading(false);

    // Fetch game data on mount
    useEffect(() => {
        const loadGame = async () => {
        initializeRequest();
        try {
            const fetchedGame = await fetchGame(gameId);
            console.log("Fetched Game", fetchedGame)
            if (fetchedGame) {
            dispatch({ type: "SET_GAME", payload: fetchedGame });
            }
        } catch (err) {
            console.error("Error fetching game:", err);
            setError("Failed to load game");
        } finally {
            stopLoading();
        }
        };
        loadGame();
    }, [gameId, dispatch]);

    // Finalize game when it's over
    const finalizeCalledRef = useRef(false);

    useEffect(() => {
        // Step 1: Destructure relevant game state properties for readability.
        const { isGameOver, winner, isCompleted } = state;
    
        // Step 2: Debugging logs (uncomment these if needed for troubleshooting).
        // console.log("Checking if finalizeGame should be called...");
        // console.log("State.isGameOver:", isGameOver);
        // console.log("State.winner:", winner);
        // console.log("State.isCompleted:", isCompleted);
    
        // Step 3: Check if the game should be finalized.
        // - The game must be over (`isGameOver === true`).
        // - There must be a winner (`winner` should not be null).
        // - The game should not already be marked as completed (`!isCompleted`).
        // - `finalizeCalledRef.current` ensures this function only runs once to prevent duplicate calls.
        if (isGameOver && winner && !isCompleted && !finalizeCalledRef.current) {
            finalizeCalledRef.current = true; // Step 4: Mark that finalizeGame has been triggered.
            console.log("Conditions met. Calling finalizeGame...");
            
            // Step 5: Call finalizeGame to handle any backend updates (e.g., storing results).
            finalizeGame(gameId, winner, isCompleted);
        } else {
            console.log("Conditions not met for finalizeGame."); // Log when finalizeGame is skipped.
        }
    }, [state.isGameOver, state.winner, state.isCompleted, gameId, finalizeGame]); // Dependencies ensure this runs when these values change.
    
    
    
    /**
     * Handles a cell click in the game.
     * 
     * This function ensures that:
     * - Moves can only be made in valid conditions (not after the game is over or in an occupied cell).
     * - Only the correct player can make a move (based on turn validation).
     * - The move is sent to the backend for processing.
     * - The game state updates upon a successful move.
     * 
     * @param {number} cellIndex - The index of the clicked cell (0-8).
     */
    const handleCellClick = useCallback(
        async (cellIndex) => {
            // Step 1: Prevent invalid moves
            // - If the game is over, prevent further moves.
            // - If the selected cell is already occupied, prevent overwriting it.
            if (state.isGameOver || state.cellValues[cellIndex] !== "") {
                console.log("Invalid move: Game is over or cell is occupied.");
                return;
            }

            // Step 2: Determine if it's the current player's turn.
            // - If "X" is next, check if the current turn belongs to "X".
            // - If "O" is next, check if the current turn belongs to "O".
            const isCurrentPlayerTurn =
                (state.xIsNext && state.game.current_turn === "X") ||
                (!state.xIsNext && state.game.current_turn === "O");

            if (!isCurrentPlayerTurn) {
                showToast("It's not your turn!"); // Show a message to inform the player.
                return;
            }

            try {
                // Step 3: Send the move to the backend.
                console.log("Sending move to backend for cell:", cellIndex);
                const updatedGame = await makeMove(gameId, cellIndex);

                // Step 4: Handle the server response.
                console.log("makeMove result:", updatedGame);
                if (updatedGame) {
                    // Step 5: Update the game state if the move was successful.
                    console.log("Move successful, updating game state.");
                    dispatch({ type: "MAKE_MOVE", payload: updatedGame });
                } else {
                    console.error("Invalid game data received from backend:", updatedGame);
                }
            } catch (err) {
                // Step 6: Handle any errors that occur during the move process.
                console.error("Error making move:", err);
            }
        },
        [state, gameId, makeMove, dispatch] // Dependencies for useCallback
    );


    /**
 * Sends a rematch request to the WebSocket server.
 * 
 * This function is called when a player clicks "Rematch" in the ResultModal.
 * It sends a WebSocket message of type "rematch_request" to notify the server
 * that the player wants to start a new game with the same opponent.
 * 
 * Expected server response:
 * - If successful, the server will broadcast a "rematch_offer" message to all players.
 * - If the opponent accepts, the server will send a "rematch_start" event with a new game ID.
 * 
 * @example
 * requestRematch();
 */
    const requestRematch = () => {
        console.log("Requesting a rematch...");
        sendMessage({ type: "rematch_request"}) // send ws message to provider
    }

    // Step 1: Create a new state object with a shallow copy of "state" and "state.game".
    // This prevents unintended modifications to the original state.
    const derivedState = { ...state, game: { ...state.game } };

    /**
     * Debugging: Log the updated state whenever "state" changes.
     * This helps track state updates in GameManager.
     */
    useEffect(() => {
        console.log("DERIVED STATE in GameManager", state);
    }, [state]); // Runs every time "state" changes.


    // Render prop pattern: pass state and handlers to children
    return children({
        state: derivedState , // Provide a fallback empty object
        loading,
        error,
        handleCellClick,
        playAgainAI,
        completeGame,
        finalizeGame,
        requestRematch,
    });
};

export default GameManager;
