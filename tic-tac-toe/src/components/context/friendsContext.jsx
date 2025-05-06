// ✅ UPDATED FriendsProvider with on-demand loading
import { createContext, useContext, useReducer, useCallback } from "react";
import useFriendAPI from "../hooks/useFriendAPI";
import { INITIAL_FRIEND_STATE, friendReducer } from "../reducers/friendReducer";

export const FriendsContext = createContext(undefined);

export const useFriends = () => {
    const context = useContext(FriendsContext);
    if (!context) throw new Error("useFriends must be used within a FriendsProvider");
    return context;
    };

    export const FriendsProvider = ({ children }) => {
    const [state, dispatch] = useReducer(friendReducer, INITIAL_FRIEND_STATE);
    const { fetchFriends, fetchPending, sendRequest, acceptRequest, declineRequest } = useFriendAPI();

    // ✅ Moved loading logic into an exported function
    const loadFriendData = useCallback(async () => {
        dispatch({ type: "SET_LOADING", payload: true });
        try {
        const [friendsRes, pendingRes] = await Promise.all([
            fetchFriends(),
            fetchPending(),
        ]);
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

    const handleDeclineRequest = useCallback(async (id) => {
        try {
        await declineRequest(id);
        await loadFriendData(); // Refresh after decline
        } catch (error) {
        console.error("Failed to decline friend request:", error);
        }
    }, [declineRequest, loadFriendData]);

    const value = {
        ...state,
        refreshFriends: loadFriendData, // ❗ only call this manually when needed
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

