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
const gameWebsocketActions = (dispatch, navigate) => ({
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
});

export default gameWebsocketActions;
