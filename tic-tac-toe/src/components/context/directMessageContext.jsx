import { createContext, useContext, useReducer } from "react";
import Cookies from "js-cookie";
import {
    directMessageReducer,
    DmActionTypes,
    initialDMState,
} from "../reducers/directMessaeReducer";
import { useUserContext } from "./userContext";

/**
 * DirectMessageContext
 *
 * React Context for managing real-time 1-on-1 direct messaging between friends.
 * Provides WebSocket lifecycle management, unread state tracking, and message dispatching.
 */
export const DirectMessageContext = createContext(undefined);

/**
 * useDirectMessage
 *
 * Safely accesses the DirectMessageContext. Ensures the hook is used inside a provider.
 *
 * @returns {Object} Direct messaging context including state and action methods.
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
 * Provides WebSocket-based direct messaging functionality to authenticated users.
 * Handles:
 * - Establishing private WebSocket channels
 * - Routing incoming messages to reducer
 * - Managing unread state per sender
 * - Preventing crashes during logout
 *
 * @param {React.ReactNode} children - Wrapped components
 * @returns {JSX.Element} Provider component
 */
export const DirectMessageProvider = ({ children }) => {
    const [state, dispatch] = useReducer(directMessageReducer, initialDMState);
    const { user } = useUserContext();

    /**
   * openChat
   *
   * Opens a WebSocket connection for 1-on-1 chat with a specific friend.
   * Determines correct target based on friend relationship direction.
   *
   * @param {Object} friend - Friend object from the accepted list
   */
    const openChat = (friend) => {
        console.log("[DM] openChat received:", friend);

        const token =
        process.env.NODE_ENV === "production"
            ? Cookies.get("access_token")
            : localStorage.getItem("access_token");

        const isCurrentUserFrom = friend.from_user === user.id;
        const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

        const socket = new WebSocket(
        `ws://localhost:8000/ws/chat/${friendId}/?token=${token}`
        );

        socket.onopen = () => {
        dispatch({
            type: DmActionTypes.OPEN_CHAT,
            payload: { friend, socket },
        });
        };

        socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
            dispatch({ type: DmActionTypes.RECEIVE_MESSAGE, payload: data });
        }
        };

        socket.onclose = () => {
        dispatch({ type: DmActionTypes.CLOSE_CHAT });
        };

        socket.onerror = (err) => {
        console.error("DM WebSocket error:", err);
        };
    };

    /**
   * sendMessage
   *
   * Sends a message over the current active WebSocket connection.
   * Silently fails if the connection is closed.
   *
   * @param {string} content - The message text to send
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
     * closeChat
     *
     * Closes the active chat and resets chat state.
     */
    const closeChat = () => {
        dispatch({ type: DmActionTypes.CLOSE_CHAT });
    };

    // Combined context value
    const value = {
        ...state,
        openChat,
        closeChat,
        sendMessage,
    };

    return (
        <DirectMessageContext.Provider value={value}>
        {children}
        </DirectMessageContext.Provider>
    );
};
