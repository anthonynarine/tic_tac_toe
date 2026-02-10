// # Filename: src/components/context/directMessageContext.jsx

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";

import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";
import useAuthAxios from "../auth/hooks/useAuthAxios";

import { useUserContext } from "./userContext";
import { useUI } from "../context/uiContext";
import { useNotification } from "./notificatonContext";

import chatAPI from "../api/chatAPI";

import {
  directMessageReducer,
  DmActionTypes,
  initialDMState,
} from "../reducers/directMessaeReducer";

export const DirectMessageContext = createContext(undefined);

export const useDirectMessage = () => {
  const ctx = useContext(DirectMessageContext);
  if (!ctx) {
    throw new Error("useDirectMessage must be used within DirectMessageProvider");
  }
  return ctx;
};

export const DirectMessageProvider = ({ children }) => {
  const [state, dispatch] = useReducer(directMessageReducer, initialDMState);

  const { user } = useUserContext();
  const { isDMOpen, setDMOpen } = useUI();
  const { authAxios } = useAuthAxios();
  const notification = useNotification();

  // ---------------------------
  // Step 1: Stable refs (avoid stale closures)
  // ---------------------------
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const userRef = useRef(user);
  const isDMOpenRef = useRef(isDMOpen);
  const activeFriendIdRef = useRef(state.activeFriendId);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isDMOpenRef.current = isDMOpen;
  }, [isDMOpen]);

  useEffect(() => {
    activeFriendIdRef.current = state.activeFriendId;
  }, [state.activeFriendId]);

  // Cancels stale async work when user switches threads quickly
  const connectAttemptRef = useRef(0);

  // ---------------------------
  // Step 2: Helpers
  // ---------------------------
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };

  const getWsBase = () => {
    const backendHost = process.env.REACT_APP_BACKEND_WS || "localhost:8000";
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${wsScheme}://${backendHost}`;
  };

  // Step 2b: Robust friendId resolution (supports User / friendship / row models)
  const resolveFriendId = useCallback((friendLike) => {
    if (!friendLike) return null;

    const me = Number(userRef.current?.id);

    const direct =
      friendLike?.friend_id ?? friendLike?.user_id ?? friendLike?.id ?? null;

    if (direct) return Number(direct);

    const fromId = Number(friendLike?.from_user);
    const toId = Number(friendLike?.to_user);

    if (fromId && toId && me) {
      return fromId === me ? toId : fromId;
    }

    return null;
  }, []);

  // Step 2c: Normalize REST messages -> WS-like shape
  // Fixes: "all messages on one side" when REST uses `sender` not `sender_id`
  const normalizeRestMessage = useCallback((m) => {
    const senderId = m?.sender ?? m?.sender_id ?? null;
    const receiverId = m?.receiver ?? m?.receiver_id ?? null;

    return {
      // identity
      id: m?.id ?? m?.message_id ?? undefined,
      message_id: m?.message_id ?? m?.id ?? undefined,

      // unified fields used by UI
      sender_id: senderId,
      receiver_id: receiverId,
      message: m?.message ?? m?.content ?? "",
      content: m?.content ?? m?.message ?? "",

      // metadata
      timestamp: m?.timestamp ?? null,
      is_read: Boolean(m?.is_read),

      // passthrough if present
      conversation_id: m?.conversation_id ?? null,
    };
  }, []);

  // ---------------------------
  // Step 3: REST helpers
  // ---------------------------
  const getConversationIdWithFriend = useCallback(
    async (friendId) => {
      const res = await chatAPI.getConversationWith(authAxios, friendId);
      return res?.data?.conversation_id || null;
    },
    [authAxios]
  );

  const markConversationRead = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      try {
        await chatAPI.markConversationRead(authAxios, conversationId);
      } catch {
        // no-op
      }
    },
    [authAxios]
  );

  const deleteConversationById = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      await chatAPI.deleteConversation(authAxios, conversationId);
    },
    [authAxios]
  );

  // ---------------------------
  // Step 4: Rehydrate unread counts (persist across refresh)
  // GET /chat/unread-summary/
  // ---------------------------
  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;

      try {
        const res = await chatAPI.getUnreadSummary(authAxios);
        const unreadCounts = res?.data?.by_friend || {};

        if (!mountedRef.current) return;

        dispatch({
          type: DmActionTypes.SET_UNREAD_COUNTS,
          payload: { unreadCounts },
        });
      } catch (err) {
        // no token leakage
        console.warn("DM unread rehydrate failed:", err?.response?.status);
      }
    };

    run();
  }, [user?.id, authAxios]);

  // ---------------------------
  // Step 5: Disconnect socket safely (drawer-scoped)
  // ---------------------------
  const disconnectDM = useCallback(() => {
    const socket = state.socket;

    try {
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      }
    } catch (err) {
      console.warn("⚠️ DM disconnect error:", err);
    } finally {
      dispatch({ type: DmActionTypes.CLOSE_CHAT });
    }
  }, [state.socket]);

  useEffect(() => {
    if (!isDMOpen && state.socket) {
      disconnectDM();
    }
  }, [isDMOpen, state.socket, disconnectDM]);

  // ---------------------------
  // Step 6: Notifications WS -> unread counts (deduped)
  // ---------------------------
  const seenDmNotifyIdsRef = useRef(new Set());

  useEffect(() => {
    const subscribe = notification?.subscribe;
    if (typeof subscribe !== "function") return;

    const unsubscribe = subscribe(async (evt) => {
      if (!evt || evt.type !== "dm") return;

      const me = Number(userRef.current?.id);
      const senderId = Number(evt.sender_id);
      const receiverId = Number(evt.receiver_id);

      if (!me || receiverId !== me || !senderId) return;

      const msgId =
        evt.message_id !== undefined && evt.message_id !== null
          ? String(evt.message_id)
          : null;

      if (msgId) {
        if (seenDmNotifyIdsRef.current.has(msgId)) return;
        seenDmNotifyIdsRef.current.add(msgId);
        if (seenDmNotifyIdsRef.current.size > 800) {
          seenDmNotifyIdsRef.current.clear();
        }
      }

      const drawerOpen = Boolean(isDMOpenRef.current);
      const activeFriendId = Number(activeFriendIdRef.current);

      // If actively viewing sender thread, keep unread at 0
      if (drawerOpen && activeFriendId && activeFriendId === senderId) {
        dispatch({
          type: DmActionTypes.RESET_UNREAD,
          payload: { friendId: senderId },
        });

        if (evt.conversation_id) await markConversationRead(evt.conversation_id);
        return;
      }

      dispatch({
        type: DmActionTypes.INCREMENT_UNREAD,
        payload: { friendId: senderId },
      });
    });

    return unsubscribe;
  }, [notification, markConversationRead]);

  // ---------------------------
  // Step 7: WS connect only (thread content only)
  // route: /ws/chat/<friend_id>/
  // ---------------------------
  const connectWsOnly = useCallback(
    async ({ friend, friendId, forceRefresh = false }) => {
      const attemptId = ++connectAttemptRef.current;

      // Must still be open by the time we connect
      if (!isDMOpenRef.current) return null;

      // Close existing socket before switching threads
      if (state.socket) disconnectDM();

      const token = await ensureFreshAccessToken({
        minTtlSeconds: forceRefresh ? 999999999 : 60,
      });

      if (!token) return null;
      if (attemptId !== connectAttemptRef.current) return null;

      const wsUrl = `${getWsBase()}/ws/chat/${friendId}/?token=${token}`;

      return await new Promise((resolve) => {
        const socket = new WebSocket(wsUrl);

        let didOpen = false;
        let resolved = false;

        const safeResolve = (value) => {
          if (resolved) return;
          resolved = true;
          resolve(value);
        };

        socket.onopen = () => {
          didOpen = true;

          // Step 1: Upgrade active chat with live socket
          dispatch({
            type: DmActionTypes.OPEN_CHAT,
            payload: { friend, socket, friendId },
          });

          safeResolve(socket);
        };

        socket.onmessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          if (data?.type !== "message" && data?.type !== "game_invite") return;

          if (data?.type === "message") {
            dispatch({
              type: DmActionTypes.RECEIVE_MESSAGE,
              payload: {
                ...data,
                currentUserId: userRef.current?.id,
                message: data?.message ?? data?.content ?? "",
                content: data?.content ?? data?.message ?? "",
              },
            });

            // keep unread at 0 if active thread
            const activeFriendId = Number(activeFriendIdRef.current);
            const senderId = Number(data?.sender_id ?? data?.sender);

            if (
              Boolean(isDMOpenRef.current) &&
              activeFriendId &&
              senderId &&
              activeFriendId === senderId
            ) {
              dispatch({
                type: DmActionTypes.RESET_UNREAD,
                payload: { friendId: senderId },
              });
            }
          }

          if (data?.type === "game_invite") {
            dispatch({
              type: DmActionTypes.RECEIVE_GAME_INVITE,
              payload: data,
            });
          }
        };

        socket.onclose = async (event) => {
          // Retry once if it never opened and looks auth-like
          if (!didOpen && isAuthLikeClose(event)) {
            const retry = await connectWsOnly({
              friend,
              friendId,
              forceRefresh: true,
            });
            safeResolve(retry);
            return;
          }

          safeResolve(null);
        };

        // Fail-safe
        setTimeout(() => {
          if (!resolved && !didOpen) safeResolve(null);
        }, 8000);
      });
    },
    [state.socket, disconnectDM]
  );

  // ---------------------------
  // Step 8: Public API
  // IMPORTANT: openChat sets activeChat immediately (prevents "Connecting..." forever)
  // ---------------------------
  const openChat = useCallback(
    async (friend) => {
      const friendId = resolveFriendId(friend);
      if (!friendId) return false;

      // Step 1: open drawer immediately
      if (typeof setDMOpen === "function") setDMOpen(true);

      // Step 2: set active chat immediately (socket null for now)
      dispatch({
        type: DmActionTypes.OPEN_CHAT,
        payload: { friend, socket: null, friendId },
      });

      // Step 3: set loading + clear unread immediately
      dispatch({ type: DmActionTypes.SET_LOADING, payload: true });
      dispatch({ type: DmActionTypes.RESET_UNREAD, payload: { friendId } });

      const attemptId = ++connectAttemptRef.current;

      // Step 4: REST preload regardless of WS
      try {
        const conversationId = await getConversationIdWithFriend(friendId);
        if (!mountedRef.current) return true;
        if (attemptId !== connectAttemptRef.current) return true;

        if (conversationId) {
          const res = await chatAPI.fetchConversationMessages(
            authAxios,
            conversationId
          );

          if (attemptId !== connectAttemptRef.current) return true;

          const normalized = Array.isArray(res.data)
            ? res.data.map(normalizeRestMessage)
            : [];

          dispatch({
            type: DmActionTypes.SET_MESSAGES,
            payload: { friendId, messages: normalized },
          });

          await markConversationRead(conversationId);
        }
      } catch (err) {
        console.error("❌ DM preload failed:", err?.response?.status || err);
      } finally {
        dispatch({ type: DmActionTypes.SET_LOADING, payload: false });
      }

      // Step 5: Connect WS after preload (realtime upgrade)
      try {
        await connectWsOnly({ friend, friendId, forceRefresh: false });
      } catch {
        // No-op: thread still works from REST preload
      }

      return true;
    },
    [
      authAxios,
      connectWsOnly,
      getConversationIdWithFriend,
      markConversationRead,
      normalizeRestMessage,
      resolveFriendId,
      setDMOpen,
    ]
  );

  const closeChat = useCallback(() => {
    try {
      disconnectDM();
    } finally {
      if (typeof setDMOpen === "function") setDMOpen(false);
    }
  }, [disconnectDM, setDMOpen]);

  const sendMessage = useCallback(
    async (content) => {
      const msg = String(content || "").trim();
      if (!msg) return;

      if (state.socket?.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ type: "message", message: msg }));
      }
    },
    [state.socket]
  );

  const clearThread = useCallback((friendId) => {
    dispatch({ type: DmActionTypes.CLEAR_THREAD, payload: { friendId } });
  }, []);

  // Step 9: Delete conversation end-to-end (REST + local state)
  const deleteConversation = useCallback(
    async (friendOrId) => {
      const friendId =
        typeof friendOrId === "object" ? resolveFriendId(friendOrId) : friendOrId;

      if (!friendId) return false;

      // Step 1: resolve conversation id
      let conversationId = null;
      try {
        conversationId = await getConversationIdWithFriend(friendId);
      } catch {
        conversationId = null;
      }

      if (!conversationId) return false;

      // Step 2: delete on server
      try {
        await deleteConversationById(conversationId);
      } catch (err) {
        console.error("❌ Delete conversation failed:", err?.response?.status || err);
        return false;
      }

      // Step 3: clear local thread + unread; close drawer if active
      dispatch({ type: DmActionTypes.CLEAR_THREAD, payload: { friendId } });
      dispatch({ type: DmActionTypes.RESET_UNREAD, payload: { friendId } });

      if (String(activeFriendIdRef.current) === String(friendId)) {
        closeChat();
      }

      return true;
    },
    [
      closeChat,
      deleteConversationById,
      getConversationIdWithFriend,
      resolveFriendId,
    ]
  );

  return (
    <DirectMessageContext.Provider
      value={{
        ...state,
        openChat,
        closeChat,
        sendMessage,
        clearThread,
        deleteConversation,
        dispatch,
      }}
    >
      {children}
    </DirectMessageContext.Provider>
  );
};
