import { useEffect, useState, useCallback } from "react";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import useGameServices from "../hooks/useGameServices";
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
    const { state, dispatch } = useGameWebSocketContext();
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
    useEffect(() => {
        const { isGameOver, winner, isCompleted } = state; // Destructure state values at the start
    
        // Debug logs
        // console.log("Checking if finalizeGame should be called...");
        // console.log("State.isGameOver:", isGameOver);
        // console.log("State.winner:", winner);
        // console.log("State.isCompleted:", isCompleted);
    
        if (isGameOver && winner && !isCompleted) {
            console.log("Conditions met. Calling finalizeGame...");
            finalizeGame(gameId, winner, isCompleted);
        } else {
            console.log("Conditions not met for finalizeGame.");
        }
    }, [state.isGameOver, state.winner, state.isCompleted, gameId, finalizeGame]);
    
    

    /**
     * Handles a cell click in the game.
     * Validates the move, communicates with the backend, and updates game state.
     *
     * @param {number} cellIndex - The index of the clicked cell (0-8).
     */
    const handleCellClick = useCallback(
        async (cellIndex) => {
            // Prevent clicking if the game is over or the cell is already occupied
            if (state.isGameOver || state.cellValues[cellIndex] !== "") {
                console.log("Invalid move: Game is over or cell is occupied.");
                return;
            }

            // Determine if it's the current player's turn
            const isCurrentPlayerTurn =
                (state.xIsNext && state.game.current_turn === "X") ||
                (!state.xIsNext && state.game.current_turn === "O");

            if (!isCurrentPlayerTurn) {
                showToast("It's not your turn!");
                return;
            }

            try {
                console.log("Sending move to backend for cell:", cellIndex);

                const updatedGame = await makeMove(gameId, cellIndex);
                console.log("makeMove result:", updatedGame);

                if (updatedGame) {
                    console.log("Move successful, updating game state.");
                    dispatch({ type: "MAKE_MOVE", payload: updatedGame });
                } else {
                    console.error("Invalid game data received from backend:", updatedGame)
                }
            } catch (err) {
                console.error("Error making move:", err);
            }
        },
        [state, gameId, makeMove, dispatch]
    );

    const derivedState = {...state, game: {...state.game} };
    useEffect(() => {
        console.log("DERIVED STATE in GameManager", state);
    }, [state]);


    // Render prop pattern: pass state and handlers to children
    return children({
        state: derivedState , // Provide a fallback empty object
        loading,
        error,
        handleCellClick,
        playAgainAI,
        completeGame,
        finalizeGame
    });
};

export default GameManager;
