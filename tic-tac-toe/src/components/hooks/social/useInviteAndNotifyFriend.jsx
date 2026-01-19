// # Filename: hooks/useInviteAndNotifyFriend.js

import { useNavigate } from "react-router-dom";
import { useDirectMessage } from "../../context/directMessageContext";
import { useUI } from "../../context/uiContext";


import { buildInviteLobbyUrl } from "../../../invites/InviteNavigation";

export const useInviteAndNotifyFriend = () => {
  const { openChat, sendMessage, sendGameInvite, dispatch } = useDirectMessage();
  const { setDMOpen: setDrawerOpen } = useUI();
  const navigate = useNavigate();

  const invite = async (friend) => {
    try {
      // Step 1: Open chat and drawer if necessary
      if (openChat && setDrawerOpen) {
        openChat(friend);
        setDrawerOpen(true);
      }

      // Step 2: Send invite (server authoritative)
      const result = await sendGameInvite(friend);
      if (!result) throw new Error("Game creation failed");


      // Step 3: Require lobbyId + inviteId (Invite v2 invariant)
      const lobbyId = result?.lobbyId;
      const inviteId = result?.invite?.inviteId || result?.inviteId;

      if (!lobbyId || !inviteId) {
        throw new Error("Invite creation failed: missing lobbyId or inviteId");
      }

      // Step 4: Store in reducer (optional)
      dispatch({ type: "SET_ACTIVE_LOBBY", payload: lobbyId });


      // Step 5: Canonical URL ALWAYS includes invite
      const lobbyUrl = buildInviteLobbyUrl({ lobbyId, inviteId });

      // Step 6: Notify via DM (send correct link)
      const message = `Join my game 👉 ${lobbyUrl}`;
      setTimeout(() => sendMessage(message), 200);

      // Step 7: Navigate to lobby (correct route + invite)
      navigate(lobbyUrl);
    } catch (err) {
      console.error("🎮 Failed to invite and notify friend:", err);
    }
  };

  return invite;
};
