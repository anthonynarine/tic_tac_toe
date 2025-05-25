import React, { useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import DMDrawer from "./DMDrawer";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext"; // ✅ Bring in context
import "./FriendsSidebar.css";

const FriendsSidebar = () => {
    const { isSidebarOpen, setSidebarOpen } = useUI(); // ✅ Hook into UIContext
    const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();
    const { activeChat, openChat, closeChat } = useDirectMessage();
    const { user } = useUserContext();

    // Debug logs
    console.log("[FriendsSidebar] isSidebarOpen:", isSidebarOpen);
    console.trace("[FriendsSidebar] RENDERED");

    useEffect(() => {
        console.log("[FriendsSidebar] mounted");
        return () => console.log("[FriendsSidebar] unmounted");
    }, []);

    useEffect(() => {
        refreshFriends();
    }, [refreshFriends]);

    const handleFriendClick = (friend) => {
        if (friend.friend_status === "online") {
        openChat(friend);
        }
    };

    return (
        <div className={`friends-sidebar ${isSidebarOpen ? "open" : ""}`}>
        {/* Sticky header */}
        <div className="friends-sidebar__header">
            <h2 className="friends-sidebar__title">Social</h2>
            <button className="friends-sidebar__close" onClick={() => setSidebarOpen(false)}>
            &times;
            </button>
        </div>

        {/* Scrollable content */}
        <div className="friends-sidebar__content">
            <AddFriendForm />

            {/* Online friends list */}
            <section className="friends-sidebar__section">
            <h3>Friends</h3>
            <ul>
                {friends.length > 0 ? (
                friends.map((friend) => {
                    const isCurrentUserFrom = friend.from_user === user.id;
                    const isOnline = friend.friend_status === "online";

                    return (
                    <li key={friend.id} className="friends-sidebar__friend">
                        <div
                        className="friend-row"
                        onClick={() => handleFriendClick(friend)}
                        style={{
                            cursor: isOnline ? "pointer" : "default",
                            opacity: isOnline ? 1 : 0.5,
                        }}
                        >
                        <div className="friend-info">
                            <span className="friend-name">{friend.friend_name}</span>
                            <span className={`friend-status-text ${isOnline ? "online" : "offline"}`}>
                            {isOnline ? "Online" : "Offline"}
                            </span>
                        </div>
                        </div>
                    </li>
                    );
                })
                ) : (
                <li className="friends-sidebar__empty">No friends yet.</li>
                )}
            </ul>
            </section>

            {/* DM Drawer */}
            {activeChat && <DMDrawer isOpen={true} onClose={closeChat} />}

            {/* Pending requests */}
            <section className="friends-sidebar__section">
            <h3>Pending Requests</h3>
            <ul>
                {pending.received?.length > 0 ? (
                pending.received.map((r) => (
                    <li key={r.id} className="friends-sidebar__request">
                    <span>{r.from_user_name}</span>
                    <div className="friends-sidebar__actions">
                        <button onClick={() => acceptRequest(r.id)} className="accept-btn">Accept</button>
                        <button onClick={() => declineRequest(r.id)} className="decline-btn">Decline</button>
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
