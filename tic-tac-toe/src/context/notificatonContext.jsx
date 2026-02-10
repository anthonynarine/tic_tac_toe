// # Filename: src/components/context/notificatonContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import config from "../config";
import { useUserContext } from "./userContext";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

import { useInviteContext } from "./inviteContext";

// Step 1: Invite inbox rehydrate API (REST)
import { fetchInvites } from "../api/inviteApi";

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
 * - Fan-out raw notification payloads to subscribers (DM unread badges, etc.)
 *
 * Non-responsibilities:
 * - Does NOT store invites locally
 * - Does NOT mutate DM state directly
 * - Does NOT manage unread counts
 */
export const NotificationProvider = ({ children }) => {
  const { user } = useUserContext();

  // ✅ InviteContext is the single source of truth for invites
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

  // ✅ Step 4: Subscriber registry (other contexts can listen without coupling)
  const subscribersRef = useRef(new Set());

  /**
   * subscribe(handler)
   * ----------------------------
   * Step 1: Register a handler to receive normalized payloads.
   * Returns an unsubscribe function.
   */
  const subscribe = useCallback((handler) => {
    if (typeof handler !== "function") return () => {};
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  /**
   * Step 5: Build notification WS URL
   */
  const buildNotificationUrl = (token) => {
    return `${config.websocketBaseUrl}/notifications/?token=${token}`;
  };

  /**
   * Step 6: Detect auth-like close
   */
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };

  /**
   * Step 7: Rehydrate pending invites via REST inbox
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
   * Step 8: Fan-out to subscribers (router only)
   */
  const fanOut = useCallback((payload) => {
    subscribersRef.current.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.warn("⚠️ Notification subscriber error:", err);
      }
    });
  }, []);

  /**
   * Step 9: Handle WS notifications (router only)
   */
  const handleNotificationMessage = useCallback(
    (rawEvent) => {
      let data;

      // Step 1: Parse WS payload safely
      try {
        data = JSON.parse(rawEvent?.data || "{}");
      } catch (err) {
        console.error("❌ Notification WS: invalid JSON:", err);
        return;
      }

      // Step 2: Normalize envelope -> payload (supports both shapes)
      // - flattened: { type: "invite", ... }
      // - enveloped: { type: "notify", payload: { type: "invite", ... } }
      if (data?.type === "notify" && data?.payload) {
        data = data.payload;
      }

      // -------------------
      // INVITES (Invite v2 – LOCKED CONTRACT)
      // -------------------
      if (data?.type === "invite") {
        const event = data.event;
        const inviteId = data.inviteId;
        const status = String(data.status || "").toLowerCase();

        if (!inviteId) {
          console.warn("⚠️ Invite event missing inviteId:", data);
          fanOut(data); // still allow subscribers to see raw payload
          return;
        }

        if (event === "invite_created" || event === "invite_updated") {
          if (status === "pending") {
            upsertInvite(data);
            fanOut(data);
            return;
          }
          removeInvite(inviteId);
          fanOut(data);
          return;
        }

        if (event === "invite_expired") {
          removeInvite(inviteId);
          fanOut(data);
          return;
        }

        console.warn("⚠️ Unknown invite event:", event, data);
        fanOut(data);
        return;
      }

      // -------------------
      // EVERYTHING ELSE (DM unread badges, future presence, etc.)
      // -------------------
      fanOut(data);
    },
    [upsertInvite, removeInvite, fanOut]
  );

  /**
   * Step 10: Disconnect safely
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
   * Step 11: Connect WS
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

      // Step 1: Rehydrate invites from server truth on connect
      await rehydratePendingInvites();
    };

    socket.onmessage = handleNotificationMessage;

    socket.onerror = (err) => {
      console.error("❌ Notification socket error:", err);
    };

    socket.onclose = (event) => {
      setIsConnected(false);

      // If user logged out, don't reconnect.
      if (!user?.id) return;

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
   * Step 12: Auto-connect when user becomes available
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

    // ✅ allow other providers to listen (DM unread)
    subscribe,

    reconnect: async () => await connect({ forceRefresh: false }),
    disconnect: async () => await disconnect({ resetAttempts: true }),
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
