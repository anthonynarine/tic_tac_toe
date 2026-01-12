// # Filename: src/components/lobby/Lobby.jsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { useGameContext } from "../context/gameContext";
import { useUserContext } from "../context/userContext";
import { showToast } from "../../utils/toast/Toast";
import { CiCirclePlus } from "react-icons/ci";
import "./lobby.css";


// Step 1: Use websocketBaseUrl (no hardcoded localhost)
import config from "../../config";


// Step 2: Ensure WS connects with a fresh access token
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

/**
 * Lobby Component
 *
 * Handles game lobby functionality, including WebSocket connection, chat, player management,
 * and initiating the game.
 */
const Lobby = () => {
  // Contexts
  const { user } = useUserContext();
  const { state, dispatch: lobbyDispatch } = useLobbyContext();
  const { dispatch: gameDispatch } = useGameContext();

  // Hooks
  const { id: gameId } = useParams();
  const navigate = useNavigate();

  // State
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const chatContainerRef = useRef(null);


  // Step 3: Keep socket + timers in refs for stable cleanup/reconnect
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const authRetryAttemptRef = useRef(false);

  // Constants
  const MAX_PLAYERS = 2;
  const isLobbyFull = state.players.length === MAX_PLAYERS;

  const MAX_RECONNECT_ATTEMPTS = 6;
  const BASE_DELAY_MS = 750;
  const MAX_DELAY_MS = 8000;


  // Step 4: Detect auth-like close codes (handshake rejection often shows as 1006)
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    if (code === 4401) return true;
    if (code === 1006) return true;
    return false;
  };


  // Step 5: Cleanup socket + timers safely
  const cleanupSocket = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current) {
      try {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
      } catch (err) {
        // ignore
      }
      socketRef.current = null;
    }

    setSocket(null);
  };

  /**
   * Handles WebSocket messages.
   *
   * @param {Object} event - The WebSocket event containing the message data.
   */
  const handleWebSocketMessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("WebSocket message received:", data);

    const actions = {
      connection_success: () => showToast("success", data.message),
      chat_message: () =>
        lobbyDispatch({ type: "ADD_MESSAGE", payload: data.message }),
      player_list: () =>
        lobbyDispatch({ type: "PLAYER_LIST", payload: data.players }),
      game_start_acknowledgment: () => handleGameStartAcknowledgment(data),
      game_update: () => handleGameUpdate(data),
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
   * Handles game start acknowledgment message.
   *
   * @param {Object} data - WebSocket payload.
   */
  const handleGameStartAcknowledgment = (data) => {
    showToast("success", data.message);

    gameDispatch({
      type: "SET_GAME",
      payload: {
        game_id: data.game_id,
        current_turn: data.current_turn,
        board_state: "_________", // Empty board
        winner: null,
      },
    });

    navigate(`/games/${data.game_id}`);
  };

  /**
   * Handles game update message.
   *
   * @param {Object} data - WebSocket payload.
   */
  const handleGameUpdate = (data) => {
    console.log("Game update received:", data);

    if (!data.board_state || !data.current_turn) {
      console.error("Invalid game update data:", data);
      showToast("error", "Failed to update the game.");
      return;
    }

    const playerRole =
      user?.id === data.player_x?.id
        ? "X"
        : user?.id === data.player_o?.id
        ? "O"
        : "Spectator";

    gameDispatch({
      type: "SET_GAME",
      payload: {
        board_state: data.board_state,
        current_turn: data.current_turn,
        winner: data.winner,
        player_x: data.player_x || { id: null, first_name: "Waiting..." },
        player_o: data.player_o || { id: null, first_name: "Waiting..." },
        player_role: playerRole,
      },
    });

    navigate(`/games/${data.game_id}`);
  };

  // ✅ New Code
  // Step 6: Connect WS with refresh-before-connect + controlled reconnect
  const connectLobbySocket = async ({ forceRefresh = false } = {}) => {
    if (!gameId) return;

    // Step 1: Close any existing socket (don’t reset counters here)
    cleanupSocket();

    // Step 2: Ensure a fresh access token for handshake
    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      showToast("error", "You must be logged in to join the lobby.");
      navigate("/login");
      return;
    }

    // Step 3: Build URL from config (no hardcoded localhost)
    const wsUrl = `${config.websocketBaseUrl}/lobby/${gameId}/?token=${encodeURIComponent(
      token
    )}`;

    const webSocket = new WebSocket(wsUrl);

    socketRef.current = webSocket;
    setSocket(webSocket);

    webSocket.onopen = () => {
      console.log("WebSocket connected.");
      reconnectAttemptRef.current = 0;
      authRetryAttemptRef.current = false;
    };

    webSocket.onmessage = (event) => handleWebSocketMessage(event);

    webSocket.onerror = (error) => {
      console.error("WebSocket encountered an error:", error);
    };

    webSocket.onclose = (event) => {
      console.log("WebSocket disconnected.", event?.code);

      // Step 4: Auth-like close? Try ONE forced refresh reconnect
      if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
        authRetryAttemptRef.current = true;

        reconnectTimerRef.current = setTimeout(async () => {
          await connectLobbySocket({ forceRefresh: true });
        }, 250);

        return;
      }

      // Step 5: Controlled backoff reconnect (prevents infinite thrash)
      reconnectAttemptRef.current += 1;

      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.warn(
          `Lobby WS: max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}).`
        );
        return;
      }

      const backoff = Math.min(
        BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
        MAX_DELAY_MS
      );

      reconnectTimerRef.current = setTimeout(async () => {
        await connectLobbySocket({ forceRefresh: false });
      }, backoff);
    };
  };

  /**
   * Establish WebSocket connection for the lobby.
   */
  useEffect(() => {
    // Step 1: Reset guards per lobby mount/change
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectLobbySocket({ forceRefresh: false });

    return () => {
      console.log("Cleaning up WebSocket connection...");
      cleanupSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  /**
   * Handles sending chat messages.
   */
  const handleSendMessage = () => {
    const ws = socketRef.current;

    if (message.trim() && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "chat_message",
          message,
        })
      );
      setMessage("");
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

    socketRef.current?.send(
      JSON.stringify({
        type: "start_game",
      })
    );
  };

  /**
   * Handles leaving the lobby.
   */
  const handleLeaveLobby = () => {
    socketRef.current?.send(
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
  const renderPlayersList = useMemo(
    () => (
      <div className="players-list">
        {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
          const player = state.players[index];
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
    ),
    [state.players]
  );

  return (
    <div className="lobby-container">
      <h1 className="lobby-title">Game Lobby</h1>

      <div className="lobby-details">{renderPlayersList}</div>

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
          <button onClick={handleSendMessage} disabled={!socket}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
