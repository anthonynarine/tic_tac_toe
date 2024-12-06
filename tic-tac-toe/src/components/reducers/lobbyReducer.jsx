/**
 * Description:
 * This file defines the initial state and the reducer logic for managing the lobby state.
 * - `INITIAL_LOBBY_STATE`: Represents the default state of the lobby, including players, chat messages, and game status.
 * - `lobbyReducer`: A reducer function to handle state transitions for various lobby actions (e.g., adding players, handling chat messages, starting the game).
 * 
 * The reducer processes actions to update the lobby state in a predictable and controlled manner. 
 * It is primarily used with React's `useReducer` hook in the lobby component.
 */

// Initial State for the lobby
export const INITIAL_LOBBY_STATE = {
    players: [], // List of players in the lobby
    messages: [], // Chat messages
    isGameStarted: false, // Indicates if the game has started
    isHost: false, // Whether the current user is the host
};

/**
 * Reducer for managing the lobby state.
 * 
 * @param {Object} state - The current state of the lobby.
 * @param {Object} action - The action to process.
 * @returns {Object} - The updated state.
 */
export const lobbyReducer = (state, action) => {
    console.log(`Reducer action received: ${action.type}`, action.payload);

    switch (action.type) {
        case "SET_PLAYERS": {
            // Updates the list of players in the lobby
            return {
                ...state,
                players: action.payload, // Replace the current players list
            };
        }

        case "ADD_PLAYER": {
            // Adds a player to the lobby
            return {
                ...state,
                players: [...state.players, action.payload],
            };
        }

        case "SET_IS_HOST": {
            // Marks the current user as the host
            return {
                ...state,
                isHost: true,
            };
        }

        case "ADD_MESSAGE": {
            if (!action.payload || typeof action.payload.sender !== "string" || typeof action.payload.content !== "string") {
                console.error("Invalid message payload.");
                return state;
            }
            return {
                ...state,
                messages: [...state.messages, action.payload],
            };
        }

        case "START_GAME": {
            // Updates the state when the game starts
            return {
                ...state,
                isGameStarted: true,
            };
        }

        case "REMOVE_PLAYER": {
            // Removes a player from the lobby
            return {
                ...state,
                players: state.players.filter(player => player.id !== action.payload.id),
            };
        }

        case "RESET_LOBBY": {
            // Resets the lobby state to initial values
            return { ...INITIAL_LOBBY_STATE };
        }

        default: {
            // Warn for unknown actions (disable in production)
            if (process.env.NODE_ENV !== "production") {
                console.warn(`Unknown action type: ${action.type}`);
            }
            return state; // Return the current state for unknown actions
        }
    }
};
