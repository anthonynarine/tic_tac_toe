import React from "react";
import { PiGameController } from "react-icons/pi";
import { useDirectMessage } from "../context/directMessageContext";
import styles from "./FriendsSidebar.module.css";

/**
 * FriendListItem
 *
 * Displays a single friend in the sidebar, with online status,
 * unread badge, and game invite button (if online).
 *
 * @param {object} props
 * @param {object} props.friend - Friend object from friendsContext
 * @param {object} props.user - Current user object
 * @param {function} props.onClick - Callback for row click (e.g., open chat)
 * @param {function} props.onInvite - Callback for invite button click
 */
const FriendsList = ({ friend, user, onClick, onInvite }) => {
    const isOnline = friend.friend_status === "online";
    const isCurrentUserSender = friend.from_user === user.id;
    const friendUserId = isCurrentUserSender ? friend.to_user : friend.from_user;

    const { unreadCounts } = useDirectMessage();

    return (
        <li className={styles.friendsSidebarFriend}>
        <div
            className={styles.friendRow}
            onClick={() => onClick(friend)}
            style={{
            cursor: isOnline ? "pointer" : "default",
            opacity: isOnline ? 1 : 0.5,
            }}
        >
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

            {/* 🔴 Notification badge if unread */}
            {unreadCounts?.[friendUserId] > 0 && (
            <span className={styles.unreadBadge} />
            )}

            {/* 🎮 Invite button */}
            {isOnline && (
            <button
                className={styles.inviteButton}
                onClick={(e) => {
                e.stopPropagation();
                onInvite(friend);
                }}
                title="Invite to Game"
            >
                <PiGameController size={16} />
            </button>
            )}
        </div>
        </li>
    );
};

export default FriendsList;
