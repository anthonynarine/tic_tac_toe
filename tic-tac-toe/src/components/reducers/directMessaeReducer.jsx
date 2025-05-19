/**
 * @typedef {Object} DirectMessageState
 * @property {Object|null} activeChat - The currently active friend being chatted with.
 * @property {WebSocket|null} socket - The active WebSocket connection instance.
 * @property {Array<Object>} messages - List of received and sent direct messages.
 * @property {Object} unread - Tracks unread message counts by friend ID.
 */

/**
 * Initial state for the DirectMessageContext.
 * Used to manage WebSocket connection and messaging state for 1-on-1 chats.
 */
export const initialDMState = {
    activeChat: null,
    socket: null,
    messages: [],
    unread: {},
};

/**
 * Enum-like object defining available action types for DM reducer.
 */
export const DmActionTypes = {
    OPEN_CHAT: "OPEN_CHAT",
    CLOSE_CHAT: "CLOSE_CHAT",
    RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
    SET_MESSAGES: "SET_MESSAGES"
};

/**
 * Reducer function to manage direct message state transitions.
 * This handles socket setup, message flow, and unread tracking.
 *
 * @param {DirectMessageState} state - Current reducer state.
 * @param {Object} action - Action object with `type` and `payload`.
 * @returns {DirectMessageState} - Updated state after the action is applied.
 */
export function directMessageReducer(state, action) {
    switch (action.type) {
        case DmActionTypes.OPEN_CHAT:
            return {
                ...state,
                activeChat: action.payload.friend,
                socket: action.payload.socket,
                messages: []
            };

        case DmActionTypes.CLOSE_CHAT:
            state.socket?.close(); // Close the socket if open
            return { ...initialDMState };

        case DmActionTypes.RECEIVE_MESSAGE:
            return {
                ...state,
                messages: [...state.messages, action.payload],
                unread: {
                    ...state.unread,
                    [action.payload.sender_id]:
                        state.activeChat?.id === action.payload.sender_id
                            ? 0
                            : (state.unread[action.payload.sender_id] || 0) + 1,
                },
            };

        case DmActionTypes.SET_MESSAGES:
            return {
                ...state,
                messages: action.payload,
            };

        default:
            console.warn("Unknown action type in directMessageReducer:", action.type);
            return state;
    }
}
