import { useCallback } from "react";
import useAuthAxios from "./useAuthAxios";

/**
 * useChatAPI
 *
 * Provides memoized chat-related REST API methods using secure Axios.
 * Covers fetching conversation messages and future chat actions.
 */
const useChatAPI = () => {
    const { authAxios } = useAuthAxios();

    /**
     * Fetches all messages in a given conversation thread.
     * @param {string} conversationId - Deterministic ID from backend
     * @returns {Promise<Array>} - List of message objects
     */
    const fetchConversationMessages = useCallback((conversationId) => {
        return authAxios.get(`/chat/conversations/${conversationId}/messages/`);
    }, [authAxios]);

    // Future: markAsRead, sendImageMessage, etc.

    return {
        fetchConversationMessages,
    };
};

export default useChatAPI;
