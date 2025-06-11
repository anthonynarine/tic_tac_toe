import { createContext, useContext, useReducer, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import {
  directMessageReducer,
  DmActionTypes,
  initialDMState,
} from "../reducers/directMessaeReducer";
import { useUserContext } from "./userContext";
import { useUI } from "../context/uiContext";
import chatAPI from "../../api/chatAPI";
import useAuthAxios from "../hooks/useAuthAxios";
import useGameCreation from "../hooks/useGameCreation";

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
 */
export const DirectMessageProvider = ({ children }) => {
  const [state, dispatch] = useReducer(directMessageReducer, initialDMState);
  const { user } = useUserContext();
  const { isDMOpen } = useUI();
  const { createNewGame } = useGameCreation();
  const { authAxios } = useAuthAxios();
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const getToken = () =>
    process.env.NODE_ENV === "production"
      ? Cookies.get("access_token")
      : localStorage.getItem("access_token");

  /**
   * createDMConnection
   *
   * Establishes WebSocket connection with friend. Optionally preloads message history.
   *
   * @param {object} options
   * @param {object} options.friend - Friend object with from_user and to_user
   * @param {boolean} options.preloadMessages - Whether to load chat history
   * @returns {Promise<WebSocket>} Resolves with open WebSocket
   */
  const createDMConnection = ({ friend, preloadMessages = true }) => {
    return new Promise((resolve) => {
      const token = getToken();
      const isCurrentUserFrom = friend.from_user === userRef.current?.id;
      const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

      // Reuse socket if already connected to this friend
      if (state.socket && state.activeFriendId === friendId) {
        return resolve(state.socket);
      }

      const WS_BASE =
        process.env.NODE_ENV === "production"
          ? `wss://${process.env.REACT_APP_BACKEND_WS}`
          : "ws://localhost:8000";

      const socket = new WebSocket(`${WS_BASE}/ws/chat/${friendId}/?token=${token}`);

      socket.onopen = async () => {
        dispatch({ type: DmActionTypes.OPEN_CHAT, payload: { friend, socket, friendId } });
        dispatch({ type: DmActionTypes.SET_LOADING, payload: true });

        if (preloadMessages) {
          try {
            const { data } = await authAxios.get(`/chat/conversation-with/${friendId}`);
            const res = await chatAPI.fetchConversationMessages(authAxios, data.conversation_id);
            dispatch({
              type: DmActionTypes.SET_MESSAGES,
              payload: { friendId, messages: res.data },
            });
          } catch (err) {
            console.error("❌ Failed to preload messages:", err);
          }
        }

        resolve(socket);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const liveUserId = userRef.current?.id;
        const { type, sender_id, receiver_id, message, message_id } = data;

        const friendId = sender_id === liveUserId ? receiver_id : sender_id;

        const msgPayload = {
          ...data,
          currentUserId: liveUserId,
          message: message || null,
        };

        if (type === "message") {
          dispatch({ type: DmActionTypes.RECEIVE_MESSAGE, payload: msgPayload });

          if (
            receiver_id === liveUserId &&
            (!isDMOpen || state.activeFriendId !== sender_id)
          ) {
            dispatch({
              type: DmActionTypes.INCREMENT_UNREAD,
              payload: { friendId: sender_id },
            });
          }
        }

        if (type === "game_invite") {
          dispatch({ type: DmActionTypes.RECEIVE_MESSAGE, payload: msgPayload });

          if (
            receiver_id === liveUserId &&
            (!isDMOpen || state.activeFriendId !== sender_id)
          ) {
            dispatch({
              type: DmActionTypes.INCREMENT_UNREAD,
              payload: { friendId: sender_id },
            });
          }
        }
      }; // ✅ this was missing


        

      socket.onclose = () => {
        console.log("🔌 DM socket closed.");
      };

      socket.onerror = (err) => {
        console.error("⚠️ DM WebSocket error:", err);
      };
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
   * @returns {Promise<{gameId: number, lobbyId: number}>}
   */
  const sendGameInvite = async (friendOrId = state.activeFriendId) => {
    const isObj = typeof friendOrId === "object";
    const friendId = isObj
      ? (friendOrId.from_user === userRef.current?.id
          ? friendOrId.to_user
          : friendOrId.from_user)
      : friendOrId;

    if (!friendId) return;

    let socket = state.socket;

    if (isObj) {
      socket = await createDMConnection({ friend: friendOrId, preloadMessages: false });
    } else {
      const fakeFriend = { from_user: userRef.current?.id, to_user: friendId };
      socket = await createDMConnection({ friend: fakeFriend, preloadMessages: false });
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
        openChat: (friend) => createDMConnection({ friend, preloadMessages: true }),
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
