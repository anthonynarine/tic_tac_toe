
// # Filename: src/components/friends/FriendsSidebar.jsx

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useFriends } from "../context/friendsContext";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext";

import AddFriendForm from "./AddFriendForm";
import TrinityOverlay from "../trinity/TrinityOverlay";
import FriendsList from "./FriendsList";
import PendingFriendRequest from "./PendingFriendRequest";
import InvitesPanel from "../notifications/InvitePanel"
import { resolveRecipientUserId } from "../../invites/resolveRecipientUserId";
import { buildInviteLobbyUrl } from "../../invites/InviteNavigation";

import styles from "./FriendsSidebar.module.css";

// Step 1: Invite v2 REST API (server-authoritative)
import { createInvite } from "../../api/inviteApi";

/**
 * FriendsSidebar
 *
 * Sidebar component that displays:
 * - Trinity assistant launcher
 * - Add friend form
 * - List of online/offline friends
 * - Pending friend requests
 *
 * Invite v2:
 * - Invites are created via REST (server-authoritative)
 * - Lobby join uses /lobby/:id?invite=<inviteId> to satisfy WS join guard
 */
const FriendsSidebar = () => {
  const { isSidebarOpen, setSidebarOpen, setDMOpen, setTrinityOpen } = useUI();
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();

  // NOTE: We keep DM context for opening chats, unread, etc.
  // Invite v2 removes DM as the "join source of truth".
  const { openChat } = useDirectMessage();

  const { user } = useUserContext();
  const navigate = useNavigate();

  /**
   * Step 1: On mount, refresh friend list from backend.
   */
  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  /**
   * Step 2: Handles clicking a friend row to open direct message chat.
   * Only works if friend is online.
   */
  const handleFriendClick = (friend) => {
    if (friend.friend_status === "online") {
      openChat(friend);
      setDMOpen(true);
    }
  };

  /**
   * Step 3: Invite v2 (server-authoritative) invite handler.
   *
   * Flow:
   * 1) POST /api/invites/ { to_user_id, game_type }
   * 2) Response includes invite + lobbyId
   * 3) Navigate to /lobby/:lobbyId?invite=:inviteId
   *
   * Why:
   * - Lobby WS now requires inviteId query param (join guard)
   * - Prevents stale /lobby/:id time-travel joins
   */
  const handleInvite = async (friend) => {
    try {
      // Step 1: Resolve recipient user id safely (never trust friend.id)
      const recipientUserId = resolveRecipientUserId(friend, user?.id);

      if (!recipientUserId) {
        console.error("Invite v2: Could not resolve recipient user id", {
          currentUserId: user?.id,
          friend,
        });
        return;
      }

      // Step 2: Prevent self-invite on the client (server must also guard)
      if (Number(recipientUserId) === Number(user?.id)) {
        console.warn("Invite v2: Self-invite prevented (frontend)", {
          currentUserId: user?.id,
          recipientUserId,
        });
        return;
      }

      // Step 3: Create invite on the server (authoritative)
      const result = await createInvite({
        toUserId: recipientUserId,
        gameType: "tic_tac_toe",
      });

      const lobbyId = result?.lobbyId;
      const inviteId = result?.invite?.inviteId;

      if (!lobbyId || !inviteId) {
        console.warn("Invite v2: Missing lobbyId or inviteId in response:", result);
        return;
      }

      // Step 4: Navigate with inviteId so WS join guard passes
      // ✅ New Code (use canonical builder)
      navigate(buildInviteLobbyUrl({ lobbyId, inviteId }));
    } catch (error) {
      console.error("Invite v2: Failed to create invite:", error);
    }
  };

  /**
   * Step 4: Accept a pending friend request by ID.
   */
  const handleAccept = async (id) => {
    try {
      await acceptRequest(id);
      refreshFriends();
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  /**
   * Step 5: Decline a pending friend request by ID.
   */
  const handleDecline = async (id) => {
    try {
      await declineRequest(id);
      refreshFriends();
    } catch (error) {
      console.error("Failed to decline request:", error);
    }
  };

  return (
    <div className={`${styles.friendsSidebar} ${isSidebarOpen ? styles.open : ""}`}>
      {/* ─────────────────────────────────────────────
          🔒 Sidebar Header — Close Button
      ───────────────────────────────────────────── */}
      <div className={styles.friendsSidebarHeader}>
        <button
          className={styles.friendsSidebarClose}
          onClick={() => setSidebarOpen(false)}
          title="Close sidebar"
        >
          &times;
        </button>
      </div>

      {/* ─────────────────────────────────────────────
          🧠 Trinity Overlay Launcher
      ───────────────────────────────────────────── */}
      <div className={styles.trinityOverlayContainer}>
        <TrinityOverlay onClick={() => setTrinityOpen(true)} />
      </div>

      {/* ─────────────────────────────────────────────
          📋 Sidebar Content — Add Friend, Lists
      ───────────────────────────────────────────── */}
      <div className={styles.friendsSidebarContent}>
        <AddFriendForm />

        <InvitesPanel />

        {/* ─── 👥 Friends List ─────────────────────── */}
        <section className={styles.friendsSidebarSection}>
          <h3>Friends</h3>
          <ul>
            {friends.length > 0 ? (
              friends.map((friend) => (
                <FriendsList
                  key={friend.id}
                  friend={friend}
                  user={user}
                  onClick={handleFriendClick}
                  onInvite={handleInvite} // ✅ Invite v2
                />
              ))
            ) : (
              <li className={styles.friendsSidebarEmpty}>No friends yet.</li>
            )}
          </ul>
        </section>

        {/* ─── 📨 Pending Requests ─────────────────── */}
        <section className={styles.friendsSidebarSection}>
          <h3>Pending Requests</h3>
          <ul>
            {pending.received?.length > 0 ? (
              pending.received.map((r) => (
                <PendingFriendRequest
                  key={r.id}
                  request={r}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))
            ) : (
              <li className={styles.friendsSidebarEmpty}>No pending requests.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default FriendsSidebar;
