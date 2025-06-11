import React from "react";
import { Link } from "react-router-dom";
import styles from "./MessageBubble.module.css";

/**
 * MessageBubble Component
 * ------------------------
 * Handles normal messages + auto-links to /lobby/:id or /games/:id
 */

const MessageBubble = ({ msg, currentUserId }) => {
    const isMine = msg.sender_id === currentUserId;

    // Only apply fallback if not a game_invite
    const content =
        msg.type === "game_invite"
            ? null
            : msg.content || msg.message || "[No message]";

    const lobbyMatch = msg.content?.match(/\/lobby\/\d+/) || [];
    const gameMatch = msg.content?.match(/\/games\/\d+/) || [];
    const extractedLink = lobbyMatch[0] || gameMatch[0];

    // 🛑 Skip rendering if message is not a game_invite and has no content
    if (
        (msg.type === "game_invite" && !msg.lobby_id && !msg.content) ||
        (msg.type !== "game_invite" &&
            (!content || content.trim() === "" || content === "[No message]"))
    ) {
        return null;
        
    }
    return (
        <div
            className={`
                ${styles.message}
                ${isMine ? styles.outgoing : styles.incoming}
            `}
        >
            {msg.type === "game_invite" && msg.lobby_id ? (
                <Link to={`/lobby/${msg.lobby_id}`} className={styles.joinLink}>
                    Join Lobby →
                </Link>
            ) : extractedLink ? (
                <Link to={extractedLink} className={styles.joinLink}>
                    {extractedLink.includes("/lobby/")
                        ? "Join Lobby →"
                        : "Accept Challenge →"}
                </Link>
            ) : (
                <span className={styles.text}>{content}</span>
            )}
        </div>
    );
};

export default MessageBubble;
