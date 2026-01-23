
// # Filename: src/components/notifications/InvitePanelContainer.jsx
// ✅ New Code

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import InvitePanel from "./InvitePanel";
import { useInviteContext } from "../context/inviteContext";
import { acceptInvite, declineInvite, fetchInvites } from "../../api/inviteApi";

export default function InvitePanelContainer() {
  const navigate = useNavigate();
  const { pendingInvites, removeInvite, resetInvites, upsertInvite } =
    useInviteContext();

  // Step 1: Server-truth refresh (prevents resurrection)
  const rehydratePendingInvites = useCallback(async () => {
    try {
      const pending = await fetchInvites({ status: "pending", role: "to_user" });
      resetInvites();
      pending.forEach((inv) => upsertInvite(inv));
    } catch (err) {
      console.error("❌ Invite rehydrate failed:", err);
    }
  }, [resetInvites, upsertInvite]);

  const handleAccept = useCallback(
    async (invite) => {
      const inviteId = invite?.inviteId;
      if (!inviteId) return;

      // Step 1: Optimistic remove
      removeInvite(inviteId);

      try {
        // Step 2: HTTPS accept
        const result = await acceptInvite(inviteId);

        // Step 3: Prefer backend lobbyId, fallback to payload
        const nextLobbyId = result?.lobbyId || invite?.lobbyId;

        // Step 4: Invite v2 invariant: must include ?invite=<uuid>
        if (nextLobbyId) {
          navigate(
            `/lobby/${nextLobbyId}?invite=${encodeURIComponent(inviteId)}`
          );
        }
      } catch (error) {
        console.error("Invite accept failed:", error);
        await rehydratePendingInvites();
      }
    },
    [navigate, removeInvite, rehydratePendingInvites]
  );

  const handleDecline = useCallback(
    async (invite) => {
      const inviteId = invite?.inviteId;
      if (!inviteId) return;

      // Step 1: Optimistic remove
      removeInvite(inviteId);

      try {
        // Step 2: Tell backend (authoritative)
        await declineInvite(inviteId);
      } catch (error) {
        console.error("Invite decline failed:", error);
        await rehydratePendingInvites();
      }
    },
    [removeInvite, rehydratePendingInvites]
  );

  return (
    <InvitePanel
      invites={pendingInvites}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}
