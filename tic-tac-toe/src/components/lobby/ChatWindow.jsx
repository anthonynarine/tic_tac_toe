import React, { useRef, useEffect, useState } from "react";
import "./ChatWindow.css";

const ChatWindow = ({ messages, onSendMessage }) => {
    const [inputMessage, setInputMessage] = useState(""); // State for the input field
    const chatContainerRef = useRef(null); // Ref for auto-scrolling the chat messages

    // Auto-scroll to the bottom when messages are updated
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Handles sending the message
    const handleSend = () => {
        if (inputMessage.trim()) {
            onSendMessage(inputMessage.trim()); // Send the message to the parent
            setInputMessage(""); // Clear the input
        }
    };

    // Handles closing the chat window
    const handleClose = () => {
        onSendMessage(null); // Send a null message to indicate closing
    };

    return (
        <div className="chat-window">
            <div className="chat-header">
                <h3>Chat</h3>
                <button className="close-button" onClick={handleClose} aria-label="Close Chat">
                    ✖
                </button>
            </div>

            <div className="chat-messages" ref={chatContainerRef}>
                {messages.map((msg, index) => (
                    <div key={index} className="chat-message">
                        <strong>{msg.sender || "Unknown"}:</strong> {msg.content}
                    </div>
                ))}
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type a message..."
                />
                <button onClick={handleSend} aria-label="Send Message">
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;
