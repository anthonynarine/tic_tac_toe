import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { showToast } from "../../utils/toast/Toast";
import "./lobby.css";

const Lobby = () => {
    const { state, dispatch } = useLobbyContext(); // Access lobby state and dispatch
    const [message, setMessage] = useState(""); // Chat input state
    const { id: gameId } = useParams(); // Extract game ID from URL
    const navigate = useNavigate(); // Navigation
    const [socket, setSocket] = useState(null); // WebSocket instance
    const chatContainerRef = useRef(null); // For auto-scrolling chat

    /**
     * Establish WebSocket connection to the Django backend.
     */
    useEffect(() => {
        const token = localStorage.getItem("access_token"); // Get token from localStorage
        if (!token) {
            showToast("error", "You must be logged in to join the lobby.");
            navigate("/login");
            return;
        }

        const webSocket = new WebSocket(
            `ws://localhost:8000/ws/lobby/${gameId}/?token=${token}`
        );

        // Handle WebSocket connection open
        webSocket.onopen = () => {
            console.log("WebSocket connected.");
        };

        // Handle WebSocket messages
        webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("WebSocket message received:", data);

            // Map message types to actions
            const actions = {
                connection_success: () => {
                    showToast("success", data.message);
                },
                chat_message: () => {
                    dispatch({ type: "ADD_MESSAGE", payload: data.message });
                },
                game_start: () => {
                    showToast("info", "The game is starting!");
                    navigate(`/games/${gameId}`);
                },
                error: () => {
                    showToast("error", data.message || "An error occurred.");
                },
            };

            // Execute corresponding action
            const action = actions[data.type];
            if (action) {
                action();
            } else {
                console.warn(`Unknown WebSocket message type: ${data.type}`);
            }
        };

        // Handle WebSocket close
        webSocket.onclose = () => {
            console.log("WebSocket disconnected.");
        };

        // Save the WebSocket instance
        setSocket(webSocket);

        // Cleanup WebSocket connection on unmount
        return () => {
            if (webSocket) {
                webSocket.close();
            }
        };
    }, [gameId, dispatch, navigate]);

    /**
     * Sends a chat message to the server via WebSocket.
     */
    const handleSendMessage = () => {
        if (message.trim() && socket) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message,
                })
            );
            setMessage(""); // Clear the input
        }
    };

    /**
     * Sends a start game event to the server via WebSocket.
     */
    const handleStartGame = () => {
        if (state.players.length < 2) {
            showToast("error", "You need at least 2 players to start the game.");
            return;
        }

        if (socket) {
            socket.send(
                JSON.stringify({
                    type: "start_game",
                })
            );
        }
    };

    /**
     * Auto-scroll the chat container when new messages arrive.
     */
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [state.messages]);

    /**
     * Handles "Enter" key press in the chat input to send a message.
     */
    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleSendMessage();
        }
    };

    return (
            <div className="lobby-container">
            <h1 className="lobby-title">Game Lobby</h1>

            <div className="lobby-details">
                <h2>Players in Lobby</h2>
                <ul>
                {state.players.map((player, index) => (
                    <li key={index}>{player.username}</li>
                ))}
                </ul>
            </div>

            {/* Chat Section */}
            <div className="chat-container">
                <h3>Chat</h3>
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
