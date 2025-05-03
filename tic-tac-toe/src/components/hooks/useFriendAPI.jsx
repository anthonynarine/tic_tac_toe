import useAuthAxios from "./useAuthAxios";

/**
 * useFriendAPI
 *
 * Provides a set of secure, token-authenticated API calls related to the friend system.
 * Wraps your `authAxios` instance so all requests include tokens and refresh logic.
 *
 * This hook is used by the FriendsContext and any component needing access to friend data.
 *
 * @returns {Object} - An object containing methods to interact with the friend system.
 */
const useFriendAPI = () => {
  const { authAxios } = useAuthAxios(); // Secure Axios instance with interceptors

    return {
        /**
         * Fetch all accepted friends of the current user.
         * @returns {Promise} - Axios response containing the list of friends. 
         */
        fetchFriends: () => authAxios.get("/users/friends/friends/"),

        /**
         * Fetch pending friend requests.
         * Includes:
         *  - sent_requests: requests the user has sent
         *  - received_requests: requests the user has received but not yet accepted
         *
         * @returns {Promise} - Axios response with sent and received pending requests.
         */
        fetchPending: () => authAxios.get("/users/friends/pending/"),

        /**
         * Send a friend request to another user.
         *
         * @param {number} to_user - The user ID of the recipient.
         * @returns {Promise} - Axios response confirming the request was created.
         */
        sendRequest: (to_user) => authAxios.post("/users/friends/", { to_user }),

        /**
         * Accept a pending friend request by its ID.
         *
         * @param {number} id - The ID of the friendship record to accept.
         * @returns {Promise} - Axios response confirming the request was accepted.
         */
        acceptRequest: (id) => authAxios.post(`/users/friends/${id}/accept/`),

        /**
        * Decline a pending friend request by its ID.
        *
        * @param {number} id - The ID of the friendship request to decline.
        * @returns {Promise} - Axios response after deletion.
        */
      declineRequest: (id) => authAxios.delete(`/users/friends/${id}/decline/`),
    };
};

export default useFriendAPI;
