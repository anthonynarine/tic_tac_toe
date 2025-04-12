/**
 * Description:
 * This file defines the initial state and the reducer logic for managing the Tic Tac Toe game state.
 * - `INITIAL_STATE`: Represents the default state of the game board, turn tracking, and game status.
 * - `gameReducer`: A reducer function used to handle state transitions for various actions (e.g., setting up the game, making moves, resetting).
 * 
 * The reducer processes actions to update the game state in a predictable and controlled manner. 
 * It is primarily used with React's `useReducer` hook in the game context.
 */

/// Initial State for the game
export const INITIAL_STATE = {
    cellValues: Array(9).fill(""),
    xIsNext: true,
    isGameOver: false,
    isCompleted: false,
    numOfTurnsLeft: 9,
    winner: null,
    winningCombination: [],
    isAI: false,
    playerRole: null,
    players: [],
    rematchMessage: "",            
    isRematchOfferVisible: false,
    rematchRequestBy: null,
    rematchPending: false,
    rawRematchOffer: null,

};

// Reducer function
export const gameReducer = (state, action) => {
    if (process.env.NODE_ENV === "development") {
        console.log(`Reducer action received: ${action.type}`, action.payload);
    }

    switch (action.type) {
        // Set the full game state after fetching or starting a new game
        case "SET_GAME": {
            const {
                board_state,
                current_turn,
                winner,
                is_ai_game,
                is_completed = false,
                winning_combination = [],
                player_role,
                ...restGame // Capture other game fields (e.g., `id`, `player_x`, etc.)
            } = action.payload;

            return {
                ...state,
                game: { ...restGame, board_state, current_turn, winner }, // Store the full game object
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)),
                xIsNext: current_turn === "X",
                isGameOver: !!winner || is_completed,
                isCompleted: is_completed,
                winner,
                winningCombination: winning_combination,
                numOfTurnsLeft: board_state.split("").filter((cell) => cell === "_").length,
                isAI: is_ai_game,
                playerRole: player_role || restGame.playerRole
            };
        }

        // Update the game state after a move is made
        case "MAKE_MOVE": {
            const {
                board_state,
                current_turn,
                winner,
                is_ai_game,
                is_completed = false,
                winning_combination = [],
                player_role,
                ...restGame
            } = action.payload;

            return {
                ...state,
                game: { ...state.game, ...restGame, board_state, current_turn, winner }, // Update game object
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)),
                xIsNext: current_turn === "X",
                isGameOver: !!winner,
                isCompleted: is_completed,
                winner,
                winningCombination: winning_combination,
                numOfTurnsLeft: board_state.split("").filter((cell) => cell === "_").length,
                isAI: is_ai_game !== undefined ? is_ai_game : state.isAI,
                playerRole: player_role || state.playerRole,
            };
        }
            
        // Apply updated game state from a WebSocket broadcast
        case "UPDATE_GAME_STATE": {
            const {
                board_state,
                current_turn,
                winner,
                is_completed = false,
                winning_combination = [],
                player_role,
                player_x,
                player_o,
                ...restGame
            } = action.payload;

            return {
                ...state,
                game: { ...state.game, ...restGame, board_state, current_turn, winner, player_x, player_o },
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)),
                xIsNext: current_turn === "X",
                isGameOver: !!winner,
                isCompleted: is_completed,
                winner,
                winningCombination: winning_combination,
                playerRole: player_role || state.playerRole,
                numOfTurnsLeft: board_state.split("").filter((cell) => cell === "_").length,
            };
        }

        // Reset everything and optionally prefill the board
        case "RESET_GAME": {
            const { board_state = "_".repeat(9) } = action.payload;

            return {
                ...INITIAL_STATE,
                game: {}, // Reset the game object
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)),
            };
        }
        
        // Full hard reset of the game reducer state
        case "RESET_GAME_STATE": {
            return { ...INITIAL_STATE };
        }

        // Mark the game as completed (used post-finalization)
        case "MARK_COMPLETED": {
            return {
                ...state,
                isGameOver: true,
                isCompleted: true,
            };
        }

        // Update the list of connected players (WebSocket)
        case "PLAYER_LIST": {
            return {
                ...state,
                players: action.payload,
            };
        }

        case "SET_REMATCH_PENDING":
            return {
                ...state,
                rematchPending: action.payload
        }
        
        // Show the rematch modal with message from opponent
        case "SHOW_REMATCH_MODAL":{
            const {
                message = "",
                rematchRequestedBy = null,
                isRematchOfferVisible = true,
                rematchPending = true,
            } = action.payload

            return {
                ...state,
                rematchMessage: message,
                isRematchOfferVisible,
                rematchRequestedBy,
                rematchPending,
            };
        }

        case "RECEIVE_RAW_REMATCH_OFFER":
            return {
                ...state,
                rawRematchOffer: action.payload,
            };
        
        case "HIDE_REMATCH_MODAL":
            return {
                ...state,
                rematchMessage: "",
                isRematchOfferVisible: false, 
                rematchRequestBy: null,
                rematchPending: false,
            }

        default: {
            console.warn(`Unknown action type: ${action.type}`);
            return state;
        }
    }
};
