// # Filename: src/components/websocket/gameWebsocketActions.jsx

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
  connection_success: (data) => showToast("success", data.message),

  /**
   * Handles WebSocket message for game state updates.
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
   * Handle a "rematch_offer" message from the server.
   * Both clients receive it, but only the receiver gets showActions=true.
   */
  rematch_offer: (data) => {
    if (data.game_id !== gameId) {
      console.warn("Ignoring stale rematch_offer for old game:", data.game_id);
      return;
    }


    console.log("[REMATCH][offer received]", {
      ts: Date.now(),
      gameId,
      requesterUserId: data.requesterUserId,
      receiverUserId: data.receiverUserId,
      showActions: data.showActions,
      uiMode: data.uiMode,
      rematchRequestedBy: data.rematchRequestedBy,
      fullPayload: data,
    });

    // Step 1: Store the raw offer in state (debug + reducer truth)
    dispatch({
      type: "RECEIVE_RAW_REMATCH_OFFER",
      payload: { ...data, receivedAtMs: Date.now() },
    });

    // Step 2: Open the modal using server-authoritative flags
    dispatch({
      type: "SHOW_REMATCH_MODAL",
      payload: {
        message: data.message,
        rematchRequestedBy: data.rematchRequestedBy,
        isRematchOfferVisible: data.isRematchOfferVisible,
        rematchPending: data.rematchPending,
        requesterUserId: data.requesterUserId,
        receiverUserId: data.receiverUserId,
        showActions: data.showActions,
        uiMode: data.uiMode,
        createdAtMs: data.createdAtMs,
        game_id: data.game_id,
      },
    });
  },

  /**
   * Handle a "rematch_start" message from the server.
   * The server indicates a new game has been created.
   * The frontend should clear rematch state and navigate to the new game.
   */
  rematch_start: (data) => {
    console.log("Rematch start with new game ID:", data.new_game_id);

    dispatch({ type: "HIDE_REMATCH_MODAL" });


    dispatch({ type: "CLEAR_REMATCH_STATE" });

    Promise.resolve().then(() => {
      navigate(`/games/${data.new_game_id}`);
    });
  },
});

export default gameWebsocketActions;
