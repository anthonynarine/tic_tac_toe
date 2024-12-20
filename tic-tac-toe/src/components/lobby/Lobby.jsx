import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { showToast } from "../../utils/toast/Toast";
import { CiCirclePlus } from "react-icons/ci";
import { useUserContext } from "../context/userContext";
import "./lobby.css";

/**
 * Lobby Component
 *
 * Handles the game lobby functionality, including WebSocket connection,
 * displaying players, managing chat messages, and initiating the game.
 */
const Lobby = () => {
    // Contexts
    const { user } = useUserContext(); // Current user info
    const { state, dispatch } = useLobbyContext(); // Lobby state and dispatcher

    // Hooks
    const { id: gameId } = useParams(); // Extract the game ID from the URL
    const navigate = useNavigate(); // Navigation
    const chatContainerRef = useRef(null); // For auto-scrolling the chat container

    // State
    const [message, setMessage] = useState(""); // Chat message input
    const [socket, setSocket] = useState(null); // WebSocket instance

    // Constants
    const MAX_PLAYERS = 2; // Maximum number of players allowed in the lobby
    const isLobbyFull = state.players.length === MAX_PLAYERS; // Check if the lobby is full

    /**
     * Establishes a WebSocket connection when the component mounts.
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
     * Handles incoming WebSocket messages and updates the state accordingly.
     *
     * @param {Object} event - The WebSocket event containing the message data.
     */
    const handleWebSocketMessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received for type:", data.type, "Payload:", data);

        const actions = {
            connection_success: () => showToast("success", data.message),
            chat_message: () => dispatch({ type: "ADD_MESSAGE", payload: data.message }),
            player_list: () => dispatch({ type: "PLAYER_LIST", payload: data.players }),
            game_update: () => {
                console.log("Game update received:", data);

                if (!data.board_state || !data.current_turn || !data.game_id) {
                    console.error("Invalid game update data:", data);
                    showToast("error", "Failed to update the game. Invalid data received.");
                    return;
                }

                const playerRole =
                    user?.id === data.player_x?.id ? "X" :
                    user?.id === data.player_o?.id ? "O" : null;

                dispatch({
                    type: "SET_GAME",
                    payload: {
                        board_state: data.board_state,
                        current_turn: data.current_turn,
                        winner: data.winner,
                        player_x: data.player_x,
                        player_o: data.player_o,
                        player_role: playerRole,
                    },
                });

                if (data.board_state && data.current_turn && data.game_id) {
                    navigate(`/games/${data.game_id}`);
                } else {
                    showToast("error", "Failed to start the game. Invalid data received.");
                }
            },
            game_start_acknowledgment: () => {
                showToast("success", data.message);
            },
            error: () => showToast("error", data.message || "An error occurred."),
        };

        const action = actions[data.type];
        if (action) {
            action();
        } else {
            console.warn(`Unknown WebSocket message type: ${data.type}`);
        }
    };

    /**
     * Sends a chat message through the WebSocket connection.
     */
    const handleSendMessage = () => {
        if (message.trim() && socket) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message,
                })
            );
            setMessage(""); // Clear the input field
        }
    };

    /**
     * Initiates the game by sending a `start_game` message through the WebSocket.
     */
    const handleStartGame = () => {
        if (!isLobbyFull) {
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
     * Leaves the current lobby and navigates back to the homepage.
     */
    const handleLeaveLobby = () => {
        if (socket) {
            socket.send(
                JSON.stringify({
                    type: "leave_lobby",
                })
            );
        }
        navigate("/");
    };

    /**
     * Copies the lobby's invite link to the clipboard.
     */
    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/lobby/${gameId}`);
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

    /**
     * Renders the list of players in the lobby, showing avatars and names.
     */
    const renderPlayersList = () => (
        <div className="players-list">
            {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
                const player = state.players[index]; // Check if a player exists in the slot
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
                                <CiCirclePlus className="icon-invite" onClick={handleCopyLink} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">Game Lobby</h1>

            <div className="lobby-details">{renderPlayersList()}</div>

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
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
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
