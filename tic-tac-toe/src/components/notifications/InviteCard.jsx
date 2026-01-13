// ✅ New Code
// # Filename: src/components/notifications/InviteCard.jsx

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import styles from "../friends/FriendsSidebar.module.css";
import { acceptInvite, declineInvite } from "../../api/inviteApi";
import { useNotification } from "../context/notificatonContext";

/**
 * InviteCard
 *
 * Renders a single invite with Accept/Decline actions.
 * - Accept navigates to /lobby/:lobbyId?invite=:inviteId (required for WS join guard)
 * - Decline updates status and disables actions
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

      // Step 4: Navigate using inviteId query param (join guard)
      const navLobbyId = result?.lobbyId || lobbyId;
      navigate(`/lobby/${navLobbyId}?invite=${inviteId}`);
    } catch (error) {
      /**
       * Error clarity (where/why/fix):
       * - Where: acceptInvite() axios call
       * - Why: invite expired/invalid, user not receiver, auth token missing
       * - Fix: refresh token/login, ensure inviteId matches lobby, check backend response
       */
      console.error("InviteCard: accept failed:", error);

      // Step 5: If backend says expired/invalid, mark locally to disable UI
      upsertInvite({ ...invite, status: "expired" });
    } finally {
      setIsActing(false);
    }
  };

  const handleDecline = async () => {
    if (!inviteId || isActing || !isPending) return;

    try {
      setIsActing(true);

      const result = await declineInvite(inviteId);

      if (result?.invite) {
        upsertInvite(result.invite);
      } else {
        // fallback local state
        upsertInvite({ ...invite, status: "declined" });
      }
    } catch (error) {
      console.error("InviteCard: decline failed:", error);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className={styles.inviteCard}>
      <div className={styles.inviteCardHeader}>
        <div className={styles.inviteTitle}>
          Invite from <span className={styles.inviteFromName}>{fromName}</span>
        </div>

        <div className={`${styles.inviteStatusChip} ${styles[`inviteStatus_${status}`]}`}>
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

      <div className={styles.inviteActions}>
        <button
          className={styles.acceptBtn}
          onClick={handleAccept}
          disabled={!isPending || isActing || !lobbyId}
          title={!isPending ? "Invite not pending" : "Accept invite"}
        >
          {isActing ? "..." : "Accept"}
        </button>

        <button
          className={styles.declineBtn}
          onClick={handleDecline}
          disabled={!isPending || isActing}
          title={!isPending ? "Invite not pending" : "Decline invite"}
        >
          {isActing ? "..." : "Decline"}
        </button>
      </div>

      {/* Optional helper text */}
      {!isPending && isTerminal && (
        <div className={styles.inviteHint}>
          This invite is {statusLabel.toLowerCase()}.
        </div>
      )}
    </div>
  );
};

export default InviteCard;
