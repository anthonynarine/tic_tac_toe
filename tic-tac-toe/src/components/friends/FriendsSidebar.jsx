import React, { useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import { useUserContext } from "../context/userContext";
import "./FriendsSidebar.css";

/**
 * FriendsSidebar
 *
 * Slide-in panel to manage friends and requests.
 * Displays:
 * - All friends (with status below name)
 * - Pending received friend requests
 */
const FriendsSidebar = ({ isOpen, onClose }) => {
    const {
        friends,
        pending,
        acceptRequest,
        declineRequest,
        refreshFriends,
    } = useFriends();

    const user = useUserContext();

    // Refresh friends list when sidebar is opened
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
        console.log("[FriendsSidebar] Opened → Refreshing friend data...");
        refreshFriends();
        }, 150);

        return () => clearTimeout(timer);
    }, [isOpen, refreshFriends]);

    const handleAccept = async (requestId) => {
        await acceptRequest(requestId);
        refreshFriends();
    };

    const handleDecline = async (requestId) => {
        await declineRequest(requestId);
        refreshFriends();
    };

    return (
        <div className={`friends-sidebar ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="friends-sidebar__header">
            <h2 className="friends-sidebar__title">Friends</h2>
            <button className="friends-sidebar__close" onClick={onClose}>
            &times;
            </button>
        </div>

        {/* Body */}
        <div className="friends-sidebar__content">
            <AddFriendForm />

            {/* Friends List (Unified) */}
            <section className="friends-sidebar__section">
            <h3>Friends</h3>
            <ul>
                {friends.length > 0 ? (
                friends.map((friend) => (
                    <li key={friend.id} className="friends-sidebar__friend">
                    <div className="friend-row">
                        <div className="friend-info">
                        <span className="friend-name">{friend.friend_name}</span>
                        <span className={`friend-status-text ${friend.friend_status === "online" ? "online" : "offline"}`}>
                            {friend.friend_status === "online" ? "Online" : "Offline"}
                        </span>
                        </div>
                    </div>
                    </li>
                ))
                ) : (
                <li className="friends-sidebar__empty">No friends yet.</li>
                )}
            </ul>
            </section>

            {/* Pending Friend Requests */}
            <section className="friends-sidebar__section">
            <h3>Pending Requests</h3>
            <ul>
                {pending.received?.length > 0 ? (
                pending.received.map((r) => (
                    <li key={r.id} className="friends-sidebar__request">
                    <span>{r.from_user_name}</span>
                    <div className="friends-sidebar__actions">
                        <button onClick={() => handleAccept(r.id)} className="accept-btn">
                        Accept
                        </button>
                        <button onClick={() => handleDecline(r.id)} className="decline-btn">
                        Decline
                        </button>
                    </div>
                    </li>
                ))
                ) : (
                <li className="friends-sidebar__empty">No pending requests.</li>
                )}
            </ul>
            </section>
        </div>
        </div>
    );
};

export default FriendsSidebar;
