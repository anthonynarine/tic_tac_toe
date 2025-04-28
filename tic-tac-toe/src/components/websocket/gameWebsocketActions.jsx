import { showToast } from "../../utils/toast/Toast";

/**
 * Game WebSocket Actions
 * 
 * Defines handlers for specific WebSocket messages related to game events.
 * 
 * @param {function} dispatch - The dispatch function from the game reducer.
 * @param {function} navigate - The navigate function from react-router-dom.
 * @returns {Object} - Object containing WebSocket message handlers.
 */
const gameWebsocketActions = (dispatch, navigate, gameId) => ({
    /**
     * Handles WebSocket message for connection success.
     * Does not interact with a reducer.
     */
    connection_success: (data) => showToast("Success", data.message),

    /**
     * Handles WebSocket message for updating the player list.
     * Interacts with: `PLAYER_LIST` in the `lobbyReducer`.
     */
    update_player_list: (data) => {
        console.log("Player list update received:", data.players);
        dispatch({ type: "PLAYER_LIST", payload: data.players });
    },

    /**
     * Handles WebSocket message for game updates.
     * Interacts with: `UPDATE_GAME_STATE` in the `gameReducer`.
     */
    game_update: (data) => {

        console.log("Game update received:", data);
    
        if (!data.board_state || !data.current_turn) {
        showToast("error", "Invalid game update data received.");
        return;
        }
    
        dispatch({
        type: "UPDATE_GAME_STATE",
            payload: {
                board_state: data.board_state,
                current_turn: data.current_turn,
                winner: data.winner,
                player_x: data.player_x || { id: null, first_name: "Waiting..." },
                player_o: data.player_o || { id: null, first_name: "Waiting..." },
                is_completed: data.is_completed ?? false,
                winning_combination: data.winning_combination || [],
                player_role: data.player_role, 
                game_id: data.game_id,
            },
        });
    
        if (data.game_id) {
        navigate(`/games/${data.game_id}`);
        } else {
        showToast("error", "Game ID is missing in game update.");
        }
    },
    

    /**
     * Handles WebSocket message for game start acknowledgment.
     * Does not interact with a reducer.
     */
    game_start_acknowledgment: (data) => showToast("success", data.message),

    /**
     * Handles WebSocket message for errors.
     * Does not interact with a reducer.
     */
    error: (data) => showToast("error", data.message || "An error occurred"),

    /**
     * Handle a "rematch_offer" message fromt he server
     * Anoter player wants a rematch.
     * 
     */
    rematch_request: (data) => {
        console.log("Received a rematch request:", data);
        dispatch({
            type: "REMATCH_OFFER",
            playload: {
                fromUser: data.from_user || "Unknows",
                message: data.message
            },
        });
    },

    rematch_offer: (data) => {
        if (data.game_id !== gameId) {
            console.warn("Ignoring stale rematch_offer for old game:", data.game_id);
            return;
        }
    
        console.log("Rematch offer received:", data);
    
        // Step 1: Store the offer in state temporarily.
        dispatch({ type: "RECEIVE_RAW_REMATCH_OFFER", payload: data, });

        dispatch({
            type: "SHOW_REMATCH_MODAL",
            payload: {
                message: data.message,
                rematchRequestedBy: data.rematchRequestedBy,
                isRematchOfferVisible: data.isRematchOfferVisible,
                rematchPending: data.rematchPending,
            },
        });
    },
    
    

        /**
     * Handle a "rematch_start" message from the server.
     * The server includes new_game_id, so we can navigate to that new game.
     */
    rematch_start: (data) => {
        console.log("Rematch start with new game ID:", data.new_game_id);
    
        dispatch({ type: "HIDE_REMATCH_MODAL" });
    
        Promise.resolve().then(() => {
            navigate(`/games/${data.new_game_id}`);
        });
    },
    
        

});

export default gameWebsocketActions;
