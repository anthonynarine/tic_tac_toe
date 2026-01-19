// # Filename: src/components/websocket/gameWebsocketActions.jsx

import { showToast } from "../../utils/toast/Toast";

const gameWebsocketActions = (dispatch, navigate, gameId) => ({
  connection_success: (data) => showToast("success", data.message),

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
  },

  game_start_acknowledgment: (data) => showToast("success", data.message),

  error: (data) => showToast("error", data.message || "An error occurred"),


  rematch_offer: (data) => {
    console.log("[WS] rematch_offer received:", data);

    dispatch({ type: "RECEIVE_RAW_REMATCH_OFFER", payload: data });

    dispatch({
      type: "SHOW_REMATCH_MODAL",
      payload: {
        game_id: data.game_id,
        message: data.message,
        rematchRequestedBy: data.rematchRequestedBy,
        requesterUserId: data.requesterUserId,
        receiverUserId: data.receiverUserId,
        showActions: data.showActions,
        uiMode: data.uiMode,
        createdAtMs: data.createdAtMs,
        isRematchOfferVisible: data.isRematchOfferVisible ?? true,
        rematchPending: data.rematchPending ?? true,
      },
    });
  },


  rematch_declined: (data) => {
    console.log("[WS] rematch_declined received:", data);

    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    showToast("info", data.message || "Rematch declined.");
  },

  rematch_expired: (data) => {
    console.log("[WS] rematch_expired received:", data);

    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    showToast("info", data.message || "Rematch request expired.");
  },

  rematch_start: (data) => {
    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    Promise.resolve().then(() => {
      navigate(`/games/${data.new_game_id}`);
    });
  },
});

export default gameWebsocketActions;
