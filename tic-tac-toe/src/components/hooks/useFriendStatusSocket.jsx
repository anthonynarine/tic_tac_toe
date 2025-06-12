import { useEffect, useRef } from "react";
import Cookies from "js-cookie";

/**
 * useFriendStatusSocket
 * ----------------------------------------
 * Establishes a WebSocket connection to the FriendStatusConsumer backend.
 * Reconnects automatically if disconnected (e.g. token expired, network drop).
 *
 * Responsibilities:
 * - Authenticates user via token query param
 * - Subscribes to real-time friend presence events
 * - Dispatches STATUS_UPDATE actions to friendsReducer
 * - Reconnects automatically using fresh token on socket close
 *
 * @param {object} user - The authenticated user object
 * @param {function} dispatch - FriendsContext dispatch method
 */
const useFriendStatusSocket = (user, dispatch) => {
    const socketRef = useRef(null);
    const retryTimeoutRef = useRef(null);

    useEffect(() => {
        if (!user?.id) return;

        /**
         * Step 1: Construct WebSocket connection
         * Handles open, message, error, and close events
         */
        const connect = () => {
        // Step 1a: Retrieve current JWT token
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

        // Step 1b: Build WebSocket URL
        const backendHost = process.env.REACT_APP_BACKEND_WS || "localhost:8000";
        const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
        const socket = new WebSocket(`${wsScheme}://${backendHost}/ws/friends/status/?token=${token}`);
        socketRef.current = socket;

        // Step 1c: Handle successful connection
        socket.onopen = () => {
            console.log("✅ Friend status WebSocket connected");
        };

        // Step 1d: Handle incoming messages
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("📬 Received WS message:", data);

            if (data.type === "status_update") {
            dispatch({ type: "STATUS_UPDATE", payload: data });
            }
        };

        // Step 1e: Handle socket close and schedule reconnect
        socket.onclose = () => {
            console.warn("❌ Friend status WebSocket closed. Attempting reconnect...");
            retryTimeoutRef.current = setTimeout(connect, 5000); // Retry in 5 seconds
        };

        // Step 1f: Handle WebSocket error
        socket.onerror = (e) => {
            console.error("WebSocket error:", e);
        };
        };

        // Step 2: Initialize the socket connection
        connect();

        // Step 3: Clean up on unmount or user change
        return () => {
        console.log("🧹 Closing Friend status WebSocket");
        socketRef.current?.close();
        clearTimeout(retryTimeoutRef.current);
        };
    }, [user?.id, dispatch]);
};

export default useFriendStatusSocket;
