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
import useGameCreation from "../hooks/game/useGameCreation";

export const DirectMessageContext = createContext(undefined);

/**
 * Hook to access the DirectMessage context
 */
export const useDirectMessage = () => {
  const context = useContext(DirectMessageContext);

  if (!context) {
    throw new Error("useDirectMessage must be used within a DirectMessageProvider");
  }

  return context;
};

/**
 * DirectMessageProvider
 *
 * Provides WebSocket-based direct messaging context for private 1-on-1 chat.
 * Handles connection, message handling, unread badge state, and game invites.
 *
 * Key behavior (important for recruiter mode):
 * - Tokens are NOT read from cookies/localStorage directly here.
 * - We call ensureFreshAccessToken() before opening the WS handshake.
 * - If auth-like close happens during handshake, we force ONE refresh + retry.
 */
export const DirectMessageProvider = ({ children }) => {
  const [state, dispatch] = useReducer(directMessageReducer, initialDMState);
  const { user } = useUserContext();
  const { isDMOpen } = useUI();
  const { createNewGame } = useGameCreation();
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
   * createDMConnection
   *
   * Establishes WebSocket connection with a friend.
   * Optionally preloads message history over REST once connected.
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
  }) => {
    // Step 1: Resolve friendId (the other user)
    const isCurrentUserFrom = friend.from_user === userRef.current?.id;
    const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

    if (!friendId) {
      console.error("Friend ID missing. Cannot initialize DM WebSocket.");
      return null;
    }

    // Step 2: Reuse socket only if it matches AND is open
    if (
      state.socket &&
      state.activeFriendId === friendId &&
      state.socket.readyState === WebSocket.OPEN
    ) {
      return state.socket;
    }

    // Step 3: Ensure we have a fresh access token before WS connect
    // forceRefresh -> use a huge TTL threshold so it always refreshes
    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      console.error("No valid token available. Cannot initialize DM WebSocket.");
      return null;
    }

    const wsBase = getWsBase();
    const wsUrl = `${wsBase}/ws/chat/${friendId}/?token=${token}`;

    // Step 4: Open socket and resolve only when connected (or resolve null on failure)
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

        // Step 4a: Reset auth retry guard on successful open
        authRetryAttemptRef.current = false;

        dispatch({
          type: DmActionTypes.OPEN_CHAT,
          payload: { friend, socket, friendId },
        });

        dispatch({ type: DmActionTypes.SET_LOADING, payload: true });

        // Step 4b: Preload messages after socket opens (REST)
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
        try {
          const data = JSON.parse(event.data);
          const liveUserId = userRef.current?.id;

          const { type, sender_id, receiver_id, message } = data;

          const msgPayload = {
            ...data,
            currentUserId: liveUserId,
            message: message || null,
          };

          if (type === "message" || type === "game_invite") {
            dispatch({ type: DmActionTypes.RECEIVE_MESSAGE, payload: msgPayload });


            // Step 4c: Use refs so unread logic never goes stale
            if (
              receiver_id === liveUserId &&
              (!isDMOpenRef.current ||
                String(activeFriendIdRef.current) !== String(sender_id))
            ) {
              dispatch({
                type: DmActionTypes.INCREMENT_UNREAD,
                payload: { friendId: sender_id },
              });
            }
          }
        } catch (err) {
          console.error("⚠️ DM socket JSON parse error:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("⚠️ DM WebSocket error:", err);
      };

      socket.onclose = async (event) => {
        console.log("🔌 DM socket closed.", event?.code);

        // Step 4d: If the socket closed BEFORE opening, resolve/retry appropriately
        if (!didOpen) {
          if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
            authRetryAttemptRef.current = true;

            // Step 1: Force a refresh and retry once
            const retryPromise = createDMConnection({
              friend,
              preloadMessages,
              forceRefresh: true,
            });

            retryPromise.then((retrySocket) => safeResolve(retrySocket));
            return;
          }

          safeResolve(null);
        }
      };


      // Step 4e: Safety timeout so callers never hang forever if WS never opens/closes
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
   * sendGameInvite
   *
   * Sends a game invite to the friend. Ensures socket is connected.
   *
   * @param {object|number} friendOrId - Friend object or friend ID
   * @returns {Promise<{gameId: number, lobbyId: number, game: object}|null>}
   */
  const sendGameInvite = async (friendOrId = state.activeFriendId) => {
    const isObj = typeof friendOrId === "object";
    const friendId = isObj
      ? friendOrId.from_user === userRef.current?.id
        ? friendOrId.to_user
        : friendOrId.from_user
      : friendOrId;

    if (!friendId) return null;

    let socket = state.socket;

    // Step 1: Ensure socket exists for the target friend
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (isObj) {
        socket = await createDMConnection({
          friend: friendOrId,
          preloadMessages: false,
          forceRefresh: false,
        });
      } else {
        const fakeFriend = { from_user: userRef.current?.id, to_user: friendId };
        socket = await createDMConnection({
          friend: fakeFriend,
          preloadMessages: false,
          forceRefresh: false,
        });
      }
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("❌ Socket not open, skipping invite.");
      return null;
    }

    try {
      const game = await createNewGame(false);
      const gameId = game?.id;
      const lobbyId = game?.lobby_id || gameId;

      socket.send(
        JSON.stringify({
          type: "game_invite",
          sender_id: userRef.current?.id,
          receiver_id: friendId,
          game_id: gameId,
          lobby_id: lobbyId,
        })
      );

      return { gameId, lobbyId, game };
    } catch (err) {
      console.error("❌ sendGameInvite failed:", err);
      return null;
    }
  };

  /**
   * closeChat
   *
   * Closes the DM socket and resets state
   */
  const closeChat = () => {
    dispatch({ type: DmActionTypes.CLOSE_CHAT });
  };

  return (
    <DirectMessageContext.Provider
      value={{
        ...state,
        openChat: (friend) =>
          createDMConnection({
            friend,
            preloadMessages: true,
            forceRefresh: false,
          }),
        closeChat,
        sendMessage,
        sendGameInvite,
        dispatch,
      }}
    >
      {children}
    </DirectMessageContext.Provider>
  );
};
