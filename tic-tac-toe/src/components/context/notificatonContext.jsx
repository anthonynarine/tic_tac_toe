import { createContext, useContext, useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { useUserContext } from "./userContext";
import { useDirectMessage } from "./directMessageContext";
import { useUI } from "./uiContext";

export const NotificationContext = createContext(undefined);

/**
 * useNotification
 * ----------------------------
 * Custom hook to access the Notification WebSocket context.
 * Currently unused but reserved for future interactive usage.
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
 * Global WebSocket provider for user-level real-time notifications.
 *
 * Features:
 * - Connects to /ws/notifications/?token=<jwt>
 * - Dispatches INCREMENT_UNREAD for new DM or game_invite events
 * - Skips notification if drawer is already open for that sender
 * - Automatically reconnects on socket closure (e.g. token expiry)
 *
 * Wrapped around the entire app after login.
 */
export const NotificationProvider = ({ children }) => {
    const { user } = useUserContext();
    const { dispatch, state } = useDirectMessage();
    const { isDMOpen } = useUI();
    const socketRef = useRef(null);
    const retryRef = useRef(null);

    const getToken = () =>
        process.env.NODE_ENV === "production"
        ? Cookies.get("access_token")
        : localStorage.getItem("access_token");

    useEffect(() => {
        if (!user?.id) return;

        const WS_BASE =
        process.env.NODE_ENV === "production"
            ? `wss://${process.env.REACT_APP_BACKEND_WS}`
            : "ws://localhost:8000";

        let socket;

        /**
         * connectSocket
         * ----------------------------
         * Opens the notification socket and wires up lifecycle events.
         * Re-attempts connection if it closes unexpectedly.
         */
        const connectSocket = () => {
        const token = getToken();
        socket = new WebSocket(`${WS_BASE}/ws/notifications/?token=${token}`);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log("🔔 Notification socket connected.");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const { type, sender_id } = data;

            console.log("📥 Notification received:", data);

            // Only show badge if we're not already chatting with that user
            if (
            (type === "dm" || type === "game_invite") &&
            (!isDMOpen || state.activeFriendId !== sender_id)
            ) {
            dispatch({
                type: "INCREMENT_UNREAD",
                payload: { friendId: sender_id },
            });
            }
        };

        socket.onerror = (err) => {
            console.error("❌ Notification socket error:", err);
        };

        socket.onclose = () => {
            console.log("🔌 Notification socket disconnected. Reconnecting...");
            retryRef.current = setTimeout(connectSocket, 5000); // Retry in 5s
        };
        };

        connectSocket();

        return () => {
        socket?.close();
        clearTimeout(retryRef.current);
        };
    }, [user?.id]);

    return (
        <NotificationContext.Provider value={{}}>
        {children}
        </NotificationContext.Provider>
    );
};
