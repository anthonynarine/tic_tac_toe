/**
 * @typedef {Object} DirectMessageState
 * @property {Object|null} activeChat - The currently active friend being chatted with.
 * @property {WebSocket|null} socket - The active WebSocket connection instance.
 * @property {Array<Object>} messages - List of received and sent direct messages.
 * @property {Object} unread - Tracks unread message counts by friend ID.
 * @property {boolean} isLoading - Indicates whether message history is currently loading.
 * @property {number|null} activeFriendId - The ID of the friend in the current conversation.
 */

/**
 * Initial state for the DirectMessageContext.
 */
export const initialDMState = {
    activeChat: null,
    socket: null,
    messages: [],
    unread: {},          // Format: { [friendId]: unreadCount }
    isLoading: false,
    activeFriendId: null,
};

/**
 * Action types used by the directMessageReducer.
 */
export const DmActionTypes = {
    OPEN_CHAT: "OPEN_CHAT",
    CLOSE_CHAT: "CLOSE_CHAT",
    RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
    SET_MESSAGES: "SET_MESSAGES",
    SET_LOADING: "SET_LOADING",
    MARK_AS_READ: "MARK_AS_READ",
};

/**
 * Reducer function to manage DM state transitions.
 *
 * Handles:
 * - Opening & closing WebSocket chat sessions
 * - Receiving and storing live messages
 * - Marking messages as read/unread
 * - Fetching and displaying message history
 *
 * @param {DirectMessageState} state - Current context state
 * @param {Object} action - Action containing type and payload
 * @returns {DirectMessageState} Updated state after action
 */
export function directMessageReducer(state, action) {
    switch (action.type) {
    /**
     * OPEN_CHAT
     * Sets the active friend, initializes the WebSocket connection, and resets messages.
     */
    case DmActionTypes.OPEN_CHAT:
        return {
            ...state,
            activeChat: action.payload.friend,
            socket: action.payload.socket,
            messages: [],
            isLoading: true,
            activeFriendId: action.payload.friendId, // Used for quick matching in RECEIVE_MESSAGE
        };

    /**
     * CLOSE_CHAT
     * Closes the socket safely and resets all DM-related state.
     */
    case DmActionTypes.CLOSE_CHAT:
        try {
            state.socket?.close(); // Prevent WebSocket leaks
        } catch (err) {
            console.warn("WebSocket close error:", err);
        }
        return {
            ...initialDMState,
            activeFriendId: null,
        };

    /**
     * RECEIVE_MESSAGE
     * Handles new incoming messages and updates the unread state.
     */
    case DmActionTypes.RECEIVE_MESSAGE: {
        const { sender_id, receiver_id } = action.payload;

      // Check if the message belongs to the current active friend chat
        const isCurrentChat =
        state.activeFriendId &&
        [sender_id, receiver_id].includes(state.activeFriendId);

        return {
            ...state,
            messages: isCurrentChat
            ? [...state.messages, action.payload]
            : state.messages, // Don't show message if from another chat
            unread: {
            ...state.unread,
            [sender_id]: isCurrentChat
            ? 0
            : (state.unread[sender_id] || 0) + 1, // Increment if message from unseen chat
            },
        };
    }

    /**
     * SET_MESSAGES
     * Populates message history from REST API and ends loading state.
     */
    case DmActionTypes.SET_MESSAGES:
        return {
            ...state,
            messages: action.payload,
            isLoading: false,
        };

    /**
     * SET_LOADING
     * Enables/disables the loading spinner when fetching messages.
     */
    case DmActionTypes.SET_LOADING:
        return {
            ...state,
            isLoading: action.payload,
        };

    /**
     * MARK_AS_READ
     * Clears unread badge for the given friend.
     */
    case DmActionTypes.MARK_AS_READ:
        return {
            ...state,
            unread: {
            ...state.unread,
            [action.payload]: 0,
            },
        };

    /**
     * DEFAULT
     * Logs unknown actions to help catch bugs early.
     */
    default:
        console.warn("Unknown action type in directMessageReducer:", action.type);
        return state;
    }
}
