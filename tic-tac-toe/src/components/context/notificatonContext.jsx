// # Filename: src/components/context/notificatonContext.jsx

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import config from "../../config";
import { useUserContext } from "./userContext";
import { useDirectMessage } from "./directMessageContext";
import { useUI } from "./uiContext";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";
import { DmActionTypes } from "../reducers/directMessaeReducer"; 

export const NotificationContext = createContext(undefined);

/**
 * useNotification
 * ----------------------------
 * Custom hook to access the Notification WebSocket context.
 *
 * Returns:
 *  - isConnected: boolean
 *  - reconnect: function (manual reconnect)
 *  - disconnect: function (manual disconnect)
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }

  return context;
};

/**
 * NotificationProvider
 * ----------------------------
 * Maintains a single WebSocket connection that delivers lightweight
 * notifications (e.g. DM message received, game invite received).
 *
 * Why this exists:
 * - DM sockets may only be opened when you actively chat with someone.
 * - This notifications socket is always-on (when logged in), so it can:
 *   - increment unread badges
 *   - wake up UI indicators
 *   - support recruiter mode (tab-scoped sessions) via tokenStore
 *
 * Expected backend messages:
 * - { type: "dm", sender_id: <id>, ... }
 * - { type: "game_invite", sender_id: <id>, ... }
 *
 * Recruiter Mode:
 * - This socket reads the access token via tokenStore.getToken()
 *   so it works whether tokens are stored in cookies/localStorage/sessionStorage.
 */
export const NotificationProvider = ({ children }) => {
  const { user } = useUserContext();
  const { isDMOpen } = useUI();

  // Step 1: DM context (we dispatch badge updates here)
  const dm = useDirectMessage();
  const activeFriendId = dm?.activeFriendId;
  const dispatch = dm?.dispatch;

  // Step 2: WebSocket refs & state
  const socketRef = useRef(null);
  const retryRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);

  // Step 3: Reconnect tuning
  const reconnectAttemptRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 8; // prevents infinite thrash
  const BASE_DELAY_MS = 1000; // 1s base
  const MAX_DELAY_MS = 15000; // cap backoff

  // Step 4: One-time "auth refresh + reconnect" guard
  const authRetryAttemptRef = useRef(false);

  /**
   * Step 5: Build the notification WebSocket URL.
   * Your config.websocketBaseUrl already ends with "/ws" in your project,
   * so we append "/notifications/".
   */
  const buildNotificationUrl = (token) => {
    return `${config.websocketBaseUrl}/notifications/?token=${token}`;
  };

  /**
   * Step 6: Detect auth-like close codes.
   *
   * Notes:
   * - If the WS handshake is rejected by the server (403), browsers often report 1006.
   * - If your server closes with a custom "unauthorized" code (like 4401), we handle that too.
   */
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);

    // Step 1: 4401 is a common "Unauthorized" WS close code
    if (code === 4401) return true;

    // Step 2: 1006 often indicates abnormal close (including handshake rejection)
    if (code === 1006) return true;

    // Step 3: Anything else -> treat as non-auth by default
    return false;
  };

  /**
   * Step 7: Decide whether an unread badge should increment.
   *
   * Rules:
   * - Only for DM + game_invite notifications
   * - Only if DM drawer is not open OR active chat is not this sender
   */
  const shouldIncrementUnread = ({ notifType, senderId }) => {
    if (!senderId) return false;
    if (notifType !== "dm" && notifType !== "game_invite") return false;

    // If the DM drawer is closed, always increment.
    if (!isDMOpen) return true;

    // If DM drawer is open but you're not chatting with this sender, increment.
    return String(activeFriendId) !== String(senderId);
  };

  /**
   * Step 8: Cleanly close socket + clear retry timers.
   *
   * Only reset reconnect counters when explicitly requested (logout/unmount).
   */
  const disconnect = async ({ resetAttempts = false } = {}) => {
    try {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;

        socketRef.current.close();
        socketRef.current = null;
      }
    } finally {
      setIsConnected(false);

      // Step 1: Only reset attempts when we explicitly disconnect (logout/unmount)
      if (resetAttempts) {
        reconnectAttemptRef.current = 0;
        authRetryAttemptRef.current = false;
      }
    }
  };

  /**
   * Step 9: Establish WebSocket connection.
   * - Uses ensureFreshAccessToken so WS never connects with an expired token
   * - reconnects with exponential backoff if closed unexpectedly
   *
   * - supports forceRefresh for auth-failure recovery
   */
  const connect = async ({ forceRefresh = false } = {}) => {
    // Step 9.1: Always close any existing socket before reconnecting (DO NOT reset attempts)
    await disconnect({ resetAttempts: false });

    // Step 9.2: Prefer a "fresh" access token (refresh if needed)
    // If forceRefresh is true, we use a huge TTL threshold to force a refresh attempt.
    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    // Step 9.3: If we still have no token, do not connect
    // (This can happen if refresh fails and tokens were cleared)
    if (!token) {
      console.warn("🔔 Notification socket: no valid token. Not connecting.");
      return;
    }

    const wsUrl = buildNotificationUrl(token);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      // Step 9.4: Reset reconnect counters only on success
      reconnectAttemptRef.current = 0;


      // Step 1: Reset auth retry guard on a successful connection
      authRetryAttemptRef.current = false;

      setIsConnected(true);
      console.log("🔔 Notification socket connected.");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Step 9.5: Minimal payload expectation
        const notifType = data?.type;
        const senderId = data?.sender_id;

        console.log("📥 Notification received:", data);

        // Step 9.6: Increment badge if appropriate
        if (shouldIncrementUnread({ notifType, senderId })) {
          if (typeof dispatch === "function") {
            dispatch({
              type: DmActionTypes.INCREMENT_UNREAD,
              payload: { friendId: senderId },
            });
          } else {
            console.warn(
              "Notification socket received an unread-worthy event, but DM dispatch is unavailable."
            );
          }
        }
      } catch (err) {
        console.error("❌ Notification socket message parse error:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("❌ Notification socket error:", err);
    };

    socket.onclose = (event) => {
      setIsConnected(false);

      // Step 9.7: If user is no longer present, don’t reconnect
      if (!user?.id) {
        console.log("🔔 Notification socket closed (no user).");
        return;
      }


      // Step 1: If this looks like an auth failure, try ONE forced refresh + reconnect
      if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
        authRetryAttemptRef.current = true;

        console.warn(
          `🔔 Notification socket auth-like close (code=${event.code}). Forcing refresh then reconnect...`
        );

        retryRef.current = setTimeout(async () => {
          await connect({ forceRefresh: true });
        }, 250);

        return;
      }

      // Step 9.8: Controlled reconnect loop (exponential backoff)
      reconnectAttemptRef.current += 1;

      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.warn(
          `🔔 Notification socket: max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}).`
        );
        return;
      }

      const backoff = Math.min(
        BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
        MAX_DELAY_MS
      );

      console.warn(
        `🔔 Notification socket closed (code=${event.code}). Reconnecting in ${backoff}ms...`
      );

      retryRef.current = setTimeout(async () => {
        await connect({ forceRefresh: false });
      }, backoff);
    };
  };

  /**
   * Step 10: Auto-connect when user becomes available.
   * Auto-disconnect on unmount or logout.
   */
  useEffect(() => {
    if (!user?.id) {
      // Step 10.1: user logged out
      disconnect({ resetAttempts: true });
      return;
    }

    // Step 10.2: user logged in
    connect({ forceRefresh: false });

    return () => {
      disconnect({ resetAttempts: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const contextValue = {
    isConnected,
    reconnect: async () => await connect({ forceRefresh: false }),
    disconnect: async () => await disconnect({ resetAttempts: true }),
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
