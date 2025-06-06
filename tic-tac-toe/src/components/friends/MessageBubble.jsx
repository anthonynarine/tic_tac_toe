import React from "react";
import styles from "./MessageBubble.module.css"; // we’ll create this
/**
 * MessageBubble Component
 * ----------------------------------------------------
 * Displays a single message bubble, styled based on
 * whether it was sent by the current user or a friend.
 *
 * Props:
 * - msg: The message object (must include sender_id and message)
 * - currentUserId: The logged-in user's ID
 */

const MessageBubble = ({ msg, currentUserId }) => {
    // Determine if this message was sent by the current user
    const isMine = msg.sender_id === currentUserId;
    console.log("Rendering msg:", msg.message);
    console.log("Rendering msg:", msg);



    return (
        <div
            className={`
                ${styles.message}
                ${isMine ? styles.outgoing : styles.incoming}
                `}
        >
        {/* ✅ Display the actual text content of the message */}
        <span className={styles.text}>{msg.content || msg.message || "[No message]"}</span>
        </div>
    )
}

export default MessageBubble;