/**
 * gameReducer.jsx
 *
 * Description:
 * This file defines the initial game state and reducer function for managing the
 * Tic Tac Toe game state, player list, WebSocket updates, and rematch offer flows.
 *
 * The reducer is primarily used with React's `useReducer` hook inside the game context provider
 * to ensure predictable state transitions.
 *
 * Organization:
 * - Game Setup Actions (SET_GAME, MAKE_MOVE, UPDATE_GAME_STATE)
 * - Game Reset Actions (RESET_GAME, RESET_GAME_STATE, MARK_COMPLETED)
 * - Player Management (PLAYER_LIST)
 * - Rematch Offer Flow (SHOW_REMATCH_MODAL, RECEIVE_RAW_REMATCH_OFFER, HIDE_REMATCH_MODAL, LOCK_REMATCH_BUTTON)
 * - Miscellaneous (default)
 */

/// --------------------
/// Initial State
/// --------------------
export const INITIAL_STATE = {
    cellValues: Array(9).fill(null), // 3x3 Board initialized as empty
    xIsNext: true, // Tracks whose turn it is (X starts first)
    isGameOver: false, // True when game finishes
    isCompleted: false, // True when game is completed (even if no winner)
    numOfTurnsLeft: 9, // Countdown for available turns
    winner: null, // 'X', 'O', or 'D' for draw
    winningCombination: [], // Array of winning cell indices
    isAI: false, // Whether playing against AI
    playerRole: null, // Current player's role ('X' or 'O')
    players: [], // Connected players (WebSocket)
    rematchMessage: "", // Rematch modal message
    isRematchOfferVisible: false, // Whether rematch modal is visible
    rematchRequestedBy: null, // Role who initiated rematch request
    rematchPending: false, // True if waiting for response
    rawRematchOffer: null, // Raw WebSocket rematch offer payload
    rematchButtonLocked: false, // Prevent spamming rematch button
};

/// --------------------
/// Reducer Function
/// --------------------
export const gameReducer = (state, action) => {
    if (process.env.NODE_ENV === "development") {
        console.log(`Reducer action received: ${action.type}`, action.payload);
    }

    switch (action.type) {

        // --------------------
        // Game Setup Actions
        // --------------------

        case "SET_GAME": {
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
                game: { ...restGame, board_state, current_turn, winner },
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)),
                xIsNext: current_turn === "X",
                isGameOver: !!winner || is_completed,
                isCompleted: is_completed,
                winner,
                winningCombination: winning_combination,
                numOfTurnsLeft: board_state.split("").filter((cell) => cell === "_").length,
                isAI: is_ai_game,
                playerRole: player_role || restGame.playerRole,
            };
        }

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
                game: { ...state.game, ...restGame, board_state, current_turn, winner },
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

        // --------------------
        // Game Reset Actions
        // --------------------

        case "RESET_GAME": {
            const { board_state = "_".repeat(9) } = action.payload;

            return {
                ...INITIAL_STATE,
                game: {},
                cellValues: board_state.split("").map((cell) => (cell === "_" ? "" : cell)),
            };
        }

        case "RESET_GAME_STATE": {
            return { ...INITIAL_STATE };
        }


        case "MARK_COMPLETED": {
            return {
                ...state,
                isGameOver: true,
                isCompleted: true,
            };
        }

        // --------------------
        // Player Management
        // --------------------

        case "PLAYER_LIST": {
            return {
                ...state,
                players: action.payload,
            };
        }

        // --------------------
        // Rematch Offer Flow
        // --------------------

        case "SHOW_REMATCH_MODAL": {
            const {
                message = "",
                rematchRequestedBy = null,
                isRematchOfferVisible = true,
                rematchPending = false,
            } = action.payload || {};
        
            return {
                ...state,
                rematchMessage: message,
                rematchRequestedBy,
                isRematchOfferVisible,
                rematchPending,
            };
        }
        

        case "RECEIVE_RAW_REMATCH_OFFER": {
            if (!action.payload) return state;
        
            return {
                ...state,
                rawRematchOffer: action.payload,
            };
        }        
        

        case "LOCK_REMATCH_BUTTON": {
            return {
                ...state,
                rematchButtonLocked: true,
            };
        }

        case "HIDE_REMATCH_MODAL": {
            return {
                ...state,
                rematchMessage: "",
                isRematchOfferVisible: false,
                rematchRequestedBy: null,
                rematchPending: false,
            };
        }

        // --------------------
        // Default (Error Handling)
        // --------------------

        default: {
            console.warn(`Unknown action type: ${action.type}`);
            return state;
        }
    }
};
