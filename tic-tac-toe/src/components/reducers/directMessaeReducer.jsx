// File: directMessaeReducer.js (updated with correct SET_MESSAGES handling)

export const initialDMState = {
  activeChat: null,
  socket: null,
  messages: {}, // { [friendId]: [message1, message2, ...] }
  isLoading: false,
  activeFriendId: null,
};

export const DmActionTypes = {
  OPEN_CHAT: "OPEN_CHAT",
  CLOSE_CHAT: "CLOSE_CHAT",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  SET_MESSAGES: "SET_MESSAGES",
  SET_LOADING: "SET_LOADING",
};

export function directMessageReducer(state, action) {
  switch (action.type) {
    case DmActionTypes.OPEN_CHAT:
      return {
        ...state,
        activeChat: action.payload.friend,
        socket: action.payload.socket,
        messages: state.messages, // keep current threads
        isLoading: true,
        activeFriendId: action.payload.friendId,
      };

    case DmActionTypes.CLOSE_CHAT:
      try {
        state.socket?.close();
      } catch (err) {
        console.warn("WebSocket close error:", err);
      }
      return {
        ...initialDMState,
        activeFriendId: null,
      };

    case DmActionTypes.RECEIVE_MESSAGE: {
      const {
        sender_id,
        receiver_id,
        message,
        message_id,
        currentUserId,
      } = action.payload;

      const friendId = sender_id === currentUserId ? receiver_id : sender_id;

      const newMessage = {
        id: message_id,
        sender_id,
        receiver_id,
        content: message,
      };

      const thread = Array.isArray(state.messages?.[friendId])
        ? state.messages[friendId]
        : [];

      if (thread.some((msg) => msg.id === message_id)) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [friendId]: [...thread, newMessage],
        },
      };
    }

    case DmActionTypes.SET_MESSAGES: {
      const { friendId, messages: newMessages } = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          [friendId]: newMessages,
        },
        isLoading: false,
      };
    }

    case DmActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      console.warn("Unknown action type in directMessageReducer:", action.type);
      return state;
  }
}
