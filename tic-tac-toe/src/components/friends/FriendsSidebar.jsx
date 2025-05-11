import React, { useEffect, useRef } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import { useUserContext } from "../context/userContext";
import { groupFriendsByStatus } from "./utils/helpingFriends";


import "./FriendsSidebar.css"; 


const FriendsSidebar = ({ isOpen, onClose }) => {
    const {
        friends,
        pending,
        acceptRequest,
        declineRequest,
        refreshFriends,
    } = useFriends();

    const { online, offline } = groupFriendsByStatus(friends);

    const hasLoaded = useRef(false);
    const user = useUserContext();

    const handleAccept = async (requestId) => {    
        await acceptRequest(requestId);
        refreshFriends();
    };

    const handleDecline = async (requestId) => {
        await declineRequest(requestId);
        refreshFriends();
    };


    useEffect(() => {
        if (isOpen && !hasLoaded.current) {
        refreshFriends();
        hasLoaded.current = true;
        }
    }, [isOpen, refreshFriends]);

    return (
    <div className={`friends-sidebar ${isOpen ? "open" : ""}`}>
        {/* Sticky Header */}
        <div className="friends-sidebar__header">
        <h2 className="friends-sidebar__title">Friends</h2>
        <button className="friends-sidebar__close" onClick={onClose}>
            &times;
        </button>
        </div>

        {/* Scrollable Content */}
        <div className="friends-sidebar__content">
        <AddFriendForm />

        {/* Grouped Online/Offline Friends */}
        <section className="friends-sidebar__section">
        <h3>Friends</h3>
        <ul>
            {friends.length > 0 ? (
            friends.map((friend) => (
                <li key={friend.id} className="friends-sidebar__friend">
                <div className="friend-row">
                {/* <span className={`status-dot ${friend.friend_status ? "online" : "offline"}`}></span> */}
                <div className="friend-info">
                    <span className="friend-name">{friend.friend_name}</span>
                    <span className="friend-status-text">
                    {friend.friend_status ? "Online" : "Offline"}
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

        {/* Pending Requests */}
        <section className="friends-sidebar__section">
            <h3>Pending Requests</h3>
            <ul>
            {pending.received?.length > 0 ? (
                pending.received.map((r) => (
                <li key={r.id} className="friends-sidebar__request">
                    <span>{r.from_user_name}</span>
                    <div className="friends-sidebar__actions">
                    <button
                        onClick={async () => {
                        await acceptRequest(r.id);
                        refreshFriends();
                        }}
                        className="accept-btn"
                    >
                        Accept
                    </button>
                    <button
                        onClick={async () => {
                        await declineRequest(r.id);
                        refreshFriends();
                        }}
                        className="decline-btn"
                    >
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
