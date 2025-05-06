import React, { useEffect, useRef } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
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

    const hasLoaded = useRef(false);
    const user = useUserContext();

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
            {/* Online Friends */}
            <section className="friends-sidebar__section">
            <h3>Online</h3>
            <ul>
                {friends.length > 0 ? (
                friends.map((friend) => {

                    console.log("Friendship object:", friend);
                    console.log("Current User ID:", user.id);
                    const isCurrentUserFrom = friend.from_user === user.id;
                    const friendName = isCurrentUserFrom ? friend.to_user_name : friend.from_user_name;
                    const isOnline = isCurrentUserFrom ? friend.to_user_is_online : friend.from_user_is_online;
                
                    return (

                        <li key={friend.id} className="friends-sidebar__friend">
                        <span>{friendName}</span>
                        <span className={isOnline ? "online" : "offline"}>
                            {isOnline ? "Online" : "Offline"}
                        </span>
                        </li>
                    );
                })
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
                        <button onClick={() => acceptRequest(r.id)} className="accept-btn">
                        Accept
                        </button>
                        <button onClick={() => declineRequest(r.id)} className="decline-btn">
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
