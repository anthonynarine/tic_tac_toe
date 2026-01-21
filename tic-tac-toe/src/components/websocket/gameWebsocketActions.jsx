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


  // If backend sends this, persist it here too (provider already persists; this is extra safety)
  session_established: (data) => {
    try {
      if (!data?.lobbyId || !data?.sessionKey) return;

      const storageKey = `ttt:lobby_session_key:${String(data.lobbyId)}`;
      localStorage.setItem(storageKey, String(data.sessionKey));

      console.log("[WS] session_established persisted:", {
        lobbyId: data.lobbyId,
      });
    } catch (err) {
      // ignore (private mode / blocked storage)
    }
  },

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
    console.log("[WS] rematch_start received:", data);

    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    Promise.resolve().then(() => {
      // Step 1: Build next URL with Invite v2 OR session fallback
      const qs = new URLSearchParams();

      // Prefer server-provided fields (most reliable)
      if (data.new_invite_id) qs.set("invite", String(data.new_invite_id));
      if (data.lobby_id) qs.set("lobby", String(data.lobby_id));

      // Step 1a: If server sends sessionKey, persist it + include it
      if (data.lobby_id && data.sessionKey) {
        try {
          const storageKey = `ttt:lobby_session_key:${String(data.lobby_id)}`;
          localStorage.setItem(storageKey, String(data.sessionKey));
          qs.set("sessionKey", String(data.sessionKey));
        } catch (err) {
          // ignore
        }
      }

      // Session fallback (if no invite)
      if (!data.new_invite_id && !qs.get("sessionKey")) {
        const lobbyId =
          data.lobby_id || new URLSearchParams(window.location.search).get("lobby");

        if (lobbyId) {
          qs.set("lobby", String(lobbyId));

          const storedKey = `ttt:lobby_session_key:${String(lobbyId)}`;
          const sessionKey = localStorage.getItem(storedKey);

          if (sessionKey) qs.set("sessionKey", String(sessionKey));
        }
      }

      // Step 2: Navigate to the new game route
      const nextUrl = qs.toString()
        ? `/games/${data.new_game_id}?${qs.toString()}`
        : `/games/${data.new_game_id}`;

      navigate(nextUrl);
    });
  },

});

export default gameWebsocketActions;
