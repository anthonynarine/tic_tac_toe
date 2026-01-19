// # Filename: src/components/lobby/LobbyPage.jsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";

import { showToast } from "../../utils/toast/Toast";

import getWebSocketURL from "../websocket/getWebsocketURL";
import { CiCirclePlus } from "react-icons/ci";
import { IoIosSend } from "react-icons/io";
import "./lobby.css";

import { getToken } from "../auth/tokenStore";

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


  const location = useLocation();

  // State
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const chatContainerRef = useRef(null);

  // Constants
  const MAX_PLAYERS = 2;
  const isLobbyFull = state.players.length === MAX_PLAYERS;


  // Step 1: Always treat invite as URL source of truth
  const inviteId = useMemo(() => {
    return new URLSearchParams(location.search).get("invite");
  }, [location.search]);

  /**
   * Establish WebSocket connection for the lobby.
   */
  // Step 2: Connect lobby WebSocket when gameId or inviteId changes
  useEffect(() => {
    const token = getToken("access_token");

    if (!token) {
      console.error("Access token not found. Cannot initialize WebSocket.");
      return () => {};
    }


    // Step 3: Invite v2 invariant: lobby ws must include invite
    if (!inviteId) {
      showToast("error", "Missing invite. Please re-enter from your Invite Panel.");
      navigate("/", { replace: true });
      return () => {};
    }

    const webSocket = new WebSocket(
      getWebSocketURL({ id: gameId, token, isLobby: true, inviteId })
    );

    webSocket.onopen = () => console.log("WebSocket connected.");
    webSocket.onmessage = (event) => handleWebSocketMessage(event);
    webSocket.onclose = () => console.log("WebSocket disconnected.");
    webSocket.onerror = (error) =>
      console.error("WebSocket encountered an error:", error);

    setSocket(webSocket);

    return () => {
      console.log("Cleaning up WebSocket connection...");
      webSocket.close();
    };

  }, [gameId, inviteId, navigate]);

  /**
   * Handles WebSocket messages.
   *
   * @param {Object} event - The WebSocket event containing the message data.
   */
  const handleWebSocketMessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("📥 WebSocket message received:", data);

    const actions = {
      chat_message: () =>
        lobbyDispatch({ type: "ADD_MESSAGE", payload: data.message }),
      update_player_list: () =>
        lobbyDispatch({ type: "PLAYER_LIST", payload: data.players }),
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
   * Handles the server confirmation the game started and navigates players to /games/:id
   * while preserving ?invite= (Invite v2 invariant).
   */
    const handleGameStartAcknowledgment = (data) => {
      console.log("🚀 WebSocket received game_start_acknowledgment:", data);
      // Step 1: Build query params (invite + lobby)
      const params = new URLSearchParams();

      if (inviteId) {
        params.set("invite", inviteId);
      }
      // Step 2: Always include the lobby id (current route param)
      // gameId here is the lobby route param from useParams()
      params.set("lobby", String(gameId));

      // Step 3: Navigate to the game route with full context
      navigate(`/games/${data.game_id}?${params.toString()}`);
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
   * Sends a ws request to the server to start the game.
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
   * ✅ Preserve invite in the link.
   */
  const handleCopyLink = () => {

    navigator.clipboard.writeText(
      `${window.location.origin}/lobby/${gameId}${location.search}`
    );
    showToast("success", "Invite link copied to clipboard!");
  };

  /**
   * Auto-scroll chat.
   */
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [state.messages]);

  /**
   * Renders players list.
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
