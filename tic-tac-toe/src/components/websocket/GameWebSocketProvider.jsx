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
 * - Connect to /ws/game/:gameId with Invite v2 OR sessionKey fallback
 * - Route messages through gameWebsocketActions
 * - Handle close codes with clear UX + safe reconnect logic
 *
 * Supported URL patterns:
 * - Invite v2:
 *   /games/:id?invite=<uuid>&lobby=<lobbyId>
 *
 * - Session fallback (no invite in URL):
 *   /games/:id?lobby=<lobbyId>&sessionKey=<sessionKey>
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

 
  // Step 2: distinguish intentional close (route change / rematch gameId swap)
  const intentionalCloseRef = useRef(false);

  // Step 3: Track mounted state to prevent reconnect after unmount
  const isMountedRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 8;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 15000;


  // Step 4: Local storage helpers for sessionKey per lobby
  const getSessionKeyStorageKey = (lobbyId) => `ttt:lobby_session_key:${String(lobbyId)}`;

  const persistSessionKey = useCallback((lobbyId, sessionKey) => {
    try {
      if (!lobbyId || !sessionKey) return;
      localStorage.setItem(getSessionKeyStorageKey(lobbyId), String(sessionKey));
    } catch (err) {
      // ignore (private mode / blocked storage)
    }
  }, []);

  const readPersistedSessionKey = useCallback((lobbyId) => {
    try {
      if (!lobbyId) return null;
      return localStorage.getItem(getSessionKeyStorageKey(lobbyId));
    } catch (err) {
      return null;
    }
  }, []);

  // Step 5: Normalize websocket base to always be ws(s)://host/ws
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

  // Step 6: Invite v2 final close codes (do not reconnect)
  const isFinalInviteClose = (event) => {
    const code = Number(event?.code);
    return code === 4403 || code === 4404 || code === 4408;
  };

  // Step 7: Close-code messages
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

  // Step 8: Treat handshake-ish errors as auth-like (one refresh retry)
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };


  // Step 9: Resolve context from URL + localStorage (single source of truth)
  const resolveConnectionContext = useCallback(() => {
    const params = new URLSearchParams(location.search);

    const inviteId = params.get("invite");
    const lobbyId = params.get("lobby");

    // allow either explicit sessionKey param or persisted (by lobbyId)
    const urlSessionKey = params.get("sessionKey");
    const persistedSessionKey = lobbyId ? readPersistedSessionKey(lobbyId) : null;

    return {
      inviteId,
      lobbyId,
      sessionKey: urlSessionKey || persistedSessionKey,
    };
  }, [location.search, readPersistedSessionKey]);

  // Step 10: Clear pending reconnect timer only
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Step 11: Cleanup helper (socket + timers)
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

  // Step 12: Hard-stop and route safe
  const stopAndRouteSafe = useCallback(
    (message) => {
      cleanupSocket();

      if (message) showToast("error", message);

      // Hub-safe fallback
      navigate("/", { replace: true });
    },
    [cleanupSocket, navigate]
  );

  // Step 13: Build WS URL (Invite v2 OR sessionKey)
  const buildGameWsUrl = useCallback(
    ({ token, inviteId, lobbyId, sessionKey }) => {
      const wsBase = getNormalizedWsBase();

      const qs = new URLSearchParams();
      qs.set("token", String(token));

      if (inviteId) qs.set("invite", String(inviteId));
      if (lobbyId) qs.set("lobby", String(lobbyId));
      if (!inviteId && sessionKey) qs.set("sessionKey", String(sessionKey));

      return `${wsBase}/game/${encodeURIComponent(
        String(effectiveGameId)
      )}/?${qs.toString()}`;
    },
    [effectiveGameId, getNormalizedWsBase]
  );

  // Step 14: Core connect logic
  const connectGameSocket = useCallback(
    async ({ forceRefresh = false } = {}) => {
      // Step 1: must have game id
      if (!effectiveGameId) return;

      // Step 2: only run if mounted (prevents reconnect-after-unmount)
      if (!isMountedRef.current) return;

      // Step 3: ensure no parallel sockets (close old gameId socket before new)
      cleanupSocket();

      // Step 4: resolve connection context
      const { inviteId, lobbyId, sessionKey } = resolveConnectionContext();

      // Step 5: guard — require invite OR sessionKey
      if (!inviteId && !sessionKey) {
        console.error("[GameWebSocket] Missing invite + sessionKey. Refusing to connect.", {
          effectiveGameId,
          lobbyId,
        });

        stopAndRouteSafe(
          "Missing invite/session. Please re-enter from your Invite Panel."
        );
        return;
      }

      // Step 6: token (explicit force refresh supported)
      const token = await ensureFreshAccessToken({
        minTtlSeconds: 60,
        forceRefresh,
      });

      if (!token) {
        stopAndRouteSafe("Authentication expired. Please log in again.");
        return;
      }

      // Step 7: Create WS
      const wsUrl = buildGameWsUrl({ token, inviteId, lobbyId, sessionKey });

      console.log("[GameWebSocket] Connecting:", {
        effectiveGameId,
        inviteId,
        lobbyId,
        sessionKeyPresent: Boolean(sessionKey),
        wsUrl,
      });

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

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

      const actions = gameWebsocketActions(dispatch, navigate, effectiveGameId);

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          if (!data?.type) return;

          // Step A: session established -> persist sessionKey for lobby
          if (data.type === "session_established") {
            persistSessionKey(data.lobbyId, data.sessionKey);
          }

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
      resolveConnectionContext,
      stopAndRouteSafe,
      buildGameWsUrl,
      clearReconnectTimer,
      navigate,
      persistSessionKey,
    ]
  );

  // Step 15: Connect when gameId exists and we have invite or sessionKey
  useEffect(() => {
    isMountedRef.current = true;

    if (!effectiveGameId) return () => {};

    didShowConnectedToastRef.current = false;
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectGameSocket({ forceRefresh: false });

    return () => {
      isMountedRef.current = false;
      cleanupSocket();
    };
  }, [effectiveGameId, connectGameSocket, cleanupSocket]);

  // Step 16: sendMessage helper
  const sendMessage = (message) => {
    const socket = socketRef.current;
    const isSocketOpen = socket && socket.readyState === WebSocket.OPEN;

    if (isSocketOpen) {
      socket.send(JSON.stringify(message));
      console.log("[sendMessage] Message sent:", message);
    } else {
      console.error("[sendMessage] Cannot send message: WebSocket is not connected.");
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
