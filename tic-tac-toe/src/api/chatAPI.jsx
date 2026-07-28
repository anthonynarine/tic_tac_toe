// # Filename: src/api/chatAPI.js

/**
 * Chat API helpers (Direct Messages)
 *
 * Notes:
 * - All functions expect an authenticated Axios instance (authAxios).
 * - Keep these REST-only. WS is handled by websocket providers/consumers.
 */

/**
 * Resolve (or create) the 1-on-1 conversation with a friend.
 * Backend: GET /api/chat/conversation-with/<friend_id>/
 *
 * Expected response: { conversation_id: number }
 */
const getConversationWith = async (authAxios, friendId) => {
  return await authAxios.get(`/chat/conversation-with/${friendId}/`);
};

/**
 * Fetch messages for a conversation.
 * Backend: GET /api/chat/conversations/<conversation_id>/messages/
 */
const fetchConversationMessages = async (authAxios, conversationId) => {
  return await authAxios.get(`/chat/conversations/${conversationId}/messages/`);
};

/**
 * Mark a conversation as read for the current user.
 * Backend: POST /api/chat/conversations/<conversation_id>/mark-read/
 */
const markConversationRead = async (authAxios, conversationId) => {
  return await authAxios.post(`/chat/conversations/${conversationId}/mark-read/`);
};

/**
 * Soft-delete a conversation for the current user (does not delete for the other participant).
 * Backend: DELETE /api/chat/conversations/<conversation_id>/
 */
const deleteConversation = async (authAxios, conversationId) => {
  return await authAxios.delete(`/chat/conversations/${conversationId}/`);
};

const getUnreadSummary = async (authAxios) => {
  return await authAxios.get(`/chat/unread-summary/`);
};

const fetchGroups = async (authAxios) => {
  return await authAxios.get(`/chat/groups/`);
};

const createGroup = async (authAxios, { name, memberIds }) => {
  return await authAxios.post(`/chat/groups/`, {
    name,
    member_ids: memberIds,
  });
};

const fetchGroupMessages = async (authAxios, roomId) => {
  return await authAxios.get(`/chat/groups/${roomId}/messages/`);
};

const markGroupRead = async (authAxios, roomId) => {
  return await authAxios.post(`/chat/groups/${roomId}/mark-read/`);
};

const clearGroupHistory = async (authAxios, roomId) => {
  return await authAxios.delete(`/chat/groups/${roomId}/clear/`);
};

const deleteGroup = async (authAxios, roomId) => {
  return await authAxios.delete(`/chat/groups/${roomId}/delete/`);
};

const addGroupMembers = async (authAxios, roomId, memberIds) => {
  return await authAxios.post(`/chat/groups/${roomId}/members/`, {
    member_ids: memberIds,
  });
};

const removeGroupMember = async (authAxios, roomId, userId) => {
  return await authAxios.delete(`/chat/groups/${roomId}/members/${userId}/`);
};

const chatAPI = {
  getConversationWith,
  fetchConversationMessages,
  markConversationRead,
  deleteConversation,
  getUnreadSummary,
  fetchGroups,
  createGroup,
  fetchGroupMessages,
  markGroupRead,
  clearGroupHistory,
  deleteGroup,
  addGroupMembers,
  removeGroupMember,
};

export default chatAPI;
