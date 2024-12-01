/**
 * Description:
 * This file defines the initial state and the reducer logic for managing the Tic Tac Toe game state.
 * - `INITIAL_STATE`: Represents the default state of the game board, turn tracking, and game status.
 * - `gameReducer`: A reducer function used to handle state transitions for various actions (e.g., setting up the game, making moves, resetting).
 * 
 * The reducer processes actions to update the game state in a predictable and controlled manner. 
 * It is primarily used with React's `useReducer` hook in the game context.
 */

// Initial State for the game
export const INITIAL_STATE = {
    cellValues: Array(9).fill(""), // Represents the current state of the board
    xIsNext: true, // Tracks if it's Player X's turn
    isGameOver: false, // Indicates if the game has ended
    numOfTurnsLeft: 9, // Remaining turns on the board
    winner: null, // The winner of the game (if any)
    winningCombination: [], // Winning combination of cells (if any)
    game: null, // The full game object from the backend
    isAI: false, // Indicates if the game is against AI
};

// Reducer function to manage the game state transitions
export const gameReducer = (state, action) => {
    console.log(`Reducer action received: ${action.type}`, action.payload);

    switch (action.type) {
        case "SET_GAME": {
            // Handles setting the initial game state when a game is loaded
            const {
                board_state,
                current_turn,
                winner,
                is_ai_game,
                winning_combination = [],
            } = action.payload;

            return {
                ...state,
                game: action.payload, // Full game object from the backend
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)), // Convert board_state string into an array
                xIsNext: current_turn === "X", // Determine if it's Player X's turn
                isGameOver: !!winner, // Game is over if a winner exists
                winner, // Set the winner (if any)
                winningCombination: winning_combination, // Set the winning combination (if any)
                numOfTurnsLeft: board_state.split("").filter((cell) => cell === "_").length, // Calculate remaining empty cells
                isAI: is_ai_game, // Set AI game flag
            };
        }

        case "MAKE_MOVE": {
            // Handles updates when a player or AI makes a move
            const {
                board_state,
                current_turn,
                winner,
                winning_combination = [],
                is_ai_game,
            } = action.payload;

            return {
                ...state,
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)), // Update board state
                xIsNext: current_turn === "X", // Update turn
                isGameOver: !!winner, // Check if the game is over
                winner, // Update the winner
                winningCombination: winning_combination, // Update the winning combination
                numOfTurnsLeft: board_state.split("").filter((cell) => cell === "_").length, // Update remaining empty cells
                isAI: is_ai_game !== undefined ? is_ai_game : state.isAI, // Use `is_ai_game` if available, otherwise preserve the current state
            };
        }

        case "RESET_GAME": {
            // Handles resetting the game to its initial state
            const { board_state } = action.payload;

            return {
                ...state,
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)), // Reset the board
                xIsNext: true, // Game starts with Player X
                isGameOver: false, // Reset game over flag
                winner: null, // Clear the winner
                winningCombination: [], // Clear winning combination
                numOfTurnsLeft: 9, // Reset turns
                game: null, // Clear the game object
                isAI: false, // Reset AI flag
            };
        }

        case "RESET_GAME_STATE": {
            // Resets the entire state to the initial values
            return { ...INITIAL_STATE };
        }

        default: {
            console.warn(`Unknown action type: ${action.type}`);
            return state; // Return the current state for unknown actions
        }
    }
};
