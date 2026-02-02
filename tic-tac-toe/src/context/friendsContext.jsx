// context/friendsContext.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
    createContext,
    useContext,
    useReducer,
    useCallback,
} from "react";
import useFriendAPI from "../api/useFriendAPI"
import { INITIAL_FRIEND_STATE, friendReducer } from "../reducers/friendReducer";
import { useUserContext } from "../context/userContext";
import useFriendStatusSocket from "../components/friends/hooks/useFriendStatusSocket"

/**
 * Context for managing and accessing friend-related state and actions
 */
export const FriendsContext = createContext(undefined);

/**
 * Custom hook to access FriendsContext.
 * Throws an error if used outside the FriendsProvider.
 */
export const useFriends = () => {
    const context = useContext(FriendsContext);
    if (!context) throw new Error("useFriends must be used within a FriendsProvider");
    return context;
};

/**
 * FriendsProvider sets up all friend-related state management and WebSocket subscriptions.
 *
 * Features:
 * 1. Fetches friend and pending request data via REST API
 * 2. Tracks friend status updates via WebSocket (real-time online/offline)
 * 3. Provides context actions for sending, accepting, and declining requests
 */
export const FriendsProvider = ({ children }) => {
    const [state, dispatch] = useReducer(friendReducer, INITIAL_FRIEND_STATE);
    const { fetchFriends, fetchPending, sendRequest, acceptRequest, declineRequest } = useFriendAPI();
    const { user } = useUserContext();

      // Log user changes
    console.log("FriendsProvider: current user", user);

    // ✅ STEP 1: Establish real-time friend status listener
    useFriendStatusSocket(user, dispatch);

    /**
     * ✅ STEP 2: Load friend data from backend (REST)
     * - Called on initial load or refresh
     */
    const loadFriendData = useCallback(async () => {
        console.log("FriendsProvider: loadFriendData called");
        dispatch({ type: "SET_LOADING", payload: true });
        try {
        const [friendsRes, pendingRes] = await Promise.all([
            fetchFriends(),
            fetchPending(),
        ]);

        console.log("FriendsProvider: fetched friends", friendsRes.data);
        console.log("FriendsProvider: fetched pending", pendingRes.data);

        dispatch({ type: "SET_ERROR", payload: null });
        dispatch({ type: "SET_FRIENDS", payload: friendsRes.data });
        dispatch({
            type: "SET_PENDING",
            payload: {
            sent: pendingRes.data.sent_requests,
            received: pendingRes.data.received_requests,
            },
        });
        } catch (error) {
        dispatch({
            type: "SET_ERROR",
            payload: error?.response?.data?.detail || error.message || "Unknown error",
        });
        console.error("Friend data load failed", error);
        } finally {
        dispatch({ type: "SET_LOADING", payload: false });
        }
    }, [fetchFriends, fetchPending]);

    /**
     * ✅ STEP 3: Handle decline request action
     * - Triggers friend deletion and reloads friend list
     */
    const handleDeclineRequest = useCallback(
        async (id) => {
        try {
            await declineRequest(id);
            await loadFriendData(); // Refresh after decline
        } catch (error) {
            console.error("Failed to decline friend request:", error);
        }
        },
        [declineRequest, loadFriendData]
    );

    const location = useLocation();
    
    useEffect(() => {

        // # Step 1: Dev-only provider mount logging
        if (process.env.NODE_ENV === "development") {
            console.log("[MOUNT] NotificationProvider", location.pathname);
        }

        return () => {
            if (process.env.NODE_ENV === "development") {
            console.log("[UNMOUNT] NotificationProvider", location.pathname);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

    // ✅ STEP 4: Provide full friend-related state and actions
    const value = {
        ...state,
        refreshFriends: loadFriendData,
        sendRequest,
        acceptRequest,
        declineRequest: handleDeclineRequest,
    };

    return (
        <FriendsContext.Provider value={value}>
        {children}
        </FriendsContext.Provider>
    );
};
