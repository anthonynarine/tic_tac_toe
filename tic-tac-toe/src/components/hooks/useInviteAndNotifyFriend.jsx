// File: hooks/useInviteAndNotifyFriend.js

import { useNavigate } from "react-router-dom";
import { useDirectMessage } from "../context/directMessageContext";
import { useUI } from "../context/uiContext";

/**
 * Custom hook to invite a friend to a game and notify them via DM.
 *
 * @returns {Function} invite(friend)
 */
export const useInviteAndNotifyFriend = () => {
    const {
        openChat,
        setDMOpen,
        sendMessage,
        sendGameInvite,
        dispatch,
    } = useDirectMessage();

    const { setDMOpen: setDrawerOpen } = useUI();
    const navigate = useNavigate();

    const invite = async (friend) => {
        try {
        // ✅ Step 1: Open chat and drawer if necessary
        if (openChat && setDrawerOpen) {
            openChat(friend);
            setDrawerOpen(true);
        }

        // ✅ Step 2: Send invite (ensures socket is open too)
        const result = await sendGameInvite(friend);
        if (!result || !result.gameId) throw new Error("Game creation failed");

        const { gameId, lobbyId } = result;

        // ✅ Step 3: Store in reducer (optional for tracking)
        dispatch({ type: "SET_ACTIVE_GAME", payload: gameId });
        dispatch({ type: "SET_ACTIVE_LOBBY", payload: lobbyId });

        // ✅ Step 4: Notify via DM
        const message = `Join my game 👉 /lobby/${lobbyId}`;
        setTimeout(() => sendMessage(message), 200);

        // ✅ Step 5: Navigate to lobby
        navigate(`/lobby/${lobbyId}`);
        } catch (err) {
        console.error("🎮 Failed to invite and notify friend:", err);
        }
    };

    return invite;
};
