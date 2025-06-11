// File: directMessaeReducer.js (updated with game/lobby persistence)

export const initialDMState = {
  activeChat: null,
  socket: null,
  messages: {}, // { [friendId]: [message1, message2, ...] }
  isLoading: false,
  activeFriendId: null,
  unreadCounts: {},
  activeLobbyId: null,
  activeGameId: null,
};

export const DmActionTypes = {
  OPEN_CHAT: "OPEN_CHAT",
  CLOSE_CHAT: "CLOSE_CHAT",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  SET_MESSAGES: "SET_MESSAGES",
  SET_LOADING: "SET_LOADING",
  INCREMENT_UNREAD: "INCREMENT_UNREAD",
  RESET_UNREAD: "RESET_UNREAD",
  SET_ACTIVE_LOBBY: "SET_ACTIVE_LOBBY",
  SET_ACTIVE_GAME: "SET_ACTIVE_GAME",
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
        type,
        game_id,
      } = action.payload;

      const friendId = sender_id === currentUserId ? receiver_id : sender_id;

      const newMessage = {
        id: message_id,
        sender_id,
        receiver_id,
        content: type === "game_invite" ? null : message,
        type: type || "message",
        game_id: game_id || null,
      };

      const thread = Array.isArray(state.messages?.[friendId])
        ? state.messages[friendId]
        : [];

      const alreadyExists = thread.some((msg) => msg.id === message_id);
      if (alreadyExists) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [friendId]: [...thread, newMessage],
        },
      };
    }

    case DmActionTypes.INCREMENT_UNREAD: {
      const { friendId } = action.payload;
      const count = state.unreadCounts?.[friendId] || 0;

      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [friendId]: count + 1,
        },
      };
    }

    case DmActionTypes.RESET_UNREAD: {
      const { friendId } = action.payload;

      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [friendId]: 0,
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

    case DmActionTypes.SET_ACTIVE_LOBBY:
      localStorage.setItem("activeLobbyId", action.payload);
      return {
        ...state,
        activeLobbyId: action.payload,
      };

    case DmActionTypes.SET_ACTIVE_GAME:
      localStorage.setItem("activeGameId", action.payload);
      return {
        ...state,
        activeGameId: action.payload,
      };

    default:
      console.warn("Unknown action type in directMessageReducer:", action.type);
      return state;
  }
}
