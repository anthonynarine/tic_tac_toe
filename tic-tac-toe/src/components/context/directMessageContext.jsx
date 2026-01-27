
// # Filename: src/components/context/directMessageContext.jsx

import { createContext, useContext, useEffect, useReducer, useRef } from "react";

// Step 1: Ensure WS always uses a fresh access token (supports recruiter mode storage)
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

import {
  directMessageReducer,
  DmActionTypes,
  initialDMState,
} from "../reducers/directMessaeReducer";

import { useUserContext } from "./userContext";
import { useUI } from "../context/uiContext";
import chatAPI from "../../api/chatAPI";
import useAuthAxios from "../auth/hooks/useAuthAxios";

export const DirectMessageContext = createContext(undefined);

/**
 * Hook to access the DirectMessage context
 */
export const useDirectMessage = () => {
  const context = useContext(DirectMessageContext);

  if (!context) {
    throw new Error(
      "useDirectMessage must be used within a DirectMessageProvider"
    );
  }

  return context;
};

/**
 * DirectMessageProvider
 *
 * Provides WebSocket-based direct messaging context for private 1-on-1 chat.
 *
 * ARCH CONTRACT (non-negotiable):
 * - DM WebSocket handles ONLY { type: "message" }
 * - Game invites do NOT ride on the DM socket anymore.
 * - Invites are created over HTTPS (POST /api/invites/) and delivered via Notification WS.
 * - DM socket should be open ONLY while the DM drawer is open.
 */
export const DirectMessageProvider = ({ children }) => {
  const [state, dispatch] = useReducer(directMessageReducer, initialDMState);

  const { user } = useUserContext();
  const { isDMOpen } = useUI();
  const { authAxios } = useAuthAxios();

  // Step 1: Keep latest values in refs so socket handlers never go stale
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

  // Step 2: One-time auth refresh retry guard (prevents infinite loops)
  const authRetryAttemptRef = useRef(false);

  // Step 3: Identify auth-like WS closes
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);

    if (code === 4401) return true; // Unauthorized (if your server uses it)
    if (code === 1006) return true; // Abnormal close (often handshake rejection)
    return false;
  };

  // Step 4: Build WS base URL in a consistent way (dev/prod)
  const getWsBase = () => {
    const backendHost = process.env.REACT_APP_BACKEND_WS || "localhost:8000";
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${wsScheme}://${backendHost}`;
  };

  /**
   * Step 5: Close the active socket safely (drawer-scoped behavior).
   */
  const disconnectDM = () => {
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
  };

  /**
   * Step 6: Ensure DM socket is CLOSED when DM drawer is closed.
   */
  useEffect(() => {
    if (!isDMOpen) {
      if (state.socket) {
        disconnectDM();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDMOpen]);

  /**
   * createDMConnection
   *
   * Establishes WebSocket connection with a friend.
   * Optionally preloads message history over REST once connected.
   *
   * IMPORTANT:
   * - Will NOT connect if the DM drawer is closed (drawer-scoped).
   *
   * @param {object} options
   * @param {object} options.friend - Friend object with from_user and to_user
   * @param {boolean} options.preloadMessages - Whether to load chat history
   * @param {boolean} options.forceRefresh - Force a refresh (used after auth-like close)
   * @returns {Promise<WebSocket|null>} Resolves with open WebSocket or null
   */
  const createDMConnection = async ({
    friend,
    preloadMessages = true,
    forceRefresh = false,
    allowWhenClosed = false,
  }) => {
    // Step 1: Hard gate — DM socket only while drawer is open
    if (!isDMOpenRef.current && !allowWhenClosed) {
      return null;
    }

    // Step 2: Resolve friendId (the other user)
    const isCurrentUserFrom = friend.from_user === userRef.current?.id;
    const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

    if (!friendId) {
      console.error("Friend ID missing. Cannot initialize DM WebSocket.");
      return null;
    }

    // Step 3: Reuse socket only if it matches AND is open
    if (
      state.socket &&
      String(state.activeFriendId) === String(friendId) &&
      state.socket.readyState === WebSocket.OPEN
    ) {
      return state.socket;
    }

    // Step 4: Ensure we have a fresh access token before WS connect
    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      console.error("No valid token available. Cannot initialize DM WebSocket.");
      return null;
    }

    const wsBase = getWsBase();
    const wsUrl = `${wsBase}/ws/chat/${friendId}/?token=${token}`;

    // Step 5: Open socket and resolve only when connected (or resolve null on failure)
    return await new Promise((resolve) => {
      const socket = new WebSocket(wsUrl);

      let didResolve = false;
      let didOpen = false;

      const safeResolve = (value) => {
        if (!didResolve) {
          didResolve = true;
          resolve(value);
        }
      };

      socket.onopen = async () => {
        didOpen = true;

        // Step 5a: Reset auth retry guard on successful open
        authRetryAttemptRef.current = false;

        dispatch({
          type: DmActionTypes.OPEN_CHAT,
          payload: { friend, socket, friendId },
        });

        dispatch({ type: DmActionTypes.SET_LOADING, payload: true });

        // Step 5b: Preload messages after socket opens (REST)
        if (preloadMessages) {
          try {
            const { data } = await authAxios.get(
              `/chat/conversation-with/${friendId}`
            );

            const res = await chatAPI.fetchConversationMessages(
              authAxios,
              data.conversation_id
            );

            dispatch({
              type: DmActionTypes.SET_MESSAGES,
              payload: { friendId, messages: res.data },
            });
          } catch (err) {
            console.error("❌ Failed to preload messages:", err);
          }
        }

        safeResolve(socket);
      };

      socket.onmessage = (event) => {
        let data;

        try {
          data = JSON.parse(event.data);
        } catch (err) {
          console.error("⚠️ DM socket JSON parse error:", err);
          return;
        }

        // ✅ Step 5c: HARD CONTRACT — DM socket processes ONLY messages
        if (data?.type !== "message") {
          return;
        }

        const liveUserId = userRef.current?.id;

        dispatch({
          type: DmActionTypes.RECEIVE_MESSAGE,
          payload: {
            ...data,
            currentUserId: liveUserId,
            message: data?.message ?? null,
          },
        });
      };

      socket.onerror = (err) => {
        console.error("⚠️ DM WebSocket error:", err);
      };

      socket.onclose = async (event) => {
        // Step 5d: If the socket closed BEFORE opening, resolve/retry appropriately
        if (!didOpen) {
          if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
            authRetryAttemptRef.current = true;

            createDMConnection({
              friend,
              preloadMessages,
              forceRefresh: true,
            }).then((retrySocket) => safeResolve(retrySocket));

            return;
          }

          safeResolve(null);
          return;
        }

        // Step 5e: If we were open and got closed, let reducer state reset on UI action
        // (Drawer closing already disconnects via effect)
      };

      // Step 5f: Safety timeout so callers never hang forever
      setTimeout(() => {
        if (!didResolve && !didOpen) {
          safeResolve(null);
        }
      }, 8000);
    });
  };

  /**
   * sendMessage
   *
   * Sends a regular message to the current chat
   *
   * @param {string} content - Message body
   */
  const sendMessage = (content) => {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: "message", message: content }));
    }
  };

  /**
   * sendGameInvite (HTTPS)
   *
   * Invites are created over HTTPS and delivered via Notification WS.
   *
   * Backend expects:
   *   POST /api/invites/
   *   { to_user_id: <int>, game_type: "tic_tac_toe" }
   *
   * @param {object|number} friendOrId - Friend object or friend id
   * @returns {Promise<{invite: object, lobbyId: string}|null>}
   */
  const sendGameInvite = async (friendOrId = state.activeFriendId) => {
    try {
      const isObj = typeof friendOrId === "object";

      const friendId = isObj
        ? friendOrId.from_user === userRef.current?.id
          ? friendOrId.to_user
          : friendOrId.from_user
        : friendOrId;

      if (!friendId) return null;

      const res = await authAxios.post("/invites/", {
        to_user_id: Number(friendId),
        game_type: "tic_tac_toe",
      });

      // Response shape from your InviteCreateView:
      // { invite: {...}, lobbyId: "<game.id>" }
      return res?.data || null;
    } catch (err) {
      console.error("❌ sendGameInvite (HTTPS) failed:", err);
      return null;
    }
  };

  /**
   * closeChat
   *
   * Closes the DM socket and resets state
   */
  const closeChat = () => {
    disconnectDM();
  };

  const clearThread = (friendId) => {
    // Step 1: Clear only the client thread for that friend
    dispatch({
      type: DmActionTypes.CLEAR_THREAD,
      payload: { friendId },
    });
  };

  return (
    <DirectMessageContext.Provider
      value={{
        ...state,
        openChat: async (friend) =>
          await createDMConnection({
            friend,
            preloadMessages: true,
            forceRefresh: false,
            allowWhenClosed: false,
          }),
        closeChat,
        sendMessage,
        sendGameInvite,
        clearThread,
        dispatch,
      }}
    >
      {children}
    </DirectMessageContext.Provider>
  );
};
