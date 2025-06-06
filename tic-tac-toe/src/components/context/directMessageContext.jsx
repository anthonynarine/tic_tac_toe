// File: context/DirectMessageProvider.jsx

import { createContext, useContext, useReducer } from "react";
import Cookies from "js-cookie";
import {
  directMessageReducer,
  DmActionTypes,
  initialDMState,
} from "../reducers/directMessaeReducer";
import { useUserContext } from "./userContext";
import { useUI } from "./uiContext";
import chatAPI from "../../api/chatAPI";
import useAuthAxios from "../hooks/useAuthAxios";

/**
 * DirectMessageContext
 * ----------------------------------------------------------------
 * Provides global state and methods for 1-on-1 direct messaging.
 * Enables WebSocket lifecycle management, REST message hydration,
 * unread tracking, and message dispatching.
 */
export const DirectMessageContext = createContext(undefined);

/**
 * useDirectMessage
 * ----------------------------------------------------------------
 * Safely access the DirectMessage context.
 * Throws if used outside provider.
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
 * ----------------------------------------------------------------
 * Manages state and side effects for direct messaging features.
 * Includes:
 * - WebSocket connection per friend
 * - Message history fetch on open
 * - Real-time message dispatch/receive
 * - Unread state tracking
 */
export const DirectMessageProvider = ({ children }) => {
    const [state, dispatch] = useReducer(directMessageReducer, initialDMState);
    const { user } = useUserContext();
    const { setDMOpen } = useUI();
    const { authAxios } = useAuthAxios();

    // Fetches token from cookies or localStorage (depends on environment)
    const getToken = () =>
        process.env.NODE_ENV === "production"
        ? Cookies.get("access_token")
        : localStorage.getItem("access_token");

    /**
     * openChat(friend)
     * ----------------------------------------------------------------
     * - Opens a WebSocket to the correct DM room based on friend ID
     * - Hydrates message history via REST
     * - Resets unread count
     */
    const openChat = (friend) => {
        const token = getToken();

        // Determine which user is the friend (based on direction of relationship)
        const isCurrentUserFrom = friend.from_user === user.id;
        const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

        const WS_BASE =
        process.env.NODE_ENV === "production"
            ? `wss://${process.env.REACT_APP_BACKEND_WS}`
            : "ws://localhost:8000";

        const socket = new WebSocket(`${WS_BASE}/ws/chat/${friendId}/?token=${token}`);

        // ✅ WebSocket opened
        socket.onopen = async () => {
        // Set activeChat and store socket
        dispatch({
            type: DmActionTypes.OPEN_CHAT,
            payload: { friend, socket, friendId },
        });

        // Reset unread badge
        dispatch({ type: DmActionTypes.MARK_AS_READ, payload: friendId });

        // Start loading state while fetching past messages
        dispatch({ type: DmActionTypes.SET_LOADING, payload: true });

        try {
            // Ask backend for the correct conversatinID
            const { data } = await authAxios.get(`/chat/conversation-with/${friendId}`);
            const conversationID = data.conversation_id;

            // Fetch historical messages using resolved conversation ID
            const res = await chatAPI.fetchConversationMessages(authAxios, conversationID);
            dispatch({ type: DmActionTypes.SET_MESSAGES, payload: res.data });
        } catch (err) {
            console.error("Failed to fetch conversation messages:", err);
            dispatch({ type: DmActionTypes.SET_LOADING, payload: false });
        }
        };

        // ✅ Incoming message received
        socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
            dispatch({ type: DmActionTypes.RECEIVE_MESSAGE, payload: data });
        }
        };

        // 🔴 Socket closed cleanly
        socket.onclose = () => {
        dispatch({ type: DmActionTypes.CLOSE_CHAT });
        };

        // 🔥 Socket encountered error
        socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        };
    };

    /**
     * sendMessage(content)
     * ----------------------------------------------------------------
     * Sends a new message over the WebSocket if it's open.
     */
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

    /**
     * closeChat()
     * ----------------------------------------------------------------
     * Closes socket connection and clears DM state.
     */
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
        }}
        >
        {children}
        </DirectMessageContext.Provider>
    );
};
