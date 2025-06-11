// File: FriendsSidebar.jsx

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFriends } from "../context/friendsContext";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext";
// import { inviteAndNotifyFriend } from "./utils/inviteAndNotifyFriend";

import AddFriendForm from "./AddFriendForm";
import TrinityOverlay from "../trinity/TrinityOverlay";
import FriendsList from "./FriendsList";
import PendingFriendRequest from "./PendingFriendRequest";

import styles from "./FriendsSidebar.module.css";

/**
 * FriendsSidebar
 *
 * Sidebar component that displays:
 * - Trinity assistant launcher
 * - Add friend form
 * - List of online/offline friends
 * - Pending friend requests
 *
 * Manages click behavior for opening DMs or accepting/declining requests.
 * Controlled via global UI state (drawer open/close).
 */
const FriendsSidebar = () => {
  const { isSidebarOpen, setSidebarOpen, setDMOpen, setTrinityOpen } = useUI();
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();
  const { openChat, unread, sendGameInvite } = useDirectMessage();
  const { user } = useUserContext();
  const navigate = useNavigate();

  /**
   * On mount, refresh friend list from backend.
   */
  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  /**
   * Handles clicking a friend row to open direct message chat.
   * Only works if friend is online.
   */
  const handleFriendClick = (friend) => {
    if (friend.friend_status === "online") {
      openChat(friend);
      setDMOpen(true);
    }
  };


  const handleInvite = async (friend) => {
    const result = await sendGameInvite(friend);
    console.log("🎯 handleInvite result:", result);

    if (result?.lobby_id || result?.lobbyId) {
      const lobbyId = result.lobby_id || result.lobbyId;
      console.log("🚀 Navigating to lobby:", lobbyId);
      navigate(`/lobby/${lobbyId}`);
    } else {
      console.warn("No lobbyId in result, not navigating.");
    }
  };


  /**
   * Accept a pending friend request by ID.
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
   * Decline a pending friend request by ID.
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
                  onInvite={handleInvite} 
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
