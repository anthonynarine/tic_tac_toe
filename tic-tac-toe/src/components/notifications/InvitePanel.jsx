// ✅ New Code
// # Filename: src/components/notifications/InvitesPanel.jsx

import React, { useMemo } from "react";
import styles from "../friends/FriendsSidebar.module.css";
import InviteCard from "./InviteCard";
import { useNotification } from "../context/notificatonContext";

/**
 * InvitesPanel
 *
 * Lists server-authoritative invites from NotificationProvider.
 * Dedupe happens in context via invitesById + inviteOrder.
 */
const InvitesPanel = () => {
  const { invites } = useNotification();

  // Step 1: Show newest-first, but only the most relevant items if needed later
  const visibleInvites = useMemo(() => {
    return Array.isArray(invites) ? invites : [];
  }, [invites]);

  if (!visibleInvites.length) {
    return (
      <section className={styles.friendsSidebarSection}>
        <h3>Invites</h3>
        <div className={styles.inviteEmpty}>No invites yet.</div>
      </section>
    );
  }

  return (
    <section className={styles.friendsSidebarSection}>
      <h3>Invites</h3>

      <div className={styles.inviteList}>
        {visibleInvites.map((invite) => (
          <InviteCard key={invite.inviteId} invite={invite} />
        ))}
      </div>
    </section>
  );
};

export default InvitesPanel;
