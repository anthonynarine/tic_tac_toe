import { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import useFriendAPI from "../hooks/useFriendAPI";
import { INITIAL_FRIEND_STATE, friendReducer } from "../reducers/friendReducer";

// Context to provide friend related state and actions globally
export const FriendsContext = createContext(undefined);

// Custom hook to access the FriendsContext safely.
// Ensures components only use it within a <FriendsProvider>.
export const useFriends = () => {
    const context = useContext(FriendsContext);
    if (!context) throw new Error("useFriends must be used within a FriendsProvider");
    return context;
};


// Wrap the app globally or locally in this provider to expose friend state and actions.
export const FriendsProvider = ({ children }) => {
    const [state, dispatch] = useReducer(friendReducer, INITIAL_FRIEND_STATE);

    // API methods from custom hook (authAxios-backed)
    const { fetchFriends, fetchPending, sendRequest, acceptRequest, declineRequest } = useFriendAPI();

    // Fetches both accepted friends and pending requests in parallel.
   // Updates context state accordingly.
    const loadFriendData = useCallback(async () => {
        dispatch({ type: "SET_LOADING", payload: true});
        try {
            const [friendsRes, pendingRes] = await Promise.all([
                fetchFriends(),
                fetchPending(),
            ]);
            dispatch({ type: "SET_ERROR", payload: null });
            dispatch({ type: "SET_FRIENDS", payload: friendsRes.data});
            dispatch({ type: "SET_PENDING", payload: pendingRes.data});
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
            await loadFriendData();  // Refresh list after decline
            } catch (error) {
            console.error("Failed to decline friend request:", error);
            }
        }, [declineRequest, loadFriendData]);
        

    // Load friend data on mount. 
    useEffect(() => {
        loadFriendData()
    }, [loadFriendData])

    const value = {
        ...state,
        refreshFriends: loadFriendData,
        sendRequest,
        acceptRequest,
        declineRequest: handleDeclineRequest, // Wrapped to refresh list
    };

    return (
        <FriendsContext.Provider value={value}>
            {children}
        </FriendsContext.Provider>
    )
};