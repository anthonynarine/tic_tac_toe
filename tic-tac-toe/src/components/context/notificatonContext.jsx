// # Filename: src/components/context/notificatonContext.jsx


import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useCallback,
} from "react";
import config from "../../config";
import { useUserContext } from "./userContext";
import { useDirectMessage } from "./directMessageContext";
import { useUI } from "./uiContext";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";
import { DmActionTypes } from "../reducers/directMessaeReducer";

// Step 1: Invite inbox rehydrate API (should use shared authAxios)
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

// Step 1: Invite v2 reducer action types
const InviteActionTypes = {
  UPSERT_INVITE: "UPSERT_INVITE",
  UPSERT_INVITES_BULK: "UPSERT_INVITES_BULK",
  CLEAR_INVITES: "CLEAR_INVITES",
};

// Step 2: Initial invite state
const inviteInitialState = {
  invitesById: {}, // { [inviteId]: invite }
  inviteOrder: [], // newest-first list of inviteIds
};

// Step 3: Invite reducer (dedupe by inviteId)
const inviteReducer = (state, action) => {
  switch (action.type) {
    case InviteActionTypes.UPSERT_INVITE: {
      const invite = action.payload;
      const inviteId = invite?.inviteId;

      if (!inviteId) return state;

      const exists = Boolean(state.invitesById[inviteId]);

      return {
        ...state,
        invitesById: {
          ...state.invitesById,
          [inviteId]: {
            ...state.invitesById[inviteId],
            ...invite,
          },
        },
        inviteOrder: exists ? state.inviteOrder : [inviteId, ...state.inviteOrder],
      };
    }

    case InviteActionTypes.UPSERT_INVITES_BULK: {
      const invites = Array.isArray(action.payload) ? action.payload : [];

      let nextInvitesById = { ...state.invitesById };
      let nextOrder = [...state.inviteOrder];

      invites.forEach((invite) => {
        const inviteId = invite?.inviteId;
        if (!inviteId) return;

        const exists = Boolean(nextInvitesById[inviteId]);

        nextInvitesById[inviteId] = {
          ...nextInvitesById[inviteId],
          ...invite,
        };

        if (!exists) {
          nextOrder = [inviteId, ...nextOrder];
        }
      });

      return {
        ...state,
        invitesById: nextInvitesById,
        inviteOrder: nextOrder,
      };
    }

    case InviteActionTypes.CLEAR_INVITES: {
      return inviteInitialState;
    }

    default:
      return state;
  }
};

/**
 * NotificationProvider
 * ----------------------------
 * Maintains a single WebSocket connection that delivers lightweight
 * notifications (e.g. DM message received, game invite received).
 *
 * Invite v2:
 * - Receives:
 *   - { type: "invite_created", invite: {...} }
 *   - { type: "invite_status", invite: {...} }
 * - Stores invites in memory (dedupe by inviteId)
 *
 * Rehydrate:
 * - On socket connect, fetch pending invites via REST inbox
 * - Bulk upsert into state (dedupe by inviteId)
 */
export const NotificationProvider = ({ children }) => {
  const { user } = useUserContext();
  const { isDMOpen } = useUI();

  // Step 1: DM context (we dispatch badge updates here)
  const dm = useDirectMessage();
  const activeFriendId = dm?.activeFriendId;
  const dispatch = dm?.dispatch;

  // Step 2: Invite v2 state
  const [inviteState, inviteDispatch] = useReducer(
    inviteReducer,
    inviteInitialState
  );

  // Step 3: WebSocket refs & state
  const socketRef = useRef(null);
  const retryRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);

  // Step 4: Reconnect tuning
  const reconnectAttemptRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 8; // prevents infinite thrash
  const BASE_DELAY_MS = 1000; // 1s base
  const MAX_DELAY_MS = 15000; // cap backoff

  // Step 5: One-time "auth refresh + reconnect" guard
  const authRetryAttemptRef = useRef(false);

  /**
   * Step 6: Build the notification WebSocket URL.
   */
  const buildNotificationUrl = (token) => {
    return `${config.websocketBaseUrl}/notifications/?token=${token}`;
  };

  /**
   * Step 7: Detect auth-like close codes.
   */
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);

    if (code === 4401) return true;
    if (code === 1006) return true;

    return false;
  };

  /**
   * Step 8: Decide whether an unread badge should increment.
   */
  const shouldIncrementUnread = useCallback(
    ({ notifType, senderId }) => {
      if (!senderId) return false;

      // Step 1: support legacy + invite v2 types
      const isDm = notifType === "dm";
      const isLegacyInvite = notifType === "game_invite";
      const isInviteV2 = notifType === "invite_created";

      if (!isDm && !isLegacyInvite && !isInviteV2) return false;

      // Step 2: If the DM drawer is closed, always increment.
      if (!isDMOpen) return true;

      // Step 3: If DM drawer is open but you're not chatting with this sender, increment.
      return String(activeFriendId) !== String(senderId);
    },
    [isDMOpen, activeFriendId]
  );

  /**
   * Step 9: Cleanly close socket + clear retry timers.
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
   * Step 10: Invite v2 handlers
   */
  const upsertInvite = (invite) => {
    inviteDispatch({ type: InviteActionTypes.UPSERT_INVITE, payload: invite });
  };

  const upsertInvitesBulk = (invites) => {
    inviteDispatch({
      type: InviteActionTypes.UPSERT_INVITES_BULK,
      payload: invites,
    });
  };

  /**
   * ✅ New Code
   * Step 10.5: Rehydrate pending invites from REST inbox.
   */
  const rehydratePendingInvites = useCallback(async () => {
    try {
      const pending = await fetchInvites({ status: "pending", role: "to_user" });
      upsertInvitesBulk(pending);
    } catch (err) {
      console.error("❌ Invite rehydrate failed:", err);
    }
  }, []);

  /**
   * ✅ New Code
   * Step 10.6: Handle incoming WS notifications (Invite v2 + DM).
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

      // Step 1: Invite v2 contract
      if (data?.type === "invite_created" && data?.invite) {
        upsertInvite(data.invite);

        const senderId = data.invite?.fromUserId;
        if (shouldIncrementUnread({ notifType: "invite_created", senderId })) {
          dispatch?.({
            type: DmActionTypes.INCREMENT_UNREAD,
            payload: { friendId: String(senderId) },
          });
        }
        return;
      }

      if (data?.type === "invite_status" && data?.invite) {
        upsertInvite(data.invite);
        return;
      }

      // Step 2: DM notifications (keep existing behavior)
      if (data?.type === "dm") {
        const senderId = data?.senderId;

        if (shouldIncrementUnread({ notifType: "dm", senderId })) {
          dispatch?.({
            type: DmActionTypes.INCREMENT_UNREAD,
            payload: { friendId: String(senderId) },
          });
        }
      }
    },
    [dispatch, shouldIncrementUnread]
  );

  /**
   * Step 11: Establish WebSocket connection.
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

      // ✅ New Code: Rehydrate pending invites after WS connect
      await rehydratePendingInvites();
    };

    // ✅ New Code: attach message handler
    socket.onmessage = handleNotificationMessage;

    socket.onerror = (err) => {
      console.error("❌ Notification socket error:", err);
    };

    socket.onclose = (event) => {
      setIsConnected(false);

      if (!user?.id) {
        console.log("🔔 Notification socket closed (no user).");
        return;
      }

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
   * Step 12: Auto-connect when user becomes available.
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

  // Step 13: Derived list of invites (newest-first)
  const invites = useMemo(() => {
    return inviteState.inviteOrder
      .map((id) => inviteState.invitesById[id])
      .filter(Boolean);
  }, [inviteState.inviteOrder, inviteState.invitesById]);

  const contextValue = {
    isConnected,
    reconnect: async () => await connect({ forceRefresh: false }),
    disconnect: async () => await disconnect({ resetAttempts: true }),

    invites,
    invitesById: inviteState.invitesById,
    upsertInvite,
    upsertInvitesBulk,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
