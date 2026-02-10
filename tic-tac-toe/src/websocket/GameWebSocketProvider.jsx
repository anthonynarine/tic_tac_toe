// # Filename: src/components/websocket/GameWebSocketProvider.jsx
"use strict";

import React, { useEffect, useRef, useReducer, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { GameWebSocketContext } from "./GameWebsocketContext";
import { showToast } from "../utils/toast/Toast";
import gameWebsocketActions from "./gameWebsocketActions";
import { gameReducer, INITIAL_STATE } from "../reducers/gameReducer";

import config from "../config";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

export const GameWebSocketProvider = ({ children, gameId }) => {
  const { id: routeGameId } = useParams();
  const effectiveGameId = gameId || routeGameId;

  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mode = queryParams.get("mode");
  const isAIMode = mode === "ai";

  // Step 1: Socket + reconnect refs
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const reconnectAttemptRef = useRef(0);
  const authRetryAttemptRef = useRef(false);
  const didShowConnectedToastRef = useRef(false);

  // Step 2: Per-socket identity + intentional close tracking (race-proof)
  const nextSocketIdRef = useRef(0);
  const activeSocketIdRef = useRef(null);
  const intentionallyClosedIdsRef = useRef(new Set());

  // Step 3: Track mounted state to prevent reconnect after unmount
  const isMountedRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 8;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 15000;

  const getSessionKeyStorageKey = (lobbyId) => `ttt:lobby_session_key:${String(lobbyId)}`;

  const persistSessionKey = useCallback((lobbyId, sessionKey) => {
    try {
      if (!lobbyId || !sessionKey) return;
      localStorage.setItem(getSessionKeyStorageKey(lobbyId), String(sessionKey));
    } catch (err) {}
  }, []);

  const readPersistedSessionKey = useCallback((lobbyId) => {
    try {
      if (!lobbyId) return null;
      return localStorage.getItem(getSessionKeyStorageKey(lobbyId));
    } catch (err) {
      return null;
    }
  }, []);

  const getNormalizedWsBase = useCallback(() => {
    const baseRaw = String(config.websocketBaseUrl || "").replace(/\/+$/, "");
    if (!baseRaw) {
      throw new Error(
        "GameWebSocketProvider: config.websocketBaseUrl is missing. It must point to ws(s)://<host> (optionally with /ws)."
      );
    }
    const normalizedScheme = baseRaw.startsWith("http") ? baseRaw.replace(/^http/, "ws") : baseRaw;
    return normalizedScheme.endsWith("/ws") ? normalizedScheme : `${normalizedScheme}/ws`;
  }, []);

  const isFinalInviteClose = (event) => {
    const code = Number(event?.code);
    return code === 4403 || code === 4404 || code === 4408;
  };

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

  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };

  // ✅ Step 4: Resolve params safely + prevent lobby/game mismatch loops (4409)
  const resolveConnectionContext = useCallback(() => {
    const params = new URLSearchParams(location.search);

    const inviteId = params.get("invite");

    // Step 1: Accept any of these param spellings (defense-in-depth)
    const lobbyFromQuery = params.get("lobby") || params.get("lobbyId") || params.get("lobby_id");

    // Step 2: Non-invite game route MUST use lobbyId == effectiveGameId (hard-guard safe)
    const normalizedGameId = String(effectiveGameId);
    const lobbyId = inviteId ? String(lobbyFromQuery || normalizedGameId) : normalizedGameId;

    const urlSessionKey = params.get("sessionKey");
    const persistedSessionKey = lobbyId ? readPersistedSessionKey(lobbyId) : null;

    return {
      inviteId,
      lobbyId,
      sessionKey: urlSessionKey || persistedSessionKey,
    };
  }, [location.search, effectiveGameId, readPersistedSessionKey]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Step 5: Cleanup helper (socket + timers) with intentional-close-per-socket
  const cleanupSocket = useCallback(() => {
    clearReconnectTimer();

    const ws = socketRef.current;
    if (ws) {
      try {
        const wsId = ws.__socketId;
        if (wsId != null) intentionallyClosedIdsRef.current.add(wsId);

        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;

        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch (err) {}
    }

    socketRef.current = null;
    activeSocketIdRef.current = null;
    setIsConnected(false);
  }, [clearReconnectTimer]);

  const stopAndRouteSafe = useCallback(
    (message) => {
      cleanupSocket();
      if (message) showToast("error", message);
      navigate("/", { replace: true });
    },
    [cleanupSocket, navigate]
  );

  const buildGameWsUrl = useCallback(
    ({ token, inviteId, lobbyId, sessionKey }) => {
      const wsBase = getNormalizedWsBase();

      const qs = new URLSearchParams();
      qs.set("token", String(token));

      // Step 1: always use canonical query param name: "lobby"
      if (inviteId) qs.set("invite", String(inviteId));
      if (lobbyId) qs.set("lobby", String(lobbyId));
      if (!inviteId && sessionKey) qs.set("sessionKey", String(sessionKey));

      return `${wsBase}/game/${encodeURIComponent(String(effectiveGameId))}/?${qs.toString()}`;
    },
    [effectiveGameId, getNormalizedWsBase]
  );

  const connectGameSocket = useCallback(
    async ({ forceRefresh = false } = {}) => {
      if (isAIMode) {
        cleanupSocket();
        return;
      }

      if (!effectiveGameId) return;
      if (!isMountedRef.current) return;

      // Step 1: Close any previous socket first
      cleanupSocket();

      const { inviteId, lobbyId, sessionKey } = resolveConnectionContext();

      // Step 2: Hard guard — if we somehow got here with mismatch, fix it (non-invite)
      // (resolveConnectionContext already forces this, but keep this as a belt & suspenders)
      const safeLobbyId = inviteId ? String(lobbyId) : String(effectiveGameId);

      if (!inviteId && !sessionKey) {
        console.error("[GameWebSocket] Missing invite + sessionKey. Refusing to connect.", {
          effectiveGameId,
          lobbyId: safeLobbyId,
        });
        stopAndRouteSafe("Missing invite/session. Please re-enter from your Invite Panel.");
        return;
      }

      const token = await ensureFreshAccessToken({ minTtlSeconds: 60, forceRefresh });
      if (!token) {
        stopAndRouteSafe("Authentication expired. Please log in again.");
        return;
      }

      const wsUrl = buildGameWsUrl({ token, inviteId, lobbyId: safeLobbyId, sessionKey });

      // Step 3: Create a new socket id and set it active
      const socketId = ++nextSocketIdRef.current;
      activeSocketIdRef.current = socketId;

      console.log("[GameWebSocket] Connecting:", {
        effectiveGameId,
        inviteId,
        lobbyId: safeLobbyId,
        sessionKeyPresent: Boolean(sessionKey),
        socketId,
      });

      const ws = new WebSocket(wsUrl);
      ws.__socketId = socketId;
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        if (activeSocketIdRef.current !== socketId) return;

        setIsConnected(true);
        reconnectAttemptRef.current = 0;
        authRetryAttemptRef.current = false;

        if (!didShowConnectedToastRef.current) {
          didShowConnectedToastRef.current = true;
          showToast("success", "Successfully connected to the game WebSocket.");
        }

        console.log(`[GameWebSocket] Connected for game: ${effectiveGameId}`, { socketId });
      };

      const actions = gameWebsocketActions(dispatch, navigate, effectiveGameId);

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        if (activeSocketIdRef.current !== socketId) return;

        try {
          const data = JSON.parse(event.data);
          if (!data?.type) return;

          // Step 4: Persist session key using best-available lobby id fields
          if (data.type === "session_established") {
            const lobbyFromPayload =
              data.lobbyId || data.lobby_id || data.lobby || data.game_id || data.gameId || safeLobbyId;

            if (lobbyFromPayload && data.sessionKey) {
              persistSessionKey(String(lobbyFromPayload), String(data.sessionKey));
            }
          }

          const handler = actions[data.type];
          if (handler) handler(data);
        } catch (err) {
          console.error("[GameWebSocket] JSON parse error:", err);
        }
      };

      ws.onerror = (err) => {
        if (!isMountedRef.current) return;
        if (activeSocketIdRef.current !== socketId) return;
        console.error("[GameWebSocket] socket error:", err);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;

        // Step 5: If this close is for an old socket, ignore entirely
        if (activeSocketIdRef.current !== socketId) return;

        // Step 6: If THIS socket was intentionally closed, don’t reconnect
        if (intentionallyClosedIdsRef.current.has(socketId)) {
          intentionallyClosedIdsRef.current.delete(socketId);

          console.log("[GameWebSocket] Closed intentionally.", {
            code: event?.code,
            reason: event?.reason,
            socketId,
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
          socketId,
        });

        setIsConnected(false);

        // Step 7: Invite terminal close codes should route away (no reconnect loop)
        if (isFinalInviteClose(event)) {
          stopAndRouteSafe(inviteCloseCodeMessage(event?.code) || "Unable to stay connected due to invite rules.");
          return;
        }

        // Step 8: Auth retry path
        if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
          authRetryAttemptRef.current = true;

          clearReconnectTimer();
          reconnectTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;
            await connectGameSocket({ forceRefresh: true });
          }, 250);

          return;
        }

        // Step 9: Backoff reconnect
        reconnectAttemptRef.current += 1;
        if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
          stopAndRouteSafe("Unable to reconnect to the game. Please reopen the invite.");
          return;
        }

        const backoff = Math.min(BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1), MAX_DELAY_MS);

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
      isAIMode,
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

  // Step 6: Reset reducer state on game swap (prevents stale UI/state)
  useEffect(() => {
    if (!effectiveGameId) return;
    dispatch({ type: "RESET_GAME_STATE" });
  }, [effectiveGameId]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!effectiveGameId) return () => {};

    didShowConnectedToastRef.current = false;
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    if (isAIMode) {
      cleanupSocket();
      return () => {
        isMountedRef.current = false;
        cleanupSocket();
      };
    }

    connectGameSocket({ forceRefresh: false });

    return () => {
      isMountedRef.current = false;
      cleanupSocket();
    };
  }, [effectiveGameId, isAIMode, connectGameSocket, cleanupSocket]);

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
        isConnected: isAIMode ? false : isConnected,
        isAIMode,
      }}
    >
      {children}
    </GameWebSocketContext.Provider>
  );
};
