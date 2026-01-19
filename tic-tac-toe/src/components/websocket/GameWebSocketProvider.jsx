// # Filename: src/components/websocket/GameWebSocketProvider.jsx

import React, { useEffect, useRef, useReducer, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { GameWebSocketContext } from "./GameWebsocketContext";
import { showToast } from "../../utils/toast/Toast";
import gameWebsocketActions from "./gameWebsocketActions";
import { gameReducer, INITIAL_STATE } from "../reducers/gameReducer";
import config from "../../config";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

/**
 * GameWebSocketProvider
 *
 * Responsibilities:
 * - Connect to /ws/game/:gameId with strict Invite v2 parameters
 * - Route messages through gameWebsocketActions
 * - Handle close codes 4403/4404/4408 with clear UX
 *
 * Invite v2 invariant:
 * - game socket MUST include ?invite=<uuid>
 * - socket SHOULD include ?lobby=<lobbyId> when provided (lobby_id may differ from gameId)
 */
export const GameWebSocketProvider = ({ children, gameId }) => {
  const { id: routeGameId } = useParams();
  const effectiveGameId = gameId || routeGameId;

  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Step 1: Socket + reconnect refs
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const reconnectAttemptRef = useRef(0);
  const authRetryAttemptRef = useRef(false);
  const didShowConnectedToastRef = useRef(false);

  // distinguish intentional close (route change / rematch gameId swap)
  const intentionalCloseRef = useRef(false);

  // Step 2: Track mounted state to prevent reconnect after unmount
  const isMountedRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 8;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 15000;

  // Step 3: Normalize websocket base to always be ws(s)://host/ws
  const getNormalizedWsBase = useCallback(() => {
    const baseRaw = String(config.websocketBaseUrl || "").replace(/\/+$/, "");

    if (!baseRaw) {
      throw new Error(
        "GameWebSocketProvider: config.websocketBaseUrl is missing. It must point to ws(s)://<host> (optionally with /ws)."
      );
    }

    // If someone accidentally set http(s), convert to ws(s)
    const normalizedScheme = baseRaw.startsWith("http")
      ? baseRaw.replace(/^http/, "ws")
      : baseRaw;

    // Ensure it ends with /ws
    return normalizedScheme.endsWith("/ws")
      ? normalizedScheme
      : `${normalizedScheme}/ws`;
  }, []);

  // Step 4: Invite v2 final close codes (do not reconnect)
  const isFinalInviteClose = (event) => {
    const code = Number(event?.code);
    return code === 4403 || code === 4404 || code === 4408;
  };

  // Step 5: Close-code messages
  const inviteCloseCodeMessage = (code) => {
    switch (Number(code)) {
      case 4403:
        return "Invite forbidden. Only the invited user may join this lobby.";
      case 4404:
        return "Invalid invite. Please open the lobby from your Invite Panel.";
      case 4408:
        return "Invite expired. Ask your friend to send a new invite.";
      default:
        return null;
    }
  };

  // Step 6: Treat handshake-ish errors as auth-like (one refresh retry)
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };

  // Step 7: Resolve invite context from URL (single source of truth)
  const resolveInviteContext = useCallback(() => {
    const params = new URLSearchParams(location.search);
    return {
      inviteId: params.get("invite"),
      lobbyId: params.get("lobby"),
    };
  }, [location.search]);

  // Step 8: Clear pending reconnect timer only
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Step 9: Cleanup helper (socket + timers)
  const cleanupSocket = useCallback(() => {
    clearReconnectTimer();

    const ws = socketRef.current;
    if (ws) {
      try {
        // mark intentional close so onclose won't reconnect the old gameId
        intentionalCloseRef.current = true;

        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;

        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
      } catch (err) {
        // ignore
      }
    }

    socketRef.current = null;
    setIsConnected(false);
  }, [clearReconnectTimer]);

  // Step 10: Hard-stop and route safe
  const stopAndRouteSafe = useCallback(
    (message) => {
      cleanupSocket();

      if (message) showToast("error", message);

      // Hub-safe fallback
      navigate("/", { replace: true });
    },
    [cleanupSocket, navigate]
  );

  // Step 11: Build WS URL (single responsibility)
  const buildGameWsUrl = useCallback(
    ({ token, inviteId, lobbyId }) => {
      // Step 1: Normalize base (ws(s)://host/ws)
      const wsBase = getNormalizedWsBase();

      // Step 2: Build query params safely
      const qs = new URLSearchParams();
      qs.set("token", String(token));

      // Step 3: Invite v2 is OPTIONAL for rematch/reconnect resilience.
      // Backend guard only runs if invite is present.
      if (inviteId) {
        qs.set("invite", String(inviteId));
      }

      // Step 4: Lobby is optional (helpful for context/cleanup)
      if (lobbyId) {
        qs.set("lobby", String(lobbyId));
      }

      // Step 5: Construct final WS URL
      return `${wsBase}/game/${encodeURIComponent(
        String(effectiveGameId)
      )}/?${qs.toString()}`;
    },
    [effectiveGameId, getNormalizedWsBase]
  );

  // Step 12: Core connect logic
  const connectGameSocket = useCallback(
    async ({ forceRefresh = false } = {}) => {
      // Step 1: must have game id
      if (!effectiveGameId) return;

      // Step 2: only run if mounted (prevents reconnect-after-unmount)
      if (!isMountedRef.current) return;

      // Step 3: ensure no parallel sockets (close old gameId socket before new)
      cleanupSocket();

      // Step 4: invite context (Invite v2 REQUIRED)
      const { inviteId, lobbyId } = resolveInviteContext();

      if (!inviteId) {
      console.warn("[GameWebSocket] Missing invite param. Connecting without invite.");

      }
      // Step 5: token (explicit force refresh supported)
      const token = await ensureFreshAccessToken({
        minTtlSeconds: 60,
        forceRefresh,
      });

      if (!token) {
        stopAndRouteSafe("Authentication expired. Please log in again.");
        return;
      }

      // Step 6: Create WS
      const wsUrl = buildGameWsUrl({ token, inviteId, lobbyId });

      console.log("[GameWebSocket] Connecting:", {
        effectiveGameId,
        inviteId,
        lobbyId,
        wsUrl,
      });

      // reset the intentional close flag for this new socket instance
      intentionalCloseRef.current = false;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      // actions are bound to THIS socket + THIS gameId (prevents cross-game routing)
      const actions = gameWebsocketActions(dispatch, navigate, effectiveGameId);

      ws.onopen = () => {
        if (!isMountedRef.current) return;

        setIsConnected(true);

        reconnectAttemptRef.current = 0;
        authRetryAttemptRef.current = false;

        if (!didShowConnectedToastRef.current) {
          didShowConnectedToastRef.current = true;
          showToast("success", "Successfully connected to the game WebSocket.");
        }

        console.log(`[GameWebSocket] Connected for game: ${effectiveGameId}`);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          if (!data?.type) return;

          const handler = actions[data.type];
          if (handler) handler(data);
        } catch (err) {
          console.error("[GameWebSocket] JSON parse error:", err);
        }
      };

      ws.onerror = (err) => {
        if (!isMountedRef.current) return;
        console.error("[GameWebSocket] socket error:", err);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;

        // Step 0: If we intentionally closed (route change / gameId swap), do NOT reconnect.
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false; // reset for future real disconnects

          console.log("[GameWebSocket] Closed intentionally.", {
            code: event?.code,
            reason: event?.reason,
          });

          setIsConnected(false);
          clearReconnectTimer();
          reconnectAttemptRef.current = 0;
          authRetryAttemptRef.current = false;

          return;
        }

        console.warn("[GameWebSocket] Disconnected.", {
          code: event?.code,
          reason: event?.reason,
        });

        setIsConnected(false);

        // Step 1: final invite close => stop
        if (isFinalInviteClose(event)) {
          stopAndRouteSafe(
            inviteCloseCodeMessage(event?.code) ||
              "Unable to stay connected due to invite rules."
          );
          return;
        }

        // Step 2: one-time auth-like retry (force refresh)
        if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
          authRetryAttemptRef.current = true;

          clearReconnectTimer();

          reconnectTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;
            await connectGameSocket({ forceRefresh: true });
          }, 250);

          return;
        }

        // Step 3: exponential backoff reconnect
        reconnectAttemptRef.current += 1;

        // Step 3a: If we can't reconnect, route safe (avoid broken game screen)
        if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
          stopAndRouteSafe(
            "Unable to reconnect to the game. Please reopen the invite."
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

        clearReconnectTimer();

        reconnectTimeoutRef.current = setTimeout(async () => {
          if (!isMountedRef.current) return;
          await connectGameSocket({ forceRefresh: false });
        }, backoff);
      };
    },
    [
      effectiveGameId,
      cleanupSocket,
      resolveInviteContext,
      stopAndRouteSafe,
      buildGameWsUrl,
      clearReconnectTimer,
      navigate
    ]
  );

  // Step 13: Connect only when ALL required context exists
  useEffect(() => {
    isMountedRef.current = true;

    const { inviteId } = resolveInviteContext();

    if (!effectiveGameId) return () => {};
    if (!inviteId) return () => {};

    didShowConnectedToastRef.current = false;
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectGameSocket({ forceRefresh: false });

    return () => {
      isMountedRef.current = false;
      cleanupSocket();
    };
  }, [effectiveGameId, resolveInviteContext, connectGameSocket, cleanupSocket]);

  // Step 14: sendMessage helper
  const sendMessage = (message) => {
    const socket = socketRef.current;
    const isSocketOpen = socket && socket.readyState === WebSocket.OPEN;

    if (isSocketOpen) {
      socket.send(JSON.stringify(message));
      console.log("[sendMessage] Message sent:", message);
    } else {
      console.error(
        "[sendMessage] Cannot send message: WebSocket is not connected."
      );
    }
  };

  return (
    <GameWebSocketContext.Provider
      value={{
        state,
        dispatch,
        sendMessage,
        isConnected,
      }}
    >
      {children}
    </GameWebSocketContext.Provider>
  );
};
