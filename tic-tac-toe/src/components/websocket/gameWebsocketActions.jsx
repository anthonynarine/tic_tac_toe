import { showToast } from "../../utils/toast/Toast";

/**
 * Game Websocket Actions
 * 
 * Defines handlers for specific Websocket messages related to game events.
 * 
 * @params {function} dispatch - The dispatch function from the game reducer. 
 * @parmas {function} navigate - The navigate function
 */
const gameWebsocketActions = (dispatch, navigate) => ({
    connection_success: (data) => showToast("Success", data.message),

    player_list: (data) => {
        console.log("Player list update received:", data.players)
        dispatch({ type: "PLAYER_LIST", payload: data.players})
    },

    game_update: (data) => {
        console.log("Game update reeived:", data);

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
                player_x: data.player_x || { id: null, first_name: "Waiting..."},
                player_o: data.player_o || { id: null, first_name: "Waiting..."},
                game_id: data.game_id,
            },
        });

        if (data.game_id) {
            navigate(`/games/${data.game_id}`);
        } else {
            showToast("error", "Game ID is missing in game update")
        }
    },

    game_start_acknowledgment: (data) => showToast("success", data.message),

    error: (data) => showToast("error", data.message || "An error occured")
});

export default gameWebsocketActions;
