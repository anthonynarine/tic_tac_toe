// File: DMDrawer.jsx

import React, { useEffect, useRef, useState } from "react";
import { useDirectMessage } from "../context/directMessageContext";
import { IoIosSend } from "react-icons/io";
import { IoCloseSharp, IoAddSharp } from "react-icons/io5";
import { useInviteAndNotifyFriend } from '../hooks/useInviteAndNotifyFriend'; // ✅ correct




import { useUserContext } from "../context/userContext";
import MessageBubble from "./MessageBubble";
import "./DMDrawer.css";

const DMDrawer = ({ isOpen, onClose = () => {} }) => {
    const {
        activeChat,
        messages,
        sendMessage,
        closeChat,
    } = useDirectMessage();

    const [newMessage, setNewMessage] = useState("");
    const { user } = useUserContext();
    const messagesEndRef = useRef(null);
    const invite = useInviteAndNotifyFriend();

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = () => {
        if (newMessage.trim()) {
            sendMessage(newMessage);
            setNewMessage("");
        }
    };

    const handleSendGameInvite = () => {
    if (activeChat) invite(activeChat);
    };

    if (!isOpen || !activeChat) return null;

    const friendId =
        activeChat.from_user === user.id ? activeChat.to_user : activeChat.from_user;

    const threadMessages = Array.isArray(messages?.[friendId])
        ? messages[friendId]
        : [];

    const friendDisplayName =
        activeChat.friend_name || activeChat.first_name || "Friend";

    return (
        <div className={`dm-drawer ${isOpen ? "open" : ""}`}>
            <div className="dm-header">
                <div className="dm-header-left">
                    <h2>{friendDisplayName}</h2>
                </div>

                <div className="dm-header-center">
                    <button
                        className="invite-icon"
                        onClick={handleSendGameInvite}
                        title="Invite to Game"
                    >
                        <IoAddSharp size={18} />
                    </button>
                </div>

                <div className="dm-header-right">
                    <button
                        className="closeBtn"
                        onClick={() => {
                            closeChat();
                            onClose();
                        }}
                    >
                        <IoCloseSharp size={18} />
                    </button>
                </div>
            </div>

            <div className="dm-messages">
                {threadMessages.map((msg) => (
                    <MessageBubble key={msg.id || msg.timestamp} msg={msg} currentUserId={user.id} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="dm-input">
                <div className="dm-input-container">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type a message..."
                    />
                    <button
                        className="send-btn"
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                        aria-label="Send message"
                    >
                        <IoIosSend size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DMDrawer;
