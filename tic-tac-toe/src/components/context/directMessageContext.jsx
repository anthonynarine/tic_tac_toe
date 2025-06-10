// File: context/DirectMessageProvider.jsx (clean baseline version)

import { createContext, useContext, useReducer, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import {
  directMessageReducer,
  DmActionTypes,
  initialDMState,
} from "../reducers/directMessaeReducer";
import { useUserContext } from "./userContext";
import chatAPI from "../../api/chatAPI";
import useAuthAxios from "../hooks/useAuthAxios";
import useGameCreation from "../hooks/useGameCreation"

export const DirectMessageContext = createContext(undefined);

export const useDirectMessage = () => {
  const context = useContext(DirectMessageContext);
  if (!context) {
    throw new Error("useDirectMessage must be used within a DirectMessageProvider");
  }
  return context;
};

export const DirectMessageProvider = ({ children }) => {
  const [state, dispatch] = useReducer(directMessageReducer, initialDMState);
  const { user } = useUserContext();
  const { createNewGame} = useGameCreation();
  const userRef = useRef(user);
  const { authAxios } = useAuthAxios();

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const getToken = () =>
    process.env.NODE_ENV === "production"
      ? Cookies.get("access_token")
      : localStorage.getItem("access_token");

  const openChat = (friend) => {
    const token = getToken();
    const isCurrentUserFrom = friend.from_user === user.id;
    const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

    const WS_BASE =
      process.env.NODE_ENV === "production"
        ? `wss://${process.env.REACT_APP_BACKEND_WS}`
        : "ws://localhost:8000";

    const socket = new WebSocket(`${WS_BASE}/ws/chat/${friendId}/?token=${token}`);

    socket.onopen = async () => {
      dispatch({ type: DmActionTypes.OPEN_CHAT, payload: { friend, socket, friendId } });
      dispatch({ type: DmActionTypes.SET_LOADING, payload: true });

      try {
        const { data } = await authAxios.get(`/chat/conversation-with/${friendId}`);
        const conversationID = data.conversation_id;
        const res = await chatAPI.fetchConversationMessages(authAxios, conversationID);

        dispatch({
          type: DmActionTypes.SET_MESSAGES,
          payload: { friendId, messages: res.data },
        });
      } catch (err) {
        console.error("Failed to fetch conversation messages:", err);
        dispatch({ type: DmActionTypes.SET_LOADING, payload: false });
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const liveUserId = userRef.current?.id;

      console.log("📩 WebSocket received:", data);
      console.log("🧠 Dispatching with currentUserId:", liveUserId);

      if (data.type === "message") {
        dispatch({
          type: DmActionTypes.RECEIVE_MESSAGE,
          payload: {
            ...data,
            currentUserId: liveUserId,
          },
        });
      }
    };

    socket.onclose = () => {
      dispatch({ type: DmActionTypes.CLOSE_CHAT });
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  };

  const sendMessage = (content) => {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(
        JSON.stringify({
          type: "message",
          message: content,
        })
      );
    }
  };

  const sendGameInvite = async () => {
    if (!state.socket || !state.activeFriendId) return;

    try {
      const game = await createNewGame(false); // multiplayer mode
      console.log("🎯 Game object returned:", game);
      const gameId = game?.id;

      if (!gameId) throw new Error("Invalid game ID");

      state.socket.send(
        JSON.stringify({
          type: "game_invite",
          game_id: gameId,
          sender_id: userRef.current?.id,
          receiver_id: state.activeFriendId,
        })
      );

      return gameId;
    } catch (err) {
      console.error("Game invite failed:", err);
      return null;
    }
  };

  const closeChat = () => {
    dispatch({ type: DmActionTypes.CLOSE_CHAT });
  };

  return (
    <DirectMessageContext.Provider
      value={{
        ...state,
        openChat,
        closeChat,
        sendMessage,
        sendGameInvite,
      }}
    >
      {children}
    </DirectMessageContext.Provider>
  );
};
