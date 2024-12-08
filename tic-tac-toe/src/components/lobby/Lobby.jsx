import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { showToast } from "../../utils/toast/Toast";
import { CiCirclePlus } from "react-icons/ci";
import "./lobby.css";

const Lobby = () => {
    // Hooks
    const { state, dispatch } = useLobbyContext(); // Lobby state and dispatch
    const { id: gameId } = useParams(); // Extract game ID from URL
    const navigate = useNavigate(); // Navigation
    const chatContainerRef = useRef(null); // For auto-scrolling chat

    // State
    const [message, setMessage] = useState(""); // Chat input
    const [socket, setSocket] = useState(null); // WebSocket instance

    // WebSocket Connection
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            showToast("error", "You must be logged in to join the lobby.");
            navigate("/login");
            return;
        }

        const webSocket = new WebSocket(
            `ws://localhost:8000/ws/lobby/${gameId}/?token=${token}`
        );

        webSocket.onopen = () => console.log("WebSocket connected.");
        webSocket.onmessage = (event) => handleWebSocketMessage(event);
        webSocket.onclose = () => console.log("WebSocket disconnected.");

        setSocket(webSocket);

        return () => {
            if (webSocket) webSocket.close();
        };
    }, [gameId, navigate, dispatch]);

    // Handle WebSocket Messages
    const handleWebSocketMessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        const actions = {
            connection_success: () => showToast("success", data.message),
            chat_message: () => dispatch({ type: "ADD_MESSAGE", payload: data.message }),
            game_start: () => {
                showToast("info", "The game is starting!");
                navigate(`/games/${gameId}`);
            },
            error: () => showToast("error", data.message || "An error occurred."),
            player_list: () => dispatch({ type: "PLAYER_LIST", payload: data.players }),
        };

        const action = actions[data.type];
        action ? action() : console.warn(`Unknown WebSocket message type: ${data.type}`);
    };

    // Send Chat Message
    const handleSendMessage = () => {
        if (message.trim() && socket) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message,
                })
            );
            setMessage(""); // Clear input
        }
    };

    // Start Game
    const handleStartGame = () => {
        if (state.players.length < 2) {
            showToast("error", "You need at least 2 players to start the game.");
            return;
        }

        socket &&
            socket.send(
                JSON.stringify({
                    type: "start_game",
                })
            );
    };

    // Copy invite link
    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/lobby/${gameId}`);
        showToast("success", "Invite link copied to clipboard!");
    };

    // Auto-scroll Chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [state.messages]);

    // Handle "Enter" Key for Chat
    const handleKeyPress = (e) => {
        if (e.key === "Enter") handleSendMessage();
    };

    // Define a maximum number of players (e.g., 2 for now)
    const MAX_PLAYERS = 2;

    // Render Players List
    const renderPlayersList = () => (
        <div className="players-list">
        {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
            const player = state.players[index]; // Check if a player exists in the slot
            return (
            <div key={index} className="player-slot">
                {player ? (
                // If the player is present, show their avatar and name
                <>
                    <div className="player-avatar">
                    {player.username.charAt(0).toUpperCase()} {/* First letter as avatar */}
                    </div>
                    <div className="player-info">
                    <span className="player-name">{player.username}</span>
                    </div>
                </>
                ) : (
                // If no player, show the invite icon as the button
                <CiCirclePlus className="icon-invite" onClick={handleCopyLink} />
                )}
            </div>
            );
        })}
        </div>
    );

    return (
        <div className="lobby-container">
            {/* Lobby Header */}
            <h1 className="lobby-title">Game Lobby</h1>

            {/* Players in Lobby */}
            <div className="lobby-details">{renderPlayersList()}</div>

            {/* Chat Section */}
            <div className="chat-container">
                <h3>Game Chat</h3>
                <div className="chat-messages" ref={chatContainerRef}>
                    {state.messages.map((message, index) => (
                        <div key={index} className="chat-message">
                            <strong>{message.sender || "Unknown"}:</strong> {message.content}
                        </div>
                    ))}
                </div>
                <div className="chat-input">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message"
                        onKeyPress={handleKeyPress}
                    />
                    <button onClick={handleSendMessage} aria-label="Send message">
                        Send
                    </button>
                </div>
            </div>

            {/* Start Game Button */}
            {state.isHost && (
                <button
                    className="start-game-button"
                    onClick={handleStartGame}
                    disabled={state.players.length < 2}
                    aria-label="Start game"
                >
                    Start Game
                </button>
            )}
        </div>
    );
};

export default Lobby;
