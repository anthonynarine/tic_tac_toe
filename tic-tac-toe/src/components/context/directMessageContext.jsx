import { createContext, useContext, useReducer,} from "react";
import Cookies from "js-cookie";
import { directMessageReducer, DmActionTypes, initialDMState } from "../reducers/directMessaeReducer";
import { useUserContext } from "./userContext"; // 🔁 Assuming your user context is here

/**
 * DirectMessageContext
 *
 * Provides shared state for 1-on-1 direct messaging functionality.
 */
export const DirectMessageContext = createContext(undefined);

/**
 * useDirectMessage
 *
 * Custom hook to access the DirectMessageContext safely.
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
     * Wraps the app or component tree in context that manages direct messaging.
     */
    export const DirectMessageProvider = ({ children }) => {
    const [state, dispatch] = useReducer(directMessageReducer, initialDMState);
    const { user } = useUserContext();

    /**
     * Initiates a new direct message WebSocket connection to the given friend.
     *
     * @param {Object} friend - The friend object with an `id` and `friend_name`.
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
     * Sends a direct message to the current active chat socket.
     *
     * @param {string} content - The message content to send.
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
     * Closes the current chat and resets DM state.
     */
    const closeChat = () => {
        dispatch({ type: DmActionTypes.CLOSE_CHAT });
    };

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
