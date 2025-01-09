import React from "react";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { useLobbyContext } from "../context/lobbyContext";
import { ChatWebsocketProvider } from "../websocket/ChatWebsocketProvider";
import { useChatWebSocketContext } from "../websocket/ChatWebsocketContext";
import { useGameWebSocketContext } from "../websocket/GameWebsocketContext";
import PlayerList from "./PlayerList"; // Abstracted player list component
import { showToast } from "../../utils/toast/Toast";
import "./lobby.css";

/**
 * LobbyPageContent Component
 * 
 * The main content of the LobbyPage, managing players, chat, and game controls.
 * 
 * @returns {JSX.Element} The LobbyPage content UI.
 */
const LobbyPageContent = () => {
    const { state } = useLobbyContext();
    const { sendGameMessage, isConnected: isGameConnected } = useGameWebSocketContext();
    const { sendChatMessage, isConnected: isChatConnected } = useChatWebSocketContext();

    const [message, setMessage] = React.useState("");
    const chatContainerRef = React.useRef(null);

    const MAX_PLAYERS = 2;
    const isLobbyFull = state.players.length === MAX_PLAYERS;

    console.log("Lobby State", state)

    /**
     * Handles sending a chat message.
     */
    const handleSendMessage = () => {
        if (message.trim()) {
            sendChatMessage(message); // Use chat WebSocket
            setMessage("");
        } else {
            showToast("error", "Message cannot be empty.");
        }
    };

    /**
     * Handles starting the game.
     */
    const handleStartGame = () => {
        if (!isLobbyFull) {
            showToast("error", "You need at least 2 players to start the game.");
            return;
        }
        sendGameMessage({ type: "start_game" });
    };

    /**
     * Handles inviting players by copying the lobby link.
     */
    const handleInvite = () => {
        navigator.clipboard.writeText(window.location.href);
        showToast("success", "Invite link copied to clipboard!");
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

            {/* Player List Section */}
            <div className="lobby-details">
                <PlayerList players={state.players} maxPlayers={MAX_PLAYERS} onInvite={handleInvite} />
            </div>

            {/* Chat Section */}
            <div className="chat-container">
                <h3>Game Chat</h3>
                <div className="chat-messages" ref={chatContainerRef}>
                    {state.messages.map((msg, index) => (
                        <div key={index} className="chat-message">
                            <strong>{msg.sender || "Unknown"}:</strong> {msg.content}
                        </div>
                    ))}
                </div>
                <div className="input-container">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message"
                        className="chat-input"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!isChatConnected} // Disable if chat WebSocket is not connected
                        className="send-button"
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* Game Controls */}
            <div className="buttons-container">
                <button
                    onClick={handleStartGame}
                    disabled={!isGameConnected || !isLobbyFull} // Disable if game WebSocket is not connected
                    className="start-button"
                >
                    Start Game
                </button>
            </div>
        </div>
    );
};

/**
 * LobbyPage Component
 * 
 * Wraps the LobbyPageContent with ChatWebsocketProvider for chat functionality.
 * 
 * @returns {JSX.Element} The wrapped LobbyPage UI.
 */
const LobbyPage = () => {
    const { id: lobbyName } = useParams();

    return (
        <ChatWebsocketProvider lobbyName={lobbyName}>
            <LobbyPageContent />
        </ChatWebsocketProvider>
    );
};

export default LobbyPage;
