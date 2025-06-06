/**
 * Initial state for the FriendsContext.
 *
 * @typedef {Object} FriendState
 * @property {Array} friends - List of accepted friends.
 * @property {Object} pending - Object containing sent and received requests.
 * @property {boolean} loading - Indicates whether data is currently loading.
 * @property {Error|null} error - Captures any API or reducer error.
 */
export const INITIAL_FRIEND_STATE = {
    friends: [],
    pending: {
        sent: [],
        received: [],
    },
    loading: false,
    error: null,
};

/**
 * friendReducer
 *
 * Reducer function to manage friend-related state transitions.
 * Used in conjunction with useReducer() inside FriendsContext.
 *
 * @param {FriendState} state - The current state object.
 * @param {Object} action - The dispatched action with type and payload.
 * @returns {FriendState} - Updated state based on the action type.
 */
export function friendReducer(state, action) {
    switch (action.type) {
        case "SET_LOADING":
        return { ...state, loading: action.payload };

        case "SET_FRIENDS":
        return { ...state, friends: action.payload };

        case "SET_PENDING":
        return { ...state, pending: action.payload };

        case "SET_ERROR":
        return { ...state, error: action.payload };

        /**
         * Handles real-time online/offline status updates.
         * - Matches incoming user_id to each friend.friend_id
         * - Updates that friend's friend_status field
         */
        case "STATUS_UPDATE": {
        const { user_id, status } = action.payload;
        console.log("STATUS_UPDATE for user:", user_id, "new status:", status);

        return {
            ...state,
            friends: state.friends.map((friend) =>
            friend.friend_id === user_id
                ? { ...friend, friend_status: status }
                : friend
            ),
        };
        }

        default:
        console.warn("Unknown action type in friendReducer:", action.type);
        return state; // safe fallback
    }
}
