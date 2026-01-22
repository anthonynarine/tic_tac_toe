// # Filename: src/components/notifications/InvitePanelContainer.jsx

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import InvitePanel from "./InvitePanel";
import { useInviteContext } from "../context/inviteContext";
import { acceptInvite, declineInvite } from "../../api/inviteApi";

export default function InvitePanelContainer() {
  const navigate = useNavigate();
  const { pendingInvites, removeInvite, upsertInvite } = useInviteContext();

  const handleAccept = useCallback(
    async (invite) => {
      const inviteId = invite?.inviteId;
      const lobbyId = invite?.lobbyId;

      if (!inviteId || !lobbyId) return;

      // Step 1: Optimistic remove (instant UI)
      removeInvite(inviteId);

      try {
        // Step 2: Tell backend
        const result = await acceptInvite(inviteId);

        // Step 3: Navigate (server may return lobbyId)
        const nextLobbyId = result?.lobbyId || lobbyId;
        navigate(`/lobby/${nextLobbyId}`);
      } catch (error) {
        // Where: acceptInvite axios call
        // Why: invite expired/invalid/auth/network/server error
        // Fix: restore invite + show toast later (Phase 5 polish)
        console.error("Invite accept failed:", error);

        // Step 4: Restore invite if backend rejects
        upsertInvite({ ...invite, status: "pending" });
      }
    },
    [navigate, removeInvite, upsertInvite]
  );

  const handleDecline = useCallback(
    async (invite) => {
      const inviteId = invite?.inviteId;
      if (!inviteId) return;

      // Step 1: Optimistic remove
      removeInvite(inviteId);

      try {
        // Step 2: Tell backend
        await declineInvite(inviteId);
      } catch (error) {
        console.error("Invite decline failed:", error);

        // Step 3: Restore invite if backend rejects
        upsertInvite({ ...invite, status: "pending" });
      }
    },
    [removeInvite, upsertInvite]
  );

  return (
    <InvitePanel
      invites={pendingInvites}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}
