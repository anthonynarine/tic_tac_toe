// File: api/chatAPI.js

/**
 * Fetches messages from a 1-on-1 direct message conversation.
 *
 * @param {AxiosInstance} authAxios - Your authenticated axios instance
 * @param {string|number} conversationId - ID from backend (user_id or conversation_id)
 * @returns {Promise<Array>} - List of message objects
 */
const fetchConversationMessages = (authAxios, conversationId) => {
  return authAxios.get(`/chat/conversations/${conversationId}/messages/`);
};

// ✅ Assign to named object before exporting
const chatAPI = {
    fetchConversationMessages,
};

export default chatAPI;
