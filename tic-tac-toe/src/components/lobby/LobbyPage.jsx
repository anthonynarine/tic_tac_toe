// # Filename: src/components/lobby/LobbyPage.jsx
// ✅ New Code

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";

import { showToast } from "../../utils/toast/Toast";

import getWebSocketURL from "../websocket/getWebsocketURL";
import { CiCirclePlus } from "react-icons/ci";
import { IoIosSend } from "react-icons/io";
import "./lobby.css";

import { getToken } from "../auth/tokenStore";

/**
 * LobbyPage
 *
 * Supports two valid lobby entry modes:
 * - Host joins with ?sessionKey=...
 * - Invitee joins with ?invite=...
 *
 * WebSocket join guard expects ONE of these.
 */
const LobbyPage = () => {
  const { state, dispatch: lobbyDispatch } = useLobbyContext();
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);

  const chatContainerRef = useRef(null);

  const MAX_PLAYERS = 2;
  const isLobbyFull = state.players.length === MAX_PLAYERS;

  // # Step 1: Read URL params (invite OR sessionKey)
  const inviteId = useMemo(() => {
    return new URLSearchParams(location.search).get("invite");
  }, [location.search]);

  const sessionKey = useMemo(() => {
    return new URLSearchParams(location.search).get("sessionKey");
  }, [location.search]);

  // # Step 2: Handle WS messages (stable callback)
  const handleWebSocketMessage = useCallback(
    (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("[Lobby] Invalid JSON:", err);
        return;
      }

      const actions = {
        chat_message: () =>
          lobbyDispatch({ type: "ADD_MESSAGE", payload: data.message }),
        update_player_list: () =>
          lobbyDispatch({ type: "PLAYER_LIST", payload: data.players }),
        game_start_acknowledgment: () => {
          // # Step 1: Preserve join context when navigating into /games/:id
          const params = new URLSearchParams();

          if (inviteId) params.set("invite", inviteId);
          if (sessionKey) params.set("sessionKey", sessionKey);

          // # Step 2: Always include lobby id for GamePage redirect logic
          params.set("lobby", String(gameId));

          navigate(`/games/${data.game_id}?${params.toString()}`);
        },
        error: () => showToast("error", data.message || "An error occurred."),
      };

      const action = actions[data.type];
      if (action) action();
      else console.warn(`[Lobby] Unhandled WS type: ${data.type}`);
    },
    [gameId, inviteId, sessionKey, lobbyDispatch, navigate]
  );

  /**
   * Establish WebSocket connection for the lobby.
   *
   * ✅ Connect if EITHER inviteId or sessionKey exists.
   * ✅ Pass inviteId/sessionKey into WS URL builder.
   */
  useEffect(() => {
    const token = getToken("access_token");

    if (!token) {
      console.error("[Lobby] Access token missing. Cannot connect.");
      return () => {};
    }

    // # Step 1: Require lobby access context
    if (!inviteId && !sessionKey) {
      showToast(
        "error",
        "Missing lobby access. Please re-enter from Home or an Invite."
      );
      navigate("/", { replace: true });
      return () => {};
    }

    // # Step 2: Close any previous socket before opening a new one
    if (socket) {
      try {
        socket.close();
      } catch (err) {
        console.warn("[Lobby] Failed closing previous socket:", err);
      }
    }

    // # Step 3: Build WS URL with invite OR sessionKey
    const wsUrl = getWebSocketURL({
      id: gameId,
      token,
      isLobby: true,
      inviteId: inviteId || null,
      sessionKey: sessionKey || null,
    });

    console.log("[Lobby] WS connecting:", wsUrl);

    const webSocket = new WebSocket(wsUrl);

    webSocket.onopen = () => console.log("[Lobby] WebSocket connected.");
    webSocket.onmessage = handleWebSocketMessage;
    webSocket.onclose = (e) =>
      console.log("[Lobby] WebSocket disconnected.", e?.code);
    webSocket.onerror = (error) =>
      console.error("[Lobby] WebSocket encountered an error:", error);

    setSocket(webSocket);

    // # Step 4: Cleanup on unmount/param change
    return () => {
      console.log("[Lobby] Cleaning up WebSocket connection...");
      try {
        webSocket.close();
      } catch (err) {
        console.warn("[Lobby] Cleanup close error:", err);
      }
    };
    // ✅ sessionKey must be in deps, or host flow never reconnects correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, inviteId, sessionKey, navigate, handleWebSocketMessage]);

  // # Step 3: Send chat message
  const handleSendMessage = useCallback(() => {
    if (!message.trim() || !socket) return;

    socket.send(
      JSON.stringify({
        type: "chat_message",
        message,
      })
    );
    setMessage("");
  }, [message, socket]);

  // # Step 4: Start game
  const handleStartGame = useCallback(() => {
    if (!isLobbyFull) {
      showToast("error", "You need at least 2 players to start the game.");
      return;
    }

    socket?.send(JSON.stringify({ type: "start_game" }));
  }, [isLobbyFull, socket]);

  // # Step 5: Leave lobby
  const handleLeaveLobby = useCallback(() => {
    socket?.send(JSON.stringify({ type: "leave_lobby" }));
    navigate("/");
  }, [navigate, socket]);

  // # Step 6: Copy invite link (preserve current query string)
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(
      `${window.location.origin}/lobby/${gameId}${location.search}`
    );
    showToast("success", "Invite link copied to clipboard!");
  }, [gameId, location.search]);

  // # Step 7: Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [state.messages]);

  // # Step 8: Render players list
  const playersList = useMemo(() => {
    return (
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
    );
  }, [state.players, handleCopyLink]);

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
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
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
