import { useCallback } from "react";
import useAuthAxios from "../auth/hooks/useAuthAxios"

/**
 * useFriendAPI
 *
 * Returns a stable set of token-authenticated API methods for managing friends.
 * All methods are memoized using useCallback to ensure consistent references,
 * which prevents unnecessary re-renders in consuming components or contexts.
 */
const useFriendAPI = () => {
  const { authAxios } = useAuthAxios(); // Secure Axios instance with JWT and refresh handling

  /**
   * Get the current user's accepted friends.
   * Returns a promise resolving to a list of friendship records.
   */
  const fetchFriends = useCallback(() => {
    return authAxios.get("/friends/friends/");
  }, [authAxios]);

  /**
   * Get pending friend requests (both sent and received).
   */
  const fetchPending = useCallback(() => {
    return authAxios.get("/friends/pending/");
  }, [authAxios]);

  /**
   * Send a new friend request to the given email address.
   */
  const sendRequest = useCallback((email) => {
    return authAxios.post("/friends/", { to_user_email: email });
  }, [authAxios]);

  /**
   * Accept a friend request by its database ID.
   */
  const acceptRequest = useCallback((id) => {
    return authAxios.post(`/friends/${id}/accept/`);
  }, [authAxios]);

  /**
   * Decline a friend request by its database ID.
   */
  const declineRequest = useCallback((id) => {
    return authAxios.delete(`/friends/${id}/decline/`);
  }, [authAxios]);

  return {
    fetchFriends,
    fetchPending,
    sendRequest,
    acceptRequest,
    declineRequest,
  };
};

export default useFriendAPI;
