// # Filename: src/components/reducer/directMessaeReducer.jsx
// ✅ New Code

/**
 * directMessaeReducer
 * ------------------------------------------------------------
 * DM reducer is now responsible ONLY for direct message threads + DM UI state.
 *
 * Contract:
 * - Invites are NOT stored in DM threads anymore.
 * - DM threads are stored by friendId: messages[friendId] = [...]
 * - Unread counts are stored by friendId: unreadCounts[friendId] = number
 *
 * Added:
 * - CLEAR_THREAD: clears a friend thread (client-side) + resets unread
 * - INCREMENT_UNREAD / RESET_UNREAD: included in action types (was missing)
 */

export const initialDMState = {
  activeChat: null,
  socket: null,
  messages: {}, // { [friendId]: [message1, message2, ...] }
  isLoading: false,
  activeFriendId: null,
  unreadCounts: {}, // { [friendId]: number }
  activeLobbyId: null,
  activeGameId: null,
};

export const DmActionTypes = {
  OPEN_CHAT: "OPEN_CHAT",
  CLOSE_CHAT: "CLOSE_CHAT",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  SET_MESSAGES: "SET_MESSAGES",
  SET_LOADING: "SET_LOADING",
  SET_ACTIVE_LOBBY: "SET_ACTIVE_LOBBY",
  SET_ACTIVE_GAME: "SET_ACTIVE_GAME",

  // ✅ New Code
  INCREMENT_UNREAD: "INCREMENT_UNREAD",
  RESET_UNREAD: "RESET_UNREAD",
  CLEAR_THREAD: "CLEAR_THREAD",
};

export function directMessageReducer(state, action) {
  switch (action.type) {
    case DmActionTypes.OPEN_CHAT:
      return {
        ...state,
        activeChat: action.payload.friend,
        socket: action.payload.socket,

        // keep current threads in memory
        messages: state.messages,
        unreadCounts: state.unreadCounts,

        isLoading: true,
        activeFriendId: action.payload.friendId,
      };

    case DmActionTypes.CLOSE_CHAT: {
      // Step 1: Close socket safely
      try {
        state.socket?.close();
      } catch (err) {
        console.warn("WebSocket close error:", err);
      }

      // Step 2: Do NOT wipe message threads (we want persistence across open/close)
      return {
        ...state,
        activeChat: null,
        socket: null,
        isLoading: false,
        activeFriendId: null,
      };
    }

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
        content: message,
        type: type || "message",
        game_id: game_id || null,
      };

      const thread = Array.isArray(state.messages?.[friendId])
        ? state.messages[friendId]
        : [];

      // Step 1: Dedupe by message_id (prevents reconnect duplicates)
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
      const { friendId } = action.payload || {};
      if (!friendId) return state;

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
      const { friendId } = action.payload || {};
      if (!friendId) return state;

      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [friendId]: 0,
        },
      };
    }

    case DmActionTypes.CLEAR_THREAD: {
      const { friendId } = action.payload || {};
      if (!friendId) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [friendId]: [],
        },
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
          [friendId]: Array.isArray(newMessages) ? newMessages : [],
        },
        isLoading: false,
      };
    }

    case DmActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: Boolean(action.payload),
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
