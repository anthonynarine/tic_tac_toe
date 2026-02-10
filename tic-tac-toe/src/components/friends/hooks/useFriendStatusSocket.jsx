// # Filename: src/components/hooks/realtime/useFriendStatusSocket.jsx


import { useEffect, useRef } from "react";

// Step 1: Ensure WS always uses a fresh access token (supports recruiter mode storage)
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken"; 

/**
 * useFriendStatusSocket
 * ----------------------------------------
 * Establishes a WebSocket connection to the FriendStatusConsumer backend.
 * Reconnects automatically if disconnected (e.g. token expired, network drop).
 *
 * Responsibilities:
 * - Authenticates via token query param (?token=...)
 * - Subscribes to real-time friend presence events
 * - Dispatches STATUS_UPDATE actions to friendsReducer
 * - Reconnects with exponential backoff
 * - If auth-like close happens, forces ONE refresh + reconnect
 *
 * @param {object} user - The authenticated user object
 * @param {function} dispatch - Dispatch function for friendsReducer
 */
const useFriendStatusSocket = (user, dispatch) => {
  const socketRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Step 2: Reconnect controls (prevents infinite reconnect thrash)
  const reconnectAttemptRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 15000;

  // Step 3: One-time auth refresh retry guard
  const authRetryAttemptRef = useRef(false);

  // Step 4: Track mounted state to prevent reconnects after unmount
  const isMountedRef = useRef(false);

  // Step 5: Identify auth-like WS closes (browser commonly reports 1006 for handshake failure)
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);

    if (code === 4401) return true; // Unauthorized (if you use it)
    if (code === 1006) return true; // Abnormal close (often handshake rejection)
    return false;
  };

  useEffect(() => {
    isMountedRef.current = true;

    // Step 1: Only connect when we have a user + dispatch
    if (!user?.id || typeof dispatch !== "function") {
      return () => {
        isMountedRef.current = false;
      };
    }

    // Step 2: Build the WS base
    const backendHost = process.env.REACT_APP_BACKEND_WS || "localhost:8000";
    const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";

    // Step 3: Cleanup helpers
    const clearRetry = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const cleanupSocket = () => {
      clearRetry();

      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;

        socketRef.current.close();
        socketRef.current = null;
      }
    };

    // Step 4: Schedule reconnect with exponential backoff
    const scheduleReconnect = (event) => {
      if (!isMountedRef.current) return;

      // Step 4a: One-time “force refresh + reconnect” on auth-like closes
      if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
        authRetryAttemptRef.current = true;

        clearRetry();
        retryTimeoutRef.current = setTimeout(async () => {
          await connect({ forceRefresh: true });
        }, 250);

        return;
      }

      reconnectAttemptRef.current += 1;

      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.warn(
          `❌ FriendStatus WS: max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}).`
        );
        return;
      }

      const delay = Math.min(
        BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
        MAX_DELAY_MS
      );

      console.warn(
        `❌ FriendStatus WS closed (code=${event?.code}). Reconnecting in ${delay}ms...`
      );

      clearRetry();
      retryTimeoutRef.current = setTimeout(async () => {
        await connect({ forceRefresh: false });
      }, delay);
    };

    // Step 5: Connect (refresh token if needed BEFORE opening WS)
    const connect = async ({ forceRefresh = false } = {}) => {
      // Step 5a: Close any previous socket
      cleanupSocket();

      // Step 5b: Ensure we have a fresh access token
      const token = await ensureFreshAccessToken({
        // forceRefresh: use a huge TTL threshold so it always refreshes
        minTtlSeconds: forceRefresh ? 999999999 : 60,
      });

      if (!token) {
        console.warn("FriendStatus WS: no valid token available. Not connecting.");
        return;
      }

      // Step 5c: Build URL + connect
      const url = `${wsScheme}://${backendHost}/ws/friends/status/?token=${token}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("✅ Friend status WebSocket connected");

        // Step 5d: Reset reconnect counters on successful connection
        reconnectAttemptRef.current = 0;
        authRetryAttemptRef.current = false;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📬 FriendStatus WS message:", data);

          if (data?.type === "status_update") {
            dispatch({ type: "STATUS_UPDATE", payload: data });
          }
        } catch (err) {
          console.error("FriendStatus WS parse error:", err);
        }
      };

      socket.onerror = (e) => {
        console.error("FriendStatus WS error:", e);
      };

      socket.onclose = (event) => {
        scheduleReconnect(event);
      };
    };

    // Step 6: Start the connection
    connect({ forceRefresh: false });

    // Step 7: Cleanup on unmount/user change
    return () => {
      isMountedRef.current = false;
      cleanupSocket();

      // Step 7a: Reset counters so next mount starts clean
      reconnectAttemptRef.current = 0;
      authRetryAttemptRef.current = false;
    };
  }, [user?.id, dispatch]);
};

export default useFriendStatusSocket;
