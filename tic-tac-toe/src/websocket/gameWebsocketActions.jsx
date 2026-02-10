// # Filename: src/components/websocket/gameWebsocketActions.jsx

/**
 * gameWebsocketActions.jsx
 *
 * Purpose
 * -------
 * Central router for inbound Game WebSocket messages.
 * Each key maps to a WS `type` and applies reducer updates and/or navigation.
 *
 * Design goals (production-grade)
 * ------------------------------
 * 1) Be defensive: tolerate partial payloads without throwing or corrupting state.
 * 2) Keep navigation correct: rematch navigation MUST set lobby context correctly to avoid
 *    backend "lobby/game mismatch" rejects (e.g., close code 4409).
 * 3) Avoid stale UI state: clear rematch UI before navigation.
 * 4) Never leak tokens; only log safe fields.
 *
 * Expected message shapes (server -> client)
 * -----------------------------------------
 * - connection_success:
 *   { type: "connection_success", message: string }
 *
 * - game_update:
 *   {
 *     type: "game_update",
 *     game_id: number,
 *     board_state: string (len 9, "_" for empty),
 *     current_turn: "X"|"O",
 *     winner?: "X"|"O"|null,
 *     is_completed?: boolean,
 *     winning_combination?: number[],
 *     player_x?: { id, first_name, ... },
 *     player_o?: { id, first_name, ... },
 *     player_role?: "X"|"O"|null
 *   }
 *
 * - session_established:
 *   { type: "session_established", lobbyId: number|string, sessionKey: string }
 *
 * - rematch_offer:
 *   {
 *     type: "rematch_offer",
 *     game_id: number,
 *     message?: string,
 *     requesterUserId?: number,
 *     receiverUserId?: number,
 *     rematchRequestedBy?: string,
 *     showActions?: boolean,
 *     uiMode?: string,
 *     createdAtMs?: number,
 *     isRematchOfferVisible?: boolean,
 *     rematchPending?: boolean
 *   }
 *
 * - rematch_start:
 *   {
 *     type: "rematch_start",
 *     new_game_id: number,
 *     // IMPORTANT: backend may send lobby_id, but client must treat new_game_id as authoritative
 *     lobby_id?: number,
 *     sessionKey?: string,
 *     new_invite_id?: string|number
 *   }
 *
 * - rematch_declined / rematch_expired:
 *   { type: "...", message?: string }
 */

import { showToast } from "../utils/toast/Toast";

const safeToIntString = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
};

const persistSessionKey = (lobbyId, sessionKey) => {
  try {
    if (!lobbyId || !sessionKey) return;
    const storageKey = `ttt:lobby_session_key:${String(lobbyId)}`;
    localStorage.setItem(storageKey, String(sessionKey));
  } catch (err) {
    // ignore (private mode / blocked storage)
  }
};

const gameWebsocketActions = (dispatch, navigate, gameId) => ({
  connection_success: (data) => {
    if (data?.message) showToast("success", data.message);
  },

  error: (data) => {
    showToast("error", data?.message || "An error occurred");
  },

  game_start_acknowledgment: (data) => {
    if (data?.message) showToast("success", data.message);
  },

  /**
   * Server game updates (authoritative state).
   * Keep payload validation minimal: reducer already normalizes.
   */
  game_update: (data) => {
    // Log safe fields only
    console.log("[WS] game_update:", {
      game_id: data?.game_id,
      has_board_state: Boolean(data?.board_state),
      current_turn: data?.current_turn,
      winner: data?.winner,
      is_completed: data?.is_completed,
    });

    if (!data?.board_state || !data?.current_turn) {
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
        winning_combination: Array.isArray(data.winning_combination) ? data.winning_combination : [],
        player_role: data.player_role,
        game_id: data.game_id,
      },
    });
  },

  /**
   * Extra safety: provider already persists, but keep it here too.
   */
  session_established: (data) => {
    const lobbyId = safeToIntString(data?.lobbyId);
    const sessionKey = data?.sessionKey ? String(data.sessionKey) : null;
    if (!lobbyId || !sessionKey) return;

    persistSessionKey(lobbyId, sessionKey);

    console.log("[WS] session_established persisted:", { lobbyId });
  },

  rematch_offer: (data) => {
    console.log("[WS] rematch_offer received:", {
      game_id: data?.game_id,
      requesterUserId: data?.requesterUserId,
      receiverUserId: data?.receiverUserId,
      uiMode: data?.uiMode,
    });

    dispatch({ type: "RECEIVE_RAW_REMATCH_OFFER", payload: data });

    dispatch({
      type: "SHOW_REMATCH_MODAL",
      payload: {
        game_id: data?.game_id,
        message: data?.message,
        rematchRequestedBy: data?.rematchRequestedBy,
        requesterUserId: data?.requesterUserId,
        receiverUserId: data?.receiverUserId,
        showActions: data?.showActions,
        uiMode: data?.uiMode,
        createdAtMs: data?.createdAtMs,
        isRematchOfferVisible: data?.isRematchOfferVisible ?? true,
        rematchPending: data?.rematchPending ?? true,
      },
    });
  },

  rematch_declined: (data) => {
    console.log("[WS] rematch_declined received:", data);

    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    showToast("info", data?.message || "Rematch declined.");
  },

  rematch_expired: (data) => {
    console.log("[WS] rematch_expired received:", data);

    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    showToast("info", data?.message || "Rematch request expired.");
  },

  /**
   * Rematch start:
   * The server instructs both clients to navigate to a NEW game id.
   *
   * CRITICAL RULE:
   * - Use new_game_id as the authoritative lobby context for the game socket.
   *   This prevents backend "lobby/game mismatch" rejects (close code 4409).
   */
  rematch_start: (data) => {
    console.log("[WS] rematch_start received:", {
      new_game_id: data?.new_game_id,
      lobby_id: data?.lobby_id,
      has_sessionKey: Boolean(data?.sessionKey),
      new_invite_id: data?.new_invite_id,
    });

    // Step 1: Clear rematch UI immediately
    dispatch({ type: "HIDE_REMATCH_MODAL" });
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    // Step 2: Validate required navigation fields
    const newGameId = safeToIntString(data?.new_game_id);
    if (!newGameId) {
      showToast("error", "Rematch failed: missing new game id.");
      return;
    }

    // Step 3: Build next URL
    // Authoritative lobby context MUST equal the new game id
    const qs = new URLSearchParams();
    qs.set("lobby", newGameId);

    // Prefer server-provided invite id if present
    if (data?.new_invite_id) qs.set("invite", String(data.new_invite_id));

    // Persist + include sessionKey if provided
    if (data?.sessionKey) {
      const sessionKey = String(data.sessionKey);
      persistSessionKey(newGameId, sessionKey);
      qs.set("sessionKey", sessionKey);
    }

    // Step 4: Navigate (microtask to allow reducer updates to flush)
    Promise.resolve().then(() => {
      const nextUrl = `/games/${newGameId}?${qs.toString()}`;
      navigate(nextUrl);
    });
  },
});

export default gameWebsocketActions;
