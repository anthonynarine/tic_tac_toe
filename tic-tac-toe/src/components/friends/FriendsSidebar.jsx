import React, { useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import DMDrawer from "./DMDrawer";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import "./FriendsSidebar.css";

const FriendsSidebar = ({ isOpen, onClose }) => {
    const {
        friends,
        pending,
        acceptRequest,
        declineRequest,
        refreshFriends,
    } = useFriends();

    const { activeChat, openChat, closeChat } = useDirectMessage();
    const{ user } = useUserContext();

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
            <div className="friends-sidebar__header">
                <h2 className="friends-sidebar__title">Friends</h2>
                <button className="friends-sidebar__close" onClick={onClose}>
                    &times;
                </button>
            </div>

            <div className="friends-sidebar__content">
                <AddFriendForm />

                <section className="friends-sidebar__section">
                    <h3>Friends</h3>
                    <ul>
                    {friends.length > 0 ? (
                        friends.map((friend) => {
                        console.log("🔍 user from context:", user);
                        console.log("🧠 friend object:", friend);

                        const isCurrentUserFrom = friend.from_user === user.id;
                        const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;

                        console.log("[DM] Clicked friend:", friend);
                        console.log("Current user ID:", user.id);
                        console.log("Resolved friend ID:", friendId);

                        return (
                            <li
                            key={friend.id}
                            className={`friends-sidebar__friend ${activeChat?.id === friendId ? "active" : ""}`}
                            >
                            <div
                                className="friend-row"
                                onClick={() => openChat(friend)}
                                style={{ cursor: "pointer" }}
                            >
                                <div className="friend-info">
                                <span className="friend-name">{friend.friend_name}</span>
                                <span
                                    className={`friend-status-text ${
                                    friend.friend_status === "online" ? "online" : "offline"
                                    }`}
                                >
                                    {friend.friend_status === "online" ? "Online" : "Offline"}
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

                <DMDrawer isOpen={!!activeChat} onClose={closeChat} />
            </div>
        </div>
    );
};

export default FriendsSidebar;
