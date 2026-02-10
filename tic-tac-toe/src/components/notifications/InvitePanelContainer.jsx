// # Filename: src/components/notifications/InvitePanelContainer.jsx
import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import InvitePanel from "./InvitePanel";
import { useInviteContext } from "../../context/inviteContext";
import { acceptInvite, declineInvite, fetchInvites } from "../../api/inviteApi";

export default function InvitePanelContainer() {
  const navigate = useNavigate();
  const { pendingInvites, removeInvite, resetInvites, upsertInvite } =
    useInviteContext();

  const didHydrateRef = useRef(false);

  const rehydratePendingInvites = useCallback(async () => {
    try {
      const pending = await fetchInvites({ status: "pending", role: "to_user" });

      // Normalize (in case API returns { results: [...] } later)
      const list = Array.isArray(pending) ? pending : pending?.results || pending?.invites || [];

      resetInvites();
      list.forEach((inv) => upsertInvite(inv));
    } catch (err) {
      console.error("❌ Invite rehydrate failed:", err);
    }
  }, [resetInvites, upsertInvite]);

  // ✅ Run once per mount (prevents render-loop storms)
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    rehydratePendingInvites();
  }, [rehydratePendingInvites]);

  const handleAccept = useCallback(
    async (invite) => {
      const inviteId = invite?.inviteId;
      if (!inviteId) return;

      removeInvite(inviteId);

      try {
        const result = await acceptInvite(inviteId);
        const nextLobbyId = result?.lobbyId || invite?.lobbyId;

        if (nextLobbyId) {
          navigate(`/lobby/${nextLobbyId}?invite=${encodeURIComponent(inviteId)}`);
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

      removeInvite(inviteId);

      try {
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
