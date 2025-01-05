import React, { useState, useRef, useEffect } from "react";
import { useLobbyContext } from "../context/lobbyContext";
import { useGameWebsocketContext } from "../websocket/GameWebsocketContext";
import { useChatWebsocketContext } from "../websocket/ChatWebsocketContext";
import PlayerList from "./PlayerList"; // Abstracted player list component
import { showToast } from "../../utils/toast/Toast";
import "./lobby.css";

/**
 * LobbyPage Component
 * 
 * Handles game lobby functionality, including chat and game-related
 * features like sending messages, displaying players, and starting a game.
 * Integrates with the ChatWebsocketProvider and GameWebsocketProvider for
 * seamless WebSocket communication.
 * 
 * @returns {JSX.Element} The LobbyPage component UI.
 */
const LobbyPage = () => {
    // Contexts for managing state and dispatch
    const { state } = useLobbyContext(); // Step 1: Access the lobby state
    const { sendGameMessage, isConnected: isGameConnected } = useGameWebsocketContext(); // Step 2: Access game WebSocket functionality
    const { sendChatMessage, isConnected: isChatConnected } = useChatWebsocketContext(); // Step 3: Access chat WebSocket functionality

    // Local state for chat message input
    const [message, setMessage] = useState(""); // Manage chat input
    const chatContainerRef = useRef(null); // Reference for auto-scrolling chat messages

    // Constants
    const MAX_PLAYERS = 2; // Define the max number of players
    const isLobbyFull = state.players.length === MAX_PLAYERS; // Check if the lobby is full

    /**
     * Handles sending a chat message.
     * Validates input and sends the message through the ChatWebsocketProvider.
     */
    const handleSendMessage = () => {
        if (message.trim()) {
            sendChatMessage({ type: "chat_message", message }); // Send message via WebSocket
            setMessage(""); // Clear input field after sending
        } else {
            showToast("error", "Message cannot be empty."); // Error if message is empty
        }
    };

    /**
     * Handles starting the game.
     * Validates player count and sends a start game request.
     */
    const handleStartGame = () => {
        if (!isLobbyFull) {
            showToast("error", "You need at least 2 players to start the game.");
            return;
        }
        sendGameMessage({ type: "start_game" }); // Send start game action via WebSocket
    };

    /**
     * Handles inviting players to empty slots.
     */
    const handleInvite = () => {
        navigator.clipboard.writeText(window.location.href); // Copy lobby link to clipboard
        showToast("success", "Invite link copied to clipboard!"); // Show success notification
    };

    /**
     * Automatically scrolls the chat container when new messages are added.
     */
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [state.messages]);

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">Game Lobby</h1>

            {/* Render player list */}
            <div className="lobby-details">
                <PlayerList players={state.players} maxPlayers={MAX_PLAYERS} onInvite={handleInvite} />
            </div>

            {/* Chat section */}
            <div className="chat-container">
                <h3>Game Chat</h3>
                <div className="chat-messages" ref={chatContainerRef}>
                    {state.messages.map((msg, index) => (
                        <div key={index} className="chat-message">
                            <strong>{msg.sender || "Unknown"}:</strong> {msg.content}
                        </div>
                    ))}
                </div>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message"
                />
                <button onClick={handleSendMessage} disabled={!isChatConnected}>
                    Send
                </button>
            </div>

            {/* Control buttons */}
            <div className="lobby-buttons">
                <button onClick={handleStartGame} disabled={!isGameConnected || !isLobbyFull}>
                    Start Game
                </button>
            </div>
        </div>
    );
};

export default LobbyPage;
