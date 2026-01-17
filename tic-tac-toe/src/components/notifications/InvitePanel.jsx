// # Filename: src/components/notifications/InvitePanel.jsx


import React, { useMemo } from "react";
import styles from "../friends/FriendsSidebar.module.css";
import InviteCard from "./InviteCard";
import { useNotification } from "../context/notificatonContext";

/**
 * InvitesPanel
 *
 * Primary Invite Inbox UI.
 * Renders server-authoritative invites from NotificationProvider.
 */
const InvitesPanel = () => {
  const { invites } = useNotification();

  // Step 1: Normalize + optionally sort newest-first if timestamps exist
  const visibleInvites = useMemo(() => {
    const list = Array.isArray(invites) ? invites : [];

    // If your invite has createdAt/created_at, sort newest-first; otherwise keep insertion order.
    const hasSortableTime = list.some((i) => i?.createdAt || i?.created_at);
    if (!hasSortableTime) return list;

    return [...list].sort((a, b) => {
      const aT = new Date(a?.createdAt || a?.created_at || 0).getTime();
      const bT = new Date(b?.createdAt || b?.created_at || 0).getTime();
      return bT - aT;
    });
  }, [invites]);

  return (
    <section className={styles.friendsSidebarSection}>
      <h3>Invites</h3>

      {!visibleInvites.length ? (
        <div className={styles.inviteEmpty}>No invites yet.</div>
      ) : (
        <div className={styles.inviteList}>
          {visibleInvites.map((invite) => (
            <InviteCard key={invite.inviteId} invite={invite} />
          ))}
        </div>
      )}
    </section>
  );
};

export default InvitesPanel;
