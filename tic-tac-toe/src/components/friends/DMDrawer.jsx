import React, { useEffect, useRef, useState } from "react";
import { useDirectMessage } from "../context/directMessageContext";
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

    return (
        <div className={`dm-drawer ${isOpen ? "open" : ""}`}>
        <div className="dm-header">
            <h3>Chatting with {activeChat.friend_name || activeChat.first_name}</h3>
            <button onClick={() => { closeChat(); onClose(); }}>&times;</button>
        </div>

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

        <div className="dm-input">
            <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            />
            <button onClick={handleSend}>Send</button>
        </div>
        </div>
    );
};

export default DMDrawer;
