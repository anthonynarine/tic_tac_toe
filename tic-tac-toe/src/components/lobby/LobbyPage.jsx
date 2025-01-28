import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { useUserContext } from "../context/userContext";
import { showToast } from "../../utils/toast/Toast";
import { CiCirclePlus } from "react-icons/ci";
import "./lobby.css";

/**
 * LobbyPage Component
 *
 * Handles game lobby functionality, including WebSocket connection, chat, player management,
 * and initiating the game.
 */
const LobbyPage = () => {
    /** Contexts */
    const { user } = useUserContext(); // Access logged-in user details.
    const { state, dispatch: lobbyDispatch } = useLobbyContext(); // Access and dispatch lobby state.

    /** Hooks */
    const { id: gameId } = useParams(); // Extract game ID from URL params.
    const navigate = useNavigate(); // Navigate between routes.

    /** State */
    const [message, setMessage] = useState(""); // Chat message input.
    const [socket, setSocket] = useState(null); // WebSocket instance.
    const chatContainerRef = useRef(null); // Reference for the chat container for auto-scrolling.

    /** Constants */
    const MAX_PLAYERS = 2; // Maximum players allowed in the lobby.
    const isLobbyFull = state.players.length === MAX_PLAYERS; // Check if the lobby is full.

    // ---------------------------- WebSocket Setup ---------------------------- //

    /**
     * Establishes a WebSocket connection to the backend's ChatConsumer.
     * Listens for messages and dispatches actions to update the lobby state.
     */
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            showToast("error", "You must be logged in to join the lobby.");
            navigate("/login");
            return;
        }

        // Connect to ChatConsumer WebSocket
        const webSocket = new WebSocket(
            `ws://localhost:8000/ws/chat/${gameId}/?token=${token}`
        );

        // WebSocket lifecycle events
        webSocket.onopen = () => console.log("WebSocket connected.");
        webSocket.onmessage = (event) => handleWebSocketMessage(event);
        webSocket.onclose = () => console.log("WebSocket disconnected.");
        webSocket.onerror = (error) =>
            console.error("WebSocket encountered an error:", error);

        setSocket(webSocket); // Store WebSocket instance in state.

        // Cleanup WebSocket on component unmount
        return () => {
            console.log("Cleaning up WebSocket connection...");
            webSocket.close();
        };
    }, [gameId, navigate]);

    /**
     * Handles incoming WebSocket messages.
     *
     * @param {Object} event - The WebSocket event containing the message data.
     */
    const handleWebSocketMessage = (event) => {
        const data = JSON.parse(event.data); // Parse the incoming message.
        console.log("WebSocket message received:", data);

        // Define actions based on message types
        const actions = {
            connection_success: () => showToast("success", data.message),
            chat_message: () =>
                lobbyDispatch({ type: "ADD_MESSAGE", payload: data.message }),
            player_list: () =>
                lobbyDispatch({ type: "PLAYER_LIST", payload: data.players }),
            error: () => showToast("error", data.message || "An error occurred."),
        };

        // Execute the corresponding action
        const action = actions[data.type];
        if (action) {
            action();
        } else {
            console.warn(`Unhandled WebSocket message type: ${data.type}`);
        }
    };

    // ---------------------------- Chat Functionality ---------------------------- //

    /**
     * Sends a chat message to the backend.
     */
    const handleSendMessage = () => {
        if (message.trim() && socket) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message,
                })
            );
            setMessage(""); // Clear the input after sending.
        }
    };

    /**
     * Automatically scrolls the chat container to the latest message.
     */
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [state.messages]);

    // ---------------------------- Utility Functions ---------------------------- //

    /**
     * Copies the lobby invite link to the clipboard.
     */
    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/lobby/${gameId}`);
        showToast("success", "Invite link copied to clipboard!");
    };

    // ---------------------------- Render Functions ---------------------------- //

    /**
     * Renders the list of players in the lobby.
     *
     * @returns {JSX.Element} The player list UI.
     */
    const renderPlayersList = useMemo(
        () => (
            <div className="players-list">
                {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
                    const player = state.players[index]; // Retrieve player data from state
                    return (
                        <div key={index} className="player-slot">
                            {player ? (
                                <div className="player-details">
                                    <div className="player-avatar">
                                        {player.first_name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="player-name">{player.first_name}</div>
                                </div>
                            ) : (
                                <div className="empty-slot">
                                    <CiCirclePlus
                                        className="icon-invite"
                                        onClick={handleCopyLink}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        ),
        [state.players]
    );

    // ---------------------------- Component Return ---------------------------- //

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">Game Lobby</h1>

            <div className="lobby-details">{renderPlayersList}</div>

            <div className="chat-container">
                <h3>Game Chat</h3>
                <div className="chat-messages" ref={chatContainerRef}>
                    {state.messages.map((msg, index) => (
                        <div key={index} className="chat-message">
                            <strong>{msg.sender || "Unknown"}:</strong> {msg.content}
                        </div>
                    ))}
                </div>
                <div className="chat-input">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message"
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage}>Send</button>
                </div>
            </div>
        </div>
    );
};

export default LobbyPage;
