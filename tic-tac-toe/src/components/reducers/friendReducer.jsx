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

        default:
        console.warn("Unknown action type in friendReducer:", action.type);
        return state; // Ensures state is returned even on unknown actions
    }
}
