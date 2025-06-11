// File: src/components/friends/PendingRequestItem.jsx
import React from "react";
import { FaUserCheck, FaUserTimes } from "react-icons/fa";
import styles from "./FriendsSidebar.module.css";

/**
 * PendingRequestItem
 *
 * Renders a pending friend request with accept/decline buttons.
 *
 * @param {object} props
 * @param {object} props.request - The request object from context
 * @param {function} props.onAccept - Handler for accepting
 * @param {function} props.onDecline - Handler for declining
 */
const PendingFriendRequest = ({ request, onAccept, onDecline }) => {
    return (
        <li className={styles.friendsSidebarRequest}>
        <span>{request.from_user_name}</span>
        <div className={styles.friendsSidebarActions}>
            <button
            onClick={() => onAccept(request.id)}
            className={styles.acceptBtn}
            title="Accept"
            >
            <FaUserCheck size={14} />
            </button>
            <button
            onClick={() => onDecline(request.id)}
            className={styles.declineBtn}
            title="Decline"
            >
            <FaUserTimes size={14} />
            </button>
        </div>
        </li>
    );
};

export default PendingFriendRequest;
