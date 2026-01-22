// # Filename: src/components/context/notificatonContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import config from "../../config";
import { useUserContext } from "./userContext";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

// ✅ New Code
import { useInviteContext } from "./inviteContext";

// Step 1: Invite inbox rehydrate API (REST)
import { fetchInvites } from "../../api/inviteApi";

export const NotificationContext = createContext(undefined);

/**
 * useNotification
 * ----------------------------
 * Custom hook to access the Notification WebSocket context.
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
 * Single global user WebSocket connection.
 *
 * Responsibilities (lock these in):
 * - Maintain 1 authenticated WS connection after login
 * - Route invite events -> InviteContext
 * - (Optional later) route presence + badge events to their own contexts
 *
 * Non-responsibilities:
 * - Does NOT store invites locally
 * - Does NOT mutate DM state
 * - Does NOT manage unread counts
 */
export const NotificationProvider = ({ children }) => {
  const { user } = useUserContext();

  // ✅ New Code: InviteContext is the single source of truth for invites
  const { upsertInvite, removeInvite, resetInvites } = useInviteContext();

  // Step 1: WebSocket refs & state
  const socketRef = useRef(null);
  const retryRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);

  // Step 2: Reconnect tuning
  const reconnectAttemptRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 8;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 15000;

  // Step 3: One-time auth refresh + reconnect guard
  const authRetryAttemptRef = useRef(false);

  /**
   * Step 4: Build notification WS URL
   */
  const buildNotificationUrl = (token) => {
    return `${config.websocketBaseUrl}/notifications/?token=${token}`;
  };

  /**
   * Step 5: Detect auth-like close
   */
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };

  /**
   * ✅ New Code
   * Step 6: Rehydrate pending invites via REST inbox
   *
   * Server truth -> reset -> upsert.
   * This prevents invite resurrection and duplicates on reconnect.
   */
  const rehydratePendingInvites = useCallback(async () => {
    try {
      const pending = await fetchInvites({ status: "pending", role: "to_user" });

      // Step 1: Reset to server truth
      resetInvites();

      // Step 2: Upsert each invite into InviteContext
      pending.forEach((invite) => upsertInvite(invite));
    } catch (err) {
      console.error("❌ Invite rehydrate failed:", err);
    }
  }, [resetInvites, upsertInvite]);

  /**
   * ✅ New Code
   * Step 7: Handle WS notifications (router only)
   */
  const handleNotificationMessage = useCallback(
    (rawEvent) => {
      let data;

      try {
        data = JSON.parse(rawEvent?.data || "{}");
      } catch (err) {
        console.error("❌ Notification WS: invalid JSON:", err);
        return;
      }

      // -------------------
      // INVITES (Invite v2)
      // -------------------
      if (data?.type === "invite_created" && data?.invite) {
        upsertInvite(data.invite);
        return;
      }

      if (data?.type === "invite_status" && data?.invite) {
        const inviteId = data.invite?.inviteId;
        const status = String(data.invite?.status || "").toLowerCase();

        // Locked UX rule:
        // After accept/decline/expire/cancel -> disappear immediately
        if (status && status !== "pending") {
          removeInvite(inviteId);
          return;
        }

        // If server ever sends pending updates, we can still upsert
        upsertInvite(data.invite);
        return;
      }

      // -------------------
      // PRESENCE (optional)
      // -------------------
      // If/when you move presence to this socket:
      // if (data?.type === "presence_update") { ... }

      // -------------------
      // DM BADGES (future)
      // -------------------
      // If/when you add badge reducer:
      // if (data?.type === "dm") { ... }
    },
    [upsertInvite, removeInvite]
  );

  /**
   * Step 8: Disconnect safely
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

      if (resetAttempts) {
        reconnectAttemptRef.current = 0;
        authRetryAttemptRef.current = false;
      }
    }
  };

  /**
   * Step 9: Connect WS
   */
  const connect = async ({ forceRefresh = false } = {}) => {
    await disconnect({ resetAttempts: false });

    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      console.warn("🔔 Notification socket: no valid token. Not connecting.");
      return;
    }

    const wsUrl = buildNotificationUrl(token);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = async () => {
      reconnectAttemptRef.current = 0;
      authRetryAttemptRef.current = false;

      setIsConnected(true);
      console.log("🔔 Notification socket connected.");

      // ✅ New Code: Rehydrate invites from server truth on connect
      await rehydratePendingInvites();
    };

    socket.onmessage = handleNotificationMessage;

    socket.onerror = (err) => {
      console.error("❌ Notification socket error:", err);
    };

    socket.onclose = (event) => {
      setIsConnected(false);

      if (!user?.id) {
        return;
      }

      // Auth-like close -> force refresh then reconnect once
      if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
        authRetryAttemptRef.current = true;

        retryRef.current = setTimeout(async () => {
          await connect({ forceRefresh: true });
        }, 250);

        return;
      }

      // Backoff reconnect
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

      retryRef.current = setTimeout(async () => {
        await connect({ forceRefresh: false });
      }, backoff);
    };
  };

  /**
   * Step 10: Auto-connect when user becomes available
   */
  useEffect(() => {
    if (!user?.id) {
      disconnect({ resetAttempts: true });
      return;
    }

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
