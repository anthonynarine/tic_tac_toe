import { useEffect, useRef } from "react";
import Cookies from "js-cookie";

/**
 * useFriendStatusSocket
 *
 * Establishes a WebSocket connection to the FriendStatusConsumer backend endpoint.
 * Tracks the authenticated user's connection and listens for status updates
 * from their friends (online/offline).
 *
 * Authentication:
 * - In development, uses `localStorage.getItem("access_token")`
 * - In production, reads `access_token` from cookies (set via secure login)
 *
 * Usage:
 * - Automatically connects when a user is authenticated
 * - Dispatches 'STATUS_UPDATE' actions to the FriendsContext when messages are received
 *
 * Dependencies:
 * - Relies on `user?.id` to trigger connection
 * - Relies on `dispatch` from `friendReducer` to update context state
 *
 * Example usage:
 *   useFriendStatusSocket(user, dispatch)
 *
 * @param {object} user - The authenticated user object
 * @param {function} dispatch - The reducer dispatch method from FriendsContext
 */
const useFriendStatusSocket = (user, dispatch) => {
    const socketRef = useRef(null);

    useEffect(() => {
        if (!user?.id) return;

        //  Get JWT token depending on environment
        const getToken = () => {
            return process.env.NODE_ENV === "production"
                ? Cookies.get("access_token")
                : localStorage.getItem("access_token");
        };

        const token = getToken();

        if (!token) {
            console.error("Access token not found. Cannot initialize FriendStatus WebSocket.");
            return;
        }

        // Determine connection scheme and backend host
        const backendHost = process.env.REACT_APP_BACKEND_WS || "localhost:8000";
        const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";

        // Establish the WebSocket connection to the FriendStatusConsumer
        const socket = new WebSocket(
            `${wsScheme}://${backendHost}/ws/friends/status/?token=${token}`
        );

        socketRef.current = socket;

        //Handle successful connection
        socket.onopen = () => {
            console.log("✅ Friend status WebSocket connected");
        };

        // 📬 Handle incoming messages from the server
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "status_update") {
                // Dispatch action to update friend's status in context
                dispatch({ type: "STATUS_UPDATE", payload: data });
            }
        };

        // ❌ Handle socket closure
        socket.onclose = () => {
            console.warn("❌ Friend status WebSocket closed");
        };

        // ⚠️ Handle connection errors
        socket.onerror = (e) => {
            console.error("WebSocket error:", e);
        };

        // 🧹 Clean up connection on unmount or user change
        return () => socket.close();
    }, [user?.id, dispatch]);
};

export default useFriendStatusSocket;
