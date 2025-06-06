import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";

import { showToast } from "../../utils/toast/Toast";
import getWebSocketURL from "./utils/getWebsocketURL";
import { CiCirclePlus } from "react-icons/ci";
import { IoIosSend } from "react-icons/io";
import "./lobby.css";

import Cookies from "js-cookie"

/**
 * Lobby Component
 *
 * Handles game lobby functionality, including WebSocket connection, chat, player management,
 * and initiating the game.
 */
const LobbyPage = () => {
    // Contexts
    const { state, dispatch: lobbyDispatch } = useLobbyContext();

    // Hooks
    const { id: gameId } = useParams();
    const navigate = useNavigate();

    // State
    const [message, setMessage] = useState("");
    const [socket, setSocket] = useState(null);
    const chatContainerRef = useRef(null);

    // Constants
    const MAX_PLAYERS = 2;
    const isLobbyFull = state.players.length === MAX_PLAYERS;

    /**
     * Establish WebSocket connection for the lobby.
     */
    useEffect(() => {

        const token = process.env.NODE_ENV === "production"
            ? Cookies.get("access_token")
            : localStorage.getItem("access_token");
        
        if (!token) {
            console.error("Access token not found. Cannot initialize WebSocket.");
            return;
        }
    
        const webSocket = new WebSocket(
            getWebSocketURL({ id: gameId, token, isLobby: true})
        );
    
        webSocket.onopen = () => console.log("WebSocket connected.");
        webSocket.onmessage = (event) => handleWebSocketMessage(event);
        webSocket.onclose = () => console.log("WebSocket disconnected.");
        webSocket.onerror = (error) => console.error("WebSocket encountered an error:", error);
    
        setSocket(webSocket);
    
        return () => {
            console.log("Cleaning up WebSocket connection...");
            webSocket.close();
        };
    }, [gameId, navigate]);
    

    /**
     * Handles WebSocket messages.
     *
     * @param {Object} event - The WebSocket event containing the message data.
     */
    const handleWebSocketMessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📥 WebSocket message received:", data);  // ✅ Debugging

        const actions = {
            // connection_success: () => showToast("success", data.message),
            chat_message: () => lobbyDispatch({ type: "ADD_MESSAGE", payload: data.message }),
            update_player_list: () => lobbyDispatch({ type: "PLAYER_LIST", payload: data.players }),
            game_start_acknowledgment: () => handleGameStartAcknowledgment(data),
            error: () => showToast("error", data.message || "An error occurred."),
        };

        const action = actions[data.type];
        if (action) {
            action();
        } else {
            console.warn(`Unhandled WebSocket message type: ${data.type}`);
        }
    };

    /**
     * Handles the server's confirmation that the game has
     *  started and navigates players to the game page.
     *
     * @param {Object} data - WebSocket payload.
     */
    const handleGameStartAcknowledgment = (data) => {
        // showToast("success", data.message);

        console.log("🚀 WebSocket received game_start_acknowledgment:", data);
        console.log("🚀 Navigating to game page:", `/games/${data.game_id}`);
        console.log("Game ID received for navigation:", data.game_id, typeof data.game_id);

        navigate(`/games/${data.game_id}`);
    };

    /**
     * Handles sending chat messages.
     */
    const handleSendMessage = () => {
        if (message.trim() && socket) {
            socket.send(
                JSON.stringify({
                    type: "chat_message",
                    message,
                })
            );
            setMessage("");
        }
    };

    /**
     * Sends a ws request to the server to start the game..
     */
    const handleStartGame = () => {
        if (!isLobbyFull) {
            showToast("error", "You need at least 2 players to start the game.");
            return;
        }

        socket?.send(
            JSON.stringify({
                type: "start_game",
            })
        );
    };

    /**
     * Handles leaving the lobby.
     */
    const handleLeaveLobby = () => {
        socket?.send(
            JSON.stringify({
                type: "leave_lobby",
            })
        );
        navigate("/");
    };

    /**
     * Copies the lobby invite link to the clipboard.
     */
    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/lobby/${gameId}`);
        showToast("success", "Invite link copied to clipboard!");
    };

    /**
     * Automatically scrolls the chat container to the latest message.
     */
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [state.messages]);

    /**
     * Renders the list of players in the lobby.
     */
    const playersList = useMemo(
        () => (
            <div className="players-list">
                {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
                    const player = state.players[index];
                    return (
                        <div key={index} className="player-slot">
                            {player ? (
                                <div className="player-details">
                                    {/* <div className="player-avatar">
                                        {player.first_name?.charAt(0).toUpperCase()}
                                    </div> */}
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

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">Game Lobby</h1>

            <div className="lobby-details">{playersList}</div>

            <div className="lobby-buttons">
                <button
                    onClick={handleStartGame}
                    className="lobby-button start-game-button"
                    disabled={!isLobbyFull}
                >
                    Start
                </button>
                <button
                    onClick={handleLeaveLobby}
                    className="lobby-button leave-lobby-button"
                >
                    Leave
                </button>
            </div>

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
                    <div className="chat-input-container">
                        <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        />
                        <button
                        className="send-btn"
                        onClick={handleSendMessage}
                        disabled={!message.trim()}
                        >
                        <IoIosSend size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LobbyPage;
