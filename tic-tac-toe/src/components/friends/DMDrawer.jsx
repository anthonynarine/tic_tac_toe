import React, { useEffect, useRef, useState } from "react";
import { useDirectMessage } from "../context/directMessageContext";
import { FaCheck } from "react-icons/fa";
import { IoIosSend } from "react-icons/io";

import "./DMDrawer.css";

const DMDrawer = ({ isOpen, onClose }) => {
    const {
        activeChat,
        messages,
        sendMessage,
        closeChat,
    } = useDirectMessage();

    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

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

    if (!isOpen || !activeChat) return null;

    const friendDisplayName = activeChat.friend_name || activeChat.first_name || "Friend";

    return (
        <div className={`dm-drawer ${isOpen ? "open" : ""}`}>
            {/* Header */}
            <div className="dm-header">
                <h2>{friendDisplayName}</h2>
                <button onClick={() => { closeChat(); onClose(); }}>&times;</button>
            </div>

            {/* Messages */}
            <div className="dm-messages">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`dm-message ${msg.sender_id === activeChat.id ? "incoming" : "outgoing"}`}
                    >
                        <span>{msg.message}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
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
                <div>
            </div>
        </div>
    );
};

export default DMDrawer;
