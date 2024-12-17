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

    // Define a maximum number of players (e.g., 2)
    const MAX_PLAYERS = 2;

    // Check if the lobby is full
    const isLobbyFull = state.players.length === MAX_PLAYERS;

    /**
     * Establish WebSocket connection to the backend.
     */
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

    /**
     * Handle incoming WebSocket messages.
     */
    const handleWebSocketMessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);
    
        const actions = {
            connection_success: () => showToast("success", data.message),
            chat_message: () => dispatch({ type: "ADD_MESSAGE", payload: data.message }),
            player_list: () => dispatch({ type: "PLAYER_LIST", payload: data.players }),
            game_update: () => {
                console.log("Game update received:", data);
    
                // Dispatch the game update to the reducer
                dispatch({
                    type: "SET_GAME",
                    payload: {
                        board_state: data.board_state,
                        current_turn: data.current_turn,
                        winner: data.winner,
                        player_x: data.player_x,
                        player_o: data.player_o,
                    },
                });
    
                // Navigate to the game page if the game has started
                if (data.board_state && data.current_turn) {
                    navigate(`/games/${gameId}`);
                }
            },
            game_start_acknowledgment: () => {
                console.log("Game start acknowledgment received:", data.message);
    
                // Show toast notification
                showToast("success", data.message);
            },
            error: () => showToast("error", data.message || "An error occurred."),
        };
    
        const action = actions[data.type];
        action ? action() : console.warn(`Unknown WebSocket message type: ${data.type}`);
    };
    

    /**
     * Send a chat message.
     */
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

    /**
     * Start the game.
     */
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

    /**
     * Leave the lobby.
     */
    const handleLeaveLobby = () => {
        console.log("Leaving the lobby!");
        if(socket) {
            socket.send(
                JSON.stringify({
                    type: "leave_lobby",
                })
            );
        }
        navigate("/");
    };

    /**
     * Copy invite link.
     */
    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/lobby/${gameId}`);
        showToast("success", "Invite link copied to clipboard!");
    };

    
    // Handle "Enter" Key for Chat
    const handleKeyPress = (e) => {
        if (e.key === "Enter") handleSendMessage();
    };

    /**
     * Auto-scroll chat container when new messages arrive.
     */
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [state.messages]);

    /**
     * Render player slots.
     */
    const renderPlayersList = () => (
        <div className="players-list">
            {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
                const player = state.players[index]; // Check if a player exists in the slot
                return (
                    <div key={index} className="player-slot">
                        {player ? (
                            // Show player avatar and name if the player exists
                            <>
                                <div className="player-avatar">
                                    {player.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="player-info">
                                    <span className="player-name">{player.username}</span>
                                </div>
                            </>
                        ) : (
                            // Show the invite icon if no player is present
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

            {/* Buttons Section */}
            <div className="lobby-buttons">
                <button
                    onClick={handleStartGame}
                    className="lobby-button start-game-button"
                    disabled={!isLobbyFull}
                >
                    Start
                </button>
                <button onClick={handleLeaveLobby} className="lobby-button leave-lobby-button">
                    Leave
                </button>
            </div>

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
        </div>
    );
};

export default Lobby;


