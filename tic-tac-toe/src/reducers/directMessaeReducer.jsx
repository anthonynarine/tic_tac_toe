// # Filename: src/components/reducers/directMessaeReducer.jsx

/**
 * directMessaeReducer.jsx
 * ----------------------
 * Single source of truth for DM state:
 * - activeChat (selected friend object)
 * - activeFriendId (other user id)
 * - socket (WebSocket instance)
 * - messages (keyed by friendId)
 * - unreadCounts (keyed by friendId)
 *
 * NOTE (tech debt):
 * This file currently writes to localStorage in SET_ACTIVE_LOBBY / SET_ACTIVE_GAME to preserve
 * existing behavior. In a strict “pure reducer” setup, move those writes to effects in the provider.
 */

export const initialDMState = {
  activeChat: null,
  activeFriendId: null,

  socket: null,
  isLoading: false,

  // messages[friendId] = array of message objects
  messages: {},

  // unreadCounts[friendId] = number
  unreadCounts: {},

  // optional: used by your current app for navigation hints
  activeLobbyId: null,
  activeGameId: null,

  // optional: friendId -> conversationId (useful for delete/mark-read flows)
  conversationIds: {},
};

export const DmActionTypes = {
  // chat lifecycle
  OPEN_CHAT: "OPEN_CHAT",
  CLOSE_CHAT: "CLOSE_CHAT",
  SET_LOADING: "SET_LOADING",

  // history + realtime
  SET_MESSAGES: "SET_MESSAGES",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  CLEAR_THREAD: "CLEAR_THREAD",

  // unread
  INCREMENT_UNREAD: "INCREMENT_UNREAD",
  RESET_UNREAD: "RESET_UNREAD",
  SET_UNREAD_COUNTS: "SET_UNREAD_COUNTS",

  // optional conversation id cache
  SET_CONVERSATION_ID: "SET_CONVERSATION_ID",

  // app integrations (kept for compatibility)
  SET_ACTIVE_LOBBY: "SET_ACTIVE_LOBBY",
  SET_ACTIVE_GAME: "SET_ACTIVE_GAME",
};

const normalizeFriendKey = (friendId) => String(friendId);

const safeNumber = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

export function directMessageReducer(state, action) {
  switch (action.type) {
    // ---------------------------
    // Step 1: Open / Close chat
    // ---------------------------
    case DmActionTypes.OPEN_CHAT: {
      const { friend, socket, friendId } = action.payload || {};
      const key = normalizeFriendKey(friendId);

      return {
        ...state,
        activeChat: friend || null,
        activeFriendId: key,
        socket: socket || null,
        isLoading: false,
      };
    }

    case DmActionTypes.CLOSE_CHAT: {
      return {
        ...state,
        activeChat: null,
        activeFriendId: null,
        socket: null,
        isLoading: false,
      };
    }

    case DmActionTypes.SET_LOADING: {
      return {
        ...state,
        isLoading: Boolean(action.payload),
      };
    }

    // ---------------------------
    // Step 2: Messages
    // ---------------------------
    case DmActionTypes.SET_MESSAGES: {
      const { friendId, messages } = action.payload || {};
      const key = normalizeFriendKey(friendId);

      return {
        ...state,
        isLoading: false,
        messages: {
          ...state.messages,
          [key]: Array.isArray(messages) ? messages : [],
        },
      };
    }

    case DmActionTypes.RECEIVE_MESSAGE: {
      // Expected payload from WS handler:
      // {
      //   type: "message",
      //   sender_id,
      //   receiver_id,
      //   message_id?,
      //   timestamp?,
      //   message/content,
      //   currentUserId
      // }
      const payload = action.payload || {};
      const senderId = payload.sender_id;
      const receiverId = payload.receiver_id;
      const currentUserId = payload.currentUserId;

      // Determine which friend bucket this message belongs to:
      // - If I'm the sender, bucket under receiverId
      // - If I'm the receiver, bucket under senderId
      const friendId =
        String(senderId) === String(currentUserId) ? receiverId : senderId;

      if (!friendId) return state;

      const key = normalizeFriendKey(friendId);
      const existing = Array.isArray(state.messages[key]) ? state.messages[key] : [];

      // De-dupe by message_id if present (safer on reconnect)
      const msgId = payload.message_id ?? payload.id ?? null;
      const alreadyExists =
        msgId != null && existing.some((m) => String(m.id ?? m.message_id) === String(msgId));

      const nextMessage = {
        // normalize fields to what your UI likely expects
        id: msgId ?? undefined,
        message_id: msgId ?? undefined,
        sender_id: senderId,
        receiver_id: receiverId,
        content: payload.message ?? payload.content ?? "",
        message: payload.message ?? payload.content ?? "",
        timestamp: payload.timestamp ?? null,
        is_read: payload.is_read ?? false,
      };

      const nextThread = alreadyExists ? existing : [...existing, nextMessage];

      return {
        ...state,
        messages: {
          ...state.messages,
          [key]: nextThread,
        },
        // IMPORTANT:
        // Do NOT increment unread here. Unread is driven by Notification WS (badge bus)
        // to avoid double-counting.
      };
    }

    case DmActionTypes.CLEAR_THREAD: {
      const { friendId } = action.payload || {};
      const key = normalizeFriendKey(friendId);

      const nextMessages = { ...state.messages };
      delete nextMessages[key];

      const nextUnread = { ...state.unreadCounts };
      nextUnread[key] = 0;

      return {
        ...state,
        messages: nextMessages,
        unreadCounts: nextUnread,
      };
    }

    // ---------------------------
    // Step 3: Unread counts
    // ---------------------------
    case DmActionTypes.INCREMENT_UNREAD: {
      const { friendId } = action.payload || {};
      const key = normalizeFriendKey(friendId);

      const prev = safeNumber(state.unreadCounts[key]);
      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [key]: prev + 1,
        },
      };
    }

    case DmActionTypes.RESET_UNREAD: {
      const { friendId } = action.payload || {};
      const key = normalizeFriendKey(friendId);

      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [key]: 0,
        },
      };
    }

    case DmActionTypes.SET_UNREAD_COUNTS: {
      // payload: { unreadCounts: { [friendId]: number } }
      const next = action.payload?.unreadCounts;

      // Defensive: don't wipe state if payload is missing/bad
      if (!next || typeof next !== "object") return state;

      // Normalize keys to strings + values to numbers
      const normalized = Object.fromEntries(
        Object.entries(next).map(([k, v]) => [String(k), safeNumber(v)])
      );

      return {
        ...state,
        unreadCounts: normalized,
      };
    }

    // ---------------------------
    // Step 4: Conversation id cache
    // ---------------------------
    case DmActionTypes.SET_CONVERSATION_ID: {
      const { friendId, conversationId } = action.payload || {};
      const key = normalizeFriendKey(friendId);

      return {
        ...state,
        conversationIds: {
          ...state.conversationIds,
          [key]: conversationId,
        },
      };
    }

    // ---------------------------
    // Step 5: Compatibility actions
    // ---------------------------
    case DmActionTypes.SET_ACTIVE_LOBBY: {
      // NOTE: side-effect in reducer retained to preserve existing behavior
      try {
        localStorage.setItem("activeLobbyId", action.payload);
      } catch (_) {}

      return {
        ...state,
        activeLobbyId: action.payload,
      };
    }

    case DmActionTypes.SET_ACTIVE_GAME: {
      // NOTE: side-effect in reducer retained to preserve existing behavior
      try {
        localStorage.setItem("activeGameId", action.payload);
      } catch (_) {}

      return {
        ...state,
        activeGameId: action.payload,
      };
    }

    default: {
      // Keep your existing warning pattern (helps catch typos)
      // eslint-disable-next-line no-console
      console.warn("Unknown action type in directMessageReducer:", action.type);
      return state;
    }
  }
}
