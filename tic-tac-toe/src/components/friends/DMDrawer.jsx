import React, { useEffect, useRef, useState } from "react";
import { useDirectMessage } from "../context/directMessageContext";
import { IoIosSend } from "react-icons/io";
import { useUserContext } from "../context/userContext";
import MessageBubble from "./MessageBubble"
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

    // Scroll to bottom whenever new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Message send handler
    const handleSend = () => {
        if (newMessage.trim()) {
        sendMessage(newMessage);
        setNewMessage("");
        }
    };

    // Only render if drawer is open and we have an active chat target
    if (!isOpen || !activeChat) return null;

    const friendDisplayName = activeChat.friend_name || activeChat.first_name || "Friend";

    return (
        <div className={`dm-drawer ${isOpen ? "open" : ""}`}>
        {/* Header with close button */}
        <div className="dm-header">
            <h2>{friendDisplayName}</h2>
            <button onClick={() => { closeChat(); onClose(); }}>&times;</button>
        </div>

        {/* Message history */}
        <div className="dm-messages">
            {messages.map((msg, index) => (
                <MessageBubble key={index} msg={msg} currentUserId={user.id} />
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Message input area */}
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
