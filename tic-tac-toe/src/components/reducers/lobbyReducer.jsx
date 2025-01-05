/**
 * Description:
 * This file defines the initial state and the reducer logic for managing the lobby state.
 * - `INITIAL_LOBBY_STATE`: Represents the default state of the lobby, including players, chat messages, and game status.
 * - `lobbyReducer`: A reducer function to handle state transitions for various lobby actions (e.g., adding players, handling chat messages, starting the game).
 * 
 * The reducer processes actions to update the lobby state in a predictable and controlled manner. 
 * It is primarily used with React's `useReducer` hook in the lobby component.
 */

/// Initial State for the lobby
export const INITIAL_LOBBY_STATE = {
    players: [], // List of players in the lobby
    messages: [], // Chat messages
    isGameStarted: false, // Indicates if the game has started
    game: null, // Stores game-related details (e.g., board state, current turn)
};

/**
 * Reducer for managing the lobby state.
 * 
 * @param {Object} state - The current state of the lobby.
 * @param {Object} action - The action to process.
 * @returns {Object} - The updated state.
 */
export const lobbyReducer = (state, action) => {
    // Log the received action (for development use only)
    if (process.env.NODE_ENV !== "production") {
        console.log(`Reducer action received: ${action.type}`, action.payload);
    }

    switch (action.type) {
        case "SET_PLAYERS": {
            console.log("Reducer action received: SET_GAME", action.payload);
            /**
             * Updates the list of players in the lobby.
             * 
             * @payload {Array} action.payload - The new list of players.
             */
            if (!Array.isArray(action.payload)) {
                console.error("Invalid SET_PLAYERS payload:", action.payload);
                return state;
            }
            return {
                ...state,
                players: action.payload,
            };
        }

        case "ADD_PLAYER": {
            /**
             * Adds a player to the lobby.
             * 
             * @payload {Object} action.payload - The player object to add (must contain an `id` field).
             */
            if (!action.payload || typeof action.payload.id === "undefined") {
                console.error("Invalid ADD_PLAYER payload:", action.payload);
                return state;
            }
            return {
                ...state,
                players: [...state.players, action.payload],
            };
        }

        case "PLAYER_LIST": {
            /**
             * Replaces the players list with the new list from the WebSocket.
             * Normalizes the structure to use `first_name` for frontend display.
             * 
             * @payload {Array} action.payload - List of players in the lobby.
             */
            if (!Array.isArray(action.payload)) {
                console.error("Invalid PLAYER_LIST payload:", action.payload);
                return state;
            }
        
            const normalizedPlayers = action.payload.map((player) => ({
                id: player.id,
                first_name: player.first_name || "Unknown", // Map `username` to `first_name` for compatibility
            }));
        
            return {
                ...state,
                players: normalizedPlayers,
            };
        }
        
        case "ADD_MESSAGE": {
            /**
             * Adds a chat message to the lobby.
             * 
             * @payload {Object} action.payload - The message object to add (must have `sender` and `content` properties).
             */
            if (
                !action.payload ||
                typeof action.payload.sender !== "string" ||
                typeof action.payload.content !== "string"
            ) {
                console.error("Invalid ADD_MESSAGE payload:", action.payload);
                return state;
            }
            return {
                ...state,
                messages: [...state.messages, action.payload],
            };
        }

        case "SET_GAME": {
            /**
             * Updates the state with game details (received from WebSocket `game_update` message).
             * 
             * @payload {Object} action.payload - Game-related details (e.g., board state, current turn, winner).
             */
            const { 
                board_state,
                current_turn,
                winner,
                player_x,
                player_o,
                player_role,
                game_id, // Included game_id to update state
            } = action.payload;
        
            // Debugging payload
            console.log("SET_GAME payload:", {
                board_state,
                current_turn,
                winner,
                player_x,
                player_o,
                player_role,
                game_id, // Log game_id for debugging
            });
        
            // Ensure player_x and player_o normalization
            const normalizedPlayerX = {
                id: player_x?.id || null, // Fallback to null if id is missing
                first_name: player_x?.first_name || "Unknown", // Fallback to "Unknown" if first_name is missing
            };
        
            const normalizedPlayerO = {
                id: player_o?.id || null, // Fallback to null if id is missing
                first_name: player_o?.first_name || "Unknown", // Fallback to "Unknown" if first_name is missing
            };
        
            return {
                ...state,
                game: {
                    board_state: board_state || "_________", // Fallback to default board state if missing
                    current_turn: current_turn || "", // Fallback to an empty string if current_turn is missing
                    winner: winner || null, // Ensure winner defaults to null
                    player_x: normalizedPlayerX, // Ensure normalized player_x structure
                    player_o: normalizedPlayerO, // Ensure normalized player_o structure
                },
                game_id, // Save game_id in the state for navigation
                playerRole: player_role || state.playerRole, // Update player role if provided, fallback to existing role
                isGameStarted: true, // Mark the game as started
            };
        }
            
        case "START_GAME": {
            /**
             * Updates the state to indicate the game has started.
             */
            return {
                ...state,
                isGameStarted: true,
            };
        }

        case "REMOVE_PLAYER": {
            /**
             * Removes a player from the lobby.
             * 
             * @payload {Object} action.payload - The player object to remove (must contain an `id` field).
             */
            if (!action.payload?.id) {
                console.error("Invalid REMOVE_PLAYER payload:", action.payload);
                return state;
            }
            return {
                ...state,
                players: state.players.filter(player => player.id !== action.payload.id),
            };
        }

        case "RESET_LOBBY": {
            /**
             * Resets the lobby state to its initial values.
             * Ensures the lobby returns to a clean slate.
             */
            return { ...INITIAL_LOBBY_STATE };
        }

        default: {
            /**
             * Handles unknown action types.
             * Warns in development mode and returns the current state unchanged.
             */
            if (process.env.NODE_ENV !== "production") {
                console.warn(`Unknown action type: ${action.type}`);
            }
            return state;
        }
    }
};
