// FriendsSidebar.jsx
import React, { useEffect, useState } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import DMDrawer from "./DMDrawer";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext";
import TrinityOverlay from "../trinity/TrinityOverlay";
// import TrinityDrawer from "../trinity/TrinityDrawer"// 


import { FaUserCheck, FaUserTimes } from "react-icons/fa";

import styles from "./FriendsSidebar.module.css";

const FriendsSidebar = () => {
  // UI context for sidebar and Trinity drawer state
  const {
    isSidebarOpen,
    setSidebarOpen,
    setDMOpen,
    isTrinityOpen,
    setTrinityOpen,
  } = useUI();

  // Friends and pending requests state and actions
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();

  // Direct message context for chat drawer
  const { activeChat, openChat, closeChat, unread: unreadMap, markAsRead } = useDirectMessage();

  const [unreadSnapshot, setUnreadSnapshot] = useState({});

  // User info (for example, current logged-in user)
  const { user } = useUserContext();

  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  useEffect(() => {
    setUnreadSnapshot(unreadMap); // update local state whenever unreadMap changes
  }, [unreadMap]);

  // Handler to open DM chat with a friend
const handleFriendClick = (friend) => {
    if (friend.friend_status === "online") {
      openChat(friend);
      setDMOpen(true);

      const isCurrentUserSender = friend.from_user === user.id;
      const friendUserId = isCurrentUserSender ? friend.to_user : friend.from_user;
      markAsRead(friendUserId); // ✅ Use user ID, not friendship ID
    }
  };

  // Accept friend request and refresh list
  const handleAccept = async (id) => {
    try {
      await acceptRequest(id);
      refreshFriends();
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  // Decline friend request and refresh list
  const handleDecline = async (id) => {
    try {
      await declineRequest(id);
      refreshFriends();
    } catch (error) {
      console.error("Failed to decline request:", error);
    }
  };

  return (
    <>
      <div className={`${styles.friendsSidebar} ${isSidebarOpen ? styles.open : ""}`}>
        {/* Sidebar Header (tabs, close button, etc.) */}
        <div className={styles.friendsSidebarHeader}>
          <h2 className={styles.friendsSidebarTitle}>Social</h2>
          <button
            className={styles.friendsSidebarClose}
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            &times;
          </button>
        </div>
        <>
          {/* =================== Trinity Overlay Container =================== */}
          <div className={styles.trinityOverlayContainer}>
            {/* Pass onClick to open Trinity drawer */}
            <TrinityOverlay onClick={() => setTrinityOpen(true)} />
          </div>
            {/* <TrinityDrawer /> */}
        </>

        {/* =================== Sidebar Content (Add Friend, Friends, Pending) =================== */}
        <div className={styles.friendsSidebarContent}>
          {/* Add Friend Form */}
          <AddFriendForm />

          {/* Friends List */}
          <section className={styles.friendsSidebarSection}>
            <h3>Friends</h3>
            <ul>
              {friends.length > 0 ? (
                friends.map((friend) => {
                  const isOnline = friend.friend_status === "online";

                  // Determine who the friend actually is (not the current user)
                  const isCurrentUserSender = friend.from_user === user.id;
                  const friendUserId = isCurrentUserSender ? friend.to_user : friend.from_user;

                  const unreadCount = unreadSnapshot[friendUserId] || 0;
                  console.log("🔔 FriendUserID:", friendUserId, "Unread Count:", unreadSnapshot[friendUserId]);


                  return (
                    <li key={friend.id} className={styles.friendsSidebarFriend}>
                      <div
                        className={styles.friendRow}
                        onClick={() => handleFriendClick(friend)}
                        style={{
                          cursor: isOnline ? "pointer" : "default",
                          opacity: isOnline ? 1 : 0.5,
                        }}
                      >
                        {/* Friend info and status */}
                        <div className={styles.friendInfo}>
                          <span className={styles.friendName}>{friend.friend_name}</span>
                          <span
                            className={`${styles.friendStatusText} ${
                              isOnline ? styles.online : styles.offline
                            }`}
                          >
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </div>

                        {/* 🔴 Unread message badge */}
                        {unreadCount > 0 && (
                          <span className={styles.unreadBadge}>{unreadCount}</span>
                        )}
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className={styles.friendsSidebarEmpty}>No friends yet.</li>
              )}
            </ul>
          </section>


          {/* Direct Message Drawer (conditionally rendered) */}
          {/* {activeChat && <DMDrawer isOpen={true} onClose={closeChat} />} */}

          {/* Pending Friend Requests */}
          <section className={styles.friendsSidebarSection}>
            <h3>Pending Requests</h3>
            <ul>
              {pending.received?.length > 0 ? (
                pending.received.map((r) => (
                  <li key={r.id} className={styles.friendsSidebarRequest}>
                    <span>{r.from_user_name}</span>
                    <div className={styles.friendsSidebarActions}>
                      <button
                        onClick={() => handleAccept(r.id)}
                        className={styles.acceptBtn}
                        title="Accept request"
                      >
                        <FaUserCheck size={14} />
                      </button>

                      <button
                        onClick={() => handleDecline(r.id)}
                        className={styles.declineBtn}
                        title="Decline request"
                      >
                        <FaUserTimes size={14} />
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className={styles.friendsSidebarEmpty}>No pending requests.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
};

export default FriendsSidebar;
