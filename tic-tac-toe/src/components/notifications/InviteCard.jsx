// # Filename: src/components/notifications/InviteCard.jsx

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import styles from "../friends/FriendsSidebar.module.css";
import { acceptInvite, declineInvite } from "../../api/inviteApi";
import { useNotification } from "../context/notificatonContext";
import { showToast } from "../../utils/toast/Toast";
import { buildInviteLobbyUrl } from "../../invites/InviteNavigation"; 

/**
 * InviteCard
 *
 * Primary Invite Inbox UI card (Invite Panel is the source of UX truth).
 *
 * Flow:
 * - Accept -> navigates to Lobby: /lobby/:lobbyId?invite=:inviteId
 * - Join (accepted only) -> navigates to Lobby
 * - Decline -> updates status and disables actions
 */
const InviteCard = ({ invite }) => {
  const navigate = useNavigate();
  const { upsertInvite } = useNotification();

  const [isActing, setIsActing] = useState(false);

  const inviteId = invite?.inviteId;
  const lobbyId = invite?.lobbyId;

  const status = String(invite?.status || "").toLowerCase();

  const isPending = status === "pending";
  const isAccepted = status === "accepted";
  const isDeclined = status === "declined";
  const isExpired = status === "expired";
  const isCanceled = status === "canceled";

  const isTerminal = isAccepted || isDeclined || isExpired || isCanceled;

  const statusLabel = useMemo(() => {
    if (isPending) return "Pending";
    if (isAccepted) return "Accepted";
    if (isDeclined) return "Declined";
    if (isExpired) return "Expired";
    if (isCanceled) return "Canceled";
    return "Unknown";
  }, [isPending, isAccepted, isDeclined, isExpired, isCanceled]);

  const fromName = invite?.fromUserName || "Friend";
  const gameType = invite?.gameType || "tic_tac_toe";

  const handleAccept = async () => {
    if (!inviteId || !lobbyId || isActing || !isPending) return;

    try {
      // Step 1: Disable actions while request in flight
      setIsActing(true);

      // Step 2: Accept (idempotent)
      const result = await acceptInvite(inviteId);

      // Step 3: Upsert returned invite (authoritative)
      if (result?.invite) {
        upsertInvite(result.invite);
      }

      // Step 4: Navigate to lobby using canonical URL (join-guard uses ?invite=)
      const navLobbyId = result?.lobbyId || lobbyId;

      // Step 4a: Prefer server-returned inviteId if provided (extra safety)
      const navInviteId = result?.invite?.inviteId || inviteId;

      // Step 4b: Guard against missing lobbyId to avoid /lobby/undefined
      if (!navLobbyId) {
        console.error("InviteCard: missing lobbyId for navigation", {
          inviteId,
          lobbyId,
          result,
        });
        showToast("error", "Could not open the lobby. Please try again.");
        return;
      }

      navigate(buildInviteLobbyUrl({ lobbyId: navLobbyId, inviteId: navInviteId }));
    } catch (error) {
      /**
       * Error clarity (where/why/fix):
       * - Where: acceptInvite() axios call
       * - Why: invite expired/invalid, user not receiver, auth token missing, network/server error
       * - Fix: re-auth, request a new invite, confirm you're the receiver, retry if network/server
       */
      console.error("InviteCard: accept failed:", error);

      // Step 5: If backend returns a status, honor it. Otherwise keep pending (don’t mislabel).
      const backendStatus =
        error?.response?.data?.invite?.status ||
        error?.response?.data?.status ||
        error?.response?.data?.detail;

      const normalized = String(backendStatus || "").toLowerCase();
      const terminalFromServer =
        normalized === "expired" ||
        normalized === "declined" ||
        normalized === "accepted" ||
        normalized === "canceled";

      upsertInvite({
        ...invite,
        status: terminalFromServer ? normalized : "pending",
      });

      showToast(
        "error",
        terminalFromServer ? `Invite ${normalized}.` : "Could not accept invite. Please try again."
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleDecline = async () => {
    if (!inviteId || isActing || !isPending) return;

    try {
      // Step 1: Disable actions while request in flight
      setIsActing(true);

      // Step 2: Decline (idempotent)
      const result = await declineInvite(inviteId);

      // Step 3: Upsert returned invite (authoritative)
      if (result?.invite) {
        upsertInvite(result.invite);
      } else {
        // fallback local state
        upsertInvite({ ...invite, status: "declined" });
      }
    } catch (error) {
      console.error("InviteCard: decline failed:", error);
      showToast("error", "Could not decline invite. Please try again.");
    } finally {
      setIsActing(false);
    }
  };

  // Step 1: Join lobby for accepted invites only
  const handleJoin = () => {
    if (!inviteId || !lobbyId) return;
    navigate(buildInviteLobbyUrl({ lobbyId, inviteId }));
  };

  return (
    <div className={styles.inviteCard}>
      <div className={styles.inviteCardHeader}>
        <div className={styles.inviteTitle}>
          Invite from <span className={styles.inviteFromName}>{fromName}</span>
        </div>

        <div
          className={`${styles.inviteStatusChip} ${styles[`inviteStatus_${status}`]}`}
        >
          {statusLabel}
        </div>
      </div>

      <div className={styles.inviteMetaRow}>
        <span className={styles.inviteMetaLabel}>Game:</span>{" "}
        <span className={styles.inviteMetaValue}>{gameType}</span>
      </div>

      <div className={styles.inviteMetaRow}>
        <span className={styles.inviteMetaLabel}>Lobby:</span>{" "}
        <span className={styles.inviteMetaValue}>{lobbyId || "—"}</span>
      </div>


          Step 2: Only show Join for ACCEPTED (hide buttons for declined/expired/canceled) */}
      <div className={styles.inviteActions}>
        {isPending ? (
          <>
            <button
              className={styles.acceptBtn}
              onClick={handleAccept}
              disabled={isActing || !lobbyId}
              title="Accept invite"
            >
              {isActing ? "..." : "Accept"}
            </button>

            <button
              className={styles.declineBtn}
              onClick={handleDecline}
              disabled={isActing}
              title="Decline invite"
            >
              {isActing ? "..." : "Decline"}
            </button>
          </>
        ) : isAccepted ? (
          <button
            className={styles.acceptBtn}
            onClick={handleJoin}
            disabled={isActing || !lobbyId}
            title="Join lobby"
          >
            Join
          </button>
        ) : null}
      </div>

      {!isPending && isTerminal && (
        <div className={styles.inviteHint}>
          This invite is {statusLabel.toLowerCase()}.
        </div>
      )}
    </div>
  );
};

export default InviteCard;
