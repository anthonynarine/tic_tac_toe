// # Filename: src/components/websocket/GameWebSocketProvider.jsx

import React, { useEffect, useRef, useReducer, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { GameWebSocketContext } from "./GameWebsocketContext";
import { showToast } from "../../utils/toast/Toast";
import gameWebsocketActions from "./gameWebsocketActions";
import { gameReducer, INITIAL_STATE } from "../reducers/gameReducer";
import config from "../../config";

// Step 1: Ensure WS connects with a fresh access token (refresh if needed)
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

/**
 * GameWebSocketProvider
 *
 * Manages the WebSocket connection + game state for a specific gameId.
 *
 * Key upgrades:
 * - Step 1: Refresh-before-connect for WS (WebSockets don’t benefit from axios interceptors)
 * - Step 2: One-time forced refresh retry on auth-like close (4401 / 1006)
 * - Step 3: Controlled reconnect with exponential backoff (prevents infinite thrash)
 * - Step 4: Invite v2 join-guard support (?invite=<uuid>) + deterministic UX on 4403/4404/4408
 */
export const GameWebSocketProvider = ({ children, gameId }) => {
  const { id: routeGameId } = useParams();
  const effectiveGameId = gameId || routeGameId;

  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);

  const lastRematchOfferRef = useRef({ gameId: null, createdAtMs: null });

  const navigate = useNavigate();
  const location = useLocation(); 


  // Step 1: Extract inviteId (if user arrived via invite link like /game/:id?invite=<uuid>)
  const inviteIdFromUrl = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("invite");
  }, [location.search]);

  // Step 1: Refs for socket + reconnect control
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const reconnectAttemptRef = useRef(0);
  const authRetryAttemptRef = useRef(false);

  // Step 2: Avoid toast spam on reconnects
  const didShowConnectedToastRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 8;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 15000;


  // Step 2: Invite v2 join-guard close codes: do NOT reconnect, show user-facing reason
  const inviteCloseCodeMessage = (code) => {
    if (code === 4403) return "You can’t join this lobby (forbidden).";
    if (code === 4404)
      return "This invite is invalid or doesn’t match this lobby.";
    if (code === 4408)
      return "This invite has expired. Ask for a new invite.";
    return null;
  };


  // Step 3: Determine whether we should stop reconnecting
  const isFinalInviteClose = (event) => {
    const code = Number(event?.code);
    return code === 4403 || code === 4404 || code === 4408;
  };

  // Step 3: Auth-like close detection
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);

    // Step 1: 4401 (Unauthorized) if you close with that server-side
    if (code === 4401) return true;

    // Step 2: 1006 is a common browser code for abnormal close / handshake rejection
    if (code === 1006) return true;

    return false;
  };

  // Step 4: Cleanup helper
  const cleanupSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      try {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;

        socketRef.current.close();
      } catch (err) {
        // ignore close errors
      }

      socketRef.current = null;
    }

    setIsConnected(false);
  };

  // Step 5: Connect WS with refresh-before-connect behavior
  const connectGameSocket = async ({ forceRefresh = false } = {}) => {
    if (!effectiveGameId) return;

    // Step 1: cleanup old socket first (don’t reset counters here)
    cleanupSocket();

    // Step 2: Ensure a fresh access token for WS handshake
    const token = await ensureFreshAccessToken({
      // forceRefresh => huge threshold means "refresh now"
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      console.error("[GameWebSocket] No valid token. Cannot connect.");
      return;
    }

    // Step 3: Build the WS URL using URLSearchParams (supports ?invite=... join guard)
    const qs = new URLSearchParams();
    qs.set("token", token);

    // Invite v2 join guard expects ?invite=<uuid> for lobby join validation. :contentReference[oaicite:0]{index=0}
    if (inviteIdFromUrl) {
      qs.set("invite", inviteIdFromUrl);
    }

    const wsUrl = `${config.websocketBaseUrl}/game/${effectiveGameId}/?${qs.toString()}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);

      // Step 3: successful open resets reconnect counters
      reconnectAttemptRef.current = 0;
      authRetryAttemptRef.current = false;

      // Step 4: only toast once per mount/session
      if (!didShowConnectedToastRef.current) {
        didShowConnectedToastRef.current = true;
        showToast("success", "Successfully connected to the game WebSocket.");
      }

      console.log(`[GameWebSocket] Connected for game: ${effectiveGameId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data) return;

        // (dedupe rematch_offer)
        if (data.type === "rematch_offer") {
          const incomingGameId = String(data.game_id);
          const incomingCreatedAt = Number(data.createdAtMs);

          const last = lastRematchOfferRef.current;
          const isDuplicate =
            last.gameId === incomingGameId &&
            last.createdAtMs === incomingCreatedAt;

          if (isDuplicate) {
            console.warn("[REMATCH][dedupe] duplicate offer ignored:", data);
            return;
          }

          lastRematchOfferRef.current = {
            gameId: incomingGameId,
            createdAtMs: incomingCreatedAt,
          };
        }

        console.log("[GameWebSocket] Message received:", data);

        const actions = gameWebsocketActions(dispatch, navigate, effectiveGameId);
        if (actions[data.type]) actions[data.type](data);
      } catch (err) {
        console.error("[GameWebSocket] JSON parse error:", err);
      }
    };

    ws.onclose = (event) => {
      console.warn("[GameWebSocket] Disconnected.", {
        code: event?.code,
        reason: event?.reason,
      });

      setIsConnected(false);

      // Step 1: Invite v2 close codes are FINAL. Show message and stop reconnect.
      if (isFinalInviteClose(event)) {
        const code = Number(event?.code);
        const msg =
          inviteCloseCodeMessage(code) ||
          "Unable to join this lobby due to invite rules.";

        showToast("error", msg);

        // Step 2: Optional safe navigation (prevents user being stuck on a broken game route)
        navigate("/lobby");
        return;
      }

      // Step 2: One-time auth refresh retry (prevents loops)
      if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
        authRetryAttemptRef.current = true;

        reconnectTimeoutRef.current = setTimeout(async () => {
          await connectGameSocket({ forceRefresh: true });
        }, 250);

        return;
      }

      // Step 3: Controlled reconnect with backoff
      reconnectAttemptRef.current += 1;

      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.warn(
          `[GameWebSocket] Max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}).`
        );
        return;
      }

      const backoff = Math.min(
        BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
        MAX_DELAY_MS
      );

      console.warn(
        `[GameWebSocket] Reconnecting in ${backoff}ms (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
      );

      reconnectTimeoutRef.current = setTimeout(async () => {
        await connectGameSocket({ forceRefresh: false });
      }, backoff);
    };
  };

  // Step 6: Connect on mount / gameId change, cleanup on unmount
  useEffect(() => {
    if (!effectiveGameId) {
      console.error("[GameWebSocket] effectiveGameId is undefined");
      return;
    }

    // Step 1: Clear any stale rematch UI/state when entering a different game route
    dispatch({ type: "CLEAR_REMATCH_STATE" });

    didShowConnectedToastRef.current = false;
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectGameSocket({ forceRefresh: false });

    return () => {
      cleanupSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveGameId, inviteIdFromUrl]); // 

  // Step 7: sendMessage remains the same, but now benefits from robust connection lifecycle
  const sendMessage = (message) => {
    const socket = socketRef.current;

    const isSocketOpen = socket && socket.readyState === WebSocket.OPEN;

    console.log("[sendMessage] isConnected state:", isConnected);
    console.log("[sendMessage] socketRef exists:", !!socket);
    console.log("[sendMessage] socket.readyState:", socket?.readyState);

    if (isSocketOpen) {
      socket.send(JSON.stringify(message));
      console.log("[sendMessage] Message sent:", message);
    } else {
      console.error(
        "[sendMessage] Cannot send message: WebSocket is not connected or open."
      );
    }
  };

  const contextValue = {
    state,
    dispatch,
    sendMessage,
    isConnected,
  };

  return (
    <GameWebSocketContext.Provider value={contextValue}>
      {children}
    </GameWebSocketContext.Provider>
  );
};
