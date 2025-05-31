
// File: FriendsSidebar.jsx - Updated for CSS Modules

import React, { useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import DMDrawer from "./DMDrawer";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext";
import { FaUserCheck, FaUserTimes } from "react-icons/fa";


import styles from "./FriendsSidebar.module.css";

const FriendsSidebar = () => {
    const { isSidebarOpen, setSidebarOpen, setDMOpen } = useUI();
    const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();
    const { activeChat, openChat, closeChat } = useDirectMessage();
    const { user } = useUserContext();

    useEffect(() => {
        refreshFriends();
    }, [refreshFriends]);

    const handleFriendClick = (friend) => {
        if (friend.friend_status === "online") {
        openChat(friend);
        setDMOpen(true);
        }
    };

    const handleAccept = async (id) => {
    try {
        await acceptRequest(id);
        refreshFriends();
    } catch (error) {
        console.error("Failed to accept request:", error);
        // Optionally show toast here
        }
    };

    const handleDecline = async (id) => {
    try {
        await declineRequest(id);
        refreshFriends();
    } catch (error) {
        console.error("Failed to decline request:", error);
        // Optionally show toast here
        }
    };

    return (
        <div className={`${styles.friendsSidebar} ${isSidebarOpen ? styles.open : ""}`}>
        <div className={styles.friendsSidebarHeader}>
            <h2 className={styles.friendsSidebarTitle}>Social</h2>
            <button className={styles.friendsSidebarClose} onClick={() => setSidebarOpen(false)}>
            &times;
            </button>
        </div>

        <div className={styles.friendsSidebarContent}>
            <AddFriendForm />

            <section className={styles.friendsSidebarSection}>
            <h3>Friends</h3>
            <ul>
                {friends.length > 0 ? (
                friends.map((friend) => {
                    const isOnline = friend.friend_status === "online";

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
                        <div className={styles.friendInfo}>
                            <span className={styles.friendName}>{friend.friend_name}</span>
                            <span className={`${styles.friendStatusText} ${isOnline ? styles.online : styles.offline}`}>
                            {isOnline ? "Online" : "Offline"}
                            </span>
                        </div>
                        </div>
                    </li>
                    );
                })
                ) : (
                <li className={styles.friendsSidebarEmpty}>No friends yet.</li>
                )}
            </ul>
            </section>

            {activeChat && <DMDrawer isOpen={true} onClose={closeChat} />}

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
    );
};

export default FriendsSidebar;