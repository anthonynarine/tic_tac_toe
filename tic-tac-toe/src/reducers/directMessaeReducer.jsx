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
  activeMode: null,
  activeChat: null,
  activeFriendId: null,
  activeGroup: null,
  activeGroupId: null,

  socket: null,
  isLoading: false,

  // messages[friendId] = array of message objects
  messages: {},
  groupMessages: {},
  groups: [],

  // unreadCounts[friendId] = number
  unreadCounts: {},
  groupUnreadCounts: {},

  // optional: used by your current app for navigation hints
  activeLobbyId: null,
  activeGameId: null,

  // optional: friendId -> conversationId (useful for delete/mark-read flows)
  conversationIds: {},
};

export const DmActionTypes = {
  // chat lifecycle
  OPEN_CHAT: "OPEN_CHAT",
  OPEN_GROUP_CHAT: "OPEN_GROUP_CHAT",
  CLOSE_CHAT: "CLOSE_CHAT",
  SET_LOADING: "SET_LOADING",

  // history + realtime
  SET_MESSAGES: "SET_MESSAGES",
  SET_GROUPS: "SET_GROUPS",
  UPSERT_GROUP: "UPSERT_GROUP",
  REMOVE_GROUP: "REMOVE_GROUP",
  SET_GROUP_MESSAGES: "SET_GROUP_MESSAGES",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  RECEIVE_GROUP_MESSAGE: "RECEIVE_GROUP_MESSAGE",
  CLEAR_THREAD: "CLEAR_THREAD",
  CLEAR_GROUP_THREAD: "CLEAR_GROUP_THREAD",

  // unread
  INCREMENT_UNREAD: "INCREMENT_UNREAD",
  INCREMENT_GROUP_UNREAD: "INCREMENT_GROUP_UNREAD",
  RESET_UNREAD: "RESET_UNREAD",
  RESET_GROUP_UNREAD: "RESET_GROUP_UNREAD",
  SET_UNREAD_COUNTS: "SET_UNREAD_COUNTS",
  SET_GROUP_UNREAD_COUNTS: "SET_GROUP_UNREAD_COUNTS",

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
        activeMode: "direct",
        activeGroup: null,
        activeGroupId: null,
        socket: socket || null,
        isLoading: false,
      };
    }

    case DmActionTypes.OPEN_GROUP_CHAT: {
      const { group, socket, groupId } = action.payload || {};
      const key = normalizeFriendKey(groupId);

      return {
        ...state,
        activeMode: "group",
        activeChat: null,
        activeFriendId: null,
        activeGroup: group || null,
        activeGroupId: key,
        socket: socket || null,
        isLoading: false,
      };
    }

    case DmActionTypes.CLOSE_CHAT: {
      return {
        ...state,
        activeMode: null,
        activeChat: null,
        activeFriendId: null,
        activeGroup: null,
        activeGroupId: null,
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

    case DmActionTypes.SET_GROUPS: {
      const groups = Array.isArray(action.payload?.groups) ? action.payload.groups : [];
      return {
        ...state,
        groups,
      };
    }

    case DmActionTypes.UPSERT_GROUP: {
      const group = action.payload?.group;
      if (!group?.id) return state;

      const existing = Array.isArray(state.groups) ? state.groups : [];
      const withoutGroup = existing.filter((g) => String(g.id) !== String(group.id));
      return {
        ...state,
        groups: [group, ...withoutGroup],
        activeGroup:
          state.activeGroupId && String(state.activeGroupId) === String(group.id)
            ? group
            : state.activeGroup,
      };
    }

    case DmActionTypes.REMOVE_GROUP: {
      const groupId = action.payload?.groupId;
      const key = normalizeFriendKey(groupId);
      if (!groupId) return state;

      const nextGroupMessages = { ...state.groupMessages };
      delete nextGroupMessages[key];

      const nextGroupUnread = { ...state.groupUnreadCounts };
      delete nextGroupUnread[key];

      const isActiveGroup = state.activeGroupId && String(state.activeGroupId) === key;

      return {
        ...state,
        groups: (state.groups || []).filter((group) => String(group.id) !== key),
        groupMessages: nextGroupMessages,
        groupUnreadCounts: nextGroupUnread,
        activeMode: isActiveGroup ? null : state.activeMode,
        activeGroup: isActiveGroup ? null : state.activeGroup,
        activeGroupId: isActiveGroup ? null : state.activeGroupId,
        socket: isActiveGroup ? null : state.socket,
      };
    }

    case DmActionTypes.SET_GROUP_MESSAGES: {
      const { groupId, messages } = action.payload || {};
      const key = normalizeFriendKey(groupId);

      return {
        ...state,
        isLoading: false,
        groupMessages: {
          ...state.groupMessages,
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

    case DmActionTypes.RECEIVE_GROUP_MESSAGE: {
      const payload = action.payload || {};
      const groupId = payload.room_id ?? payload.group_id ?? payload.groupId;
      if (!groupId) return state;

      const key = normalizeFriendKey(groupId);
      const existing = Array.isArray(state.groupMessages[key]) ? state.groupMessages[key] : [];
      const msgId = payload.message_id ?? payload.id ?? null;
      const alreadyExists =
        msgId != null && existing.some((m) => String(m.id ?? m.message_id) === String(msgId));

      const nextMessage = {
        id: msgId ?? undefined,
        message_id: msgId ?? undefined,
        room: groupId,
        room_id: groupId,
        sender_id: payload.sender_id,
        sender_name: payload.sender_name,
        content: payload.message ?? payload.content ?? "",
        message: payload.message ?? payload.content ?? "",
        timestamp: payload.timestamp ?? null,
      };

      const nextThread = alreadyExists ? existing : [...existing, nextMessage];

      return {
        ...state,
        groupMessages: {
          ...state.groupMessages,
          [key]: nextThread,
        },
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

    case DmActionTypes.CLEAR_GROUP_THREAD: {
      const { groupId } = action.payload || {};
      const key = normalizeFriendKey(groupId);

      return {
        ...state,
        groupMessages: {
          ...state.groupMessages,
          [key]: [],
        },
        groupUnreadCounts: {
          ...state.groupUnreadCounts,
          [key]: 0,
        },
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

    case DmActionTypes.INCREMENT_GROUP_UNREAD: {
      const { groupId } = action.payload || {};
      const key = normalizeFriendKey(groupId);

      const prev = safeNumber(state.groupUnreadCounts[key]);
      return {
        ...state,
        groupUnreadCounts: {
          ...state.groupUnreadCounts,
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

    case DmActionTypes.RESET_GROUP_UNREAD: {
      const { groupId } = action.payload || {};
      const key = normalizeFriendKey(groupId);

      return {
        ...state,
        groupUnreadCounts: {
          ...state.groupUnreadCounts,
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

    case DmActionTypes.SET_GROUP_UNREAD_COUNTS: {
      const next = action.payload?.unreadCounts;
      if (!next || typeof next !== "object") return state;

      const normalized = Object.fromEntries(
        Object.entries(next).map(([k, v]) => [String(k), safeNumber(v)])
      );

      return {
        ...state,
        groupUnreadCounts: normalized,
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
