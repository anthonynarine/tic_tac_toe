// Let's verify that FriendsSidebar is not statically rendered somewhere else
// We'll now run a trace to log each FriendsSidebar render to see where/when it's being mounted

import React, { useEffect } from "react";
import { useFriends } from "../context/friendsContext";
import AddFriendForm from "./AddFriendForm";
import DMDrawer from "./DMDrawer";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import "./FriendsSidebar.css";

const FriendsSidebar = () => {
  console.log("[FriendsSidebar] RENDERED"); // <-- Add this to see how many times it appears

  useEffect(() => {
  console.log("[FriendsSidebar] mounted");
  return () => console.log("[FriendsSidebar] unmounted");
}, []);

// Also add console.trace inside the component
console.trace("[FriendsSidebar] RENDERED");


  const {
    friends,
    pending,
    acceptRequest,
    declineRequest,
    refreshFriends,
  } = useFriends();

  const { activeChat, openChat, closeChat } = useDirectMessage();
  const { user } = useUserContext();

  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  const handleFriendClick = (friend) => {
    if (friend.friend_status === "online") {
      openChat(friend);
    }
  };

  return (
    <div className="friends-sidebar">
      <div className="friends-sidebar__header">
        <h2 className="friends-sidebar__title">Friends</h2>
      </div>

      <div className="friends-sidebar__content">
        <AddFriendForm />

        <section className="friends-sidebar__section">
          <h3>Friends</h3>
          <ul>
            {friends.length > 0 ? (
              friends.map((friend) => {
                const isCurrentUserFrom = friend.from_user === user.id;
                const friendId = isCurrentUserFrom ? friend.to_user : friend.from_user;
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

        {activeChat && <DMDrawer isOpen={true} onClose={closeChat} />}

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
