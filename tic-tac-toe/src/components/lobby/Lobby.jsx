// # Filename: src/components/lobby/Lobby.jsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { useGameContext } from "../context/gameContext";
import { useUserContext } from "../context/userContext";
import { showToast } from "../../utils/toast/Toast";
import { CiCirclePlus } from "react-icons/ci";
import "./lobby.css";
import config from "../../config";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";
import { buildInviteGameUrl } from "../../invites/InviteNavigation";

/**
 * Lobby Component
 *
 * Handles game lobby functionality, including WebSocket connection, chat, player management,
 * and initiating the game.
 *
 * Invite v2:
 * - Lobby WS connections must include ?invite=<invite_uuid>
 * - Backend validates invite before accepting the connection
 */
const Lobby = () => {
  // Step 1: Contexts
  const { user } = useUserContext();
  const { state, dispatch: lobbyDispatch } = useLobbyContext();
  const { dispatch: gameDispatch } = useGameContext();

  // Step 2: Router hooks
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Step 3: Read inviteId from URL query string (e.g. /lobby/:id?invite=<uuid>)
  const inviteId = useMemo(() => {
    return new URLSearchParams(location.search).get("invite");
  }, [location.search]);

  // Step 4: Local state
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const chatContainerRef = useRef(null);

  // Step 5: Join guard UX state (invalid/expired invite, wrong user, etc.)
  const [joinError, setJoinError] = useState(null);
  // joinError shape: { title: string, detail: string, code?: number }

  // Step 6: Keep socket + timers in refs for stable cleanup/reconnect
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const authRetryAttemptRef = useRef(false);

  // Step 7: Constants
  const MAX_PLAYERS = 2;
  const isLobbyFull = state.players.length === MAX_PLAYERS;

  const MAX_RECONNECT_ATTEMPTS = 6;
  const BASE_DELAY_MS = 750;
  const MAX_DELAY_MS = 8000;

  // Step 9: Detect auth-like close codes (handshake rejection often shows as 1006)
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    if (code === 4401) return true;
    if (code === 1006) return true;
    return false;
  };

  // Step 10: Detect invite-guard close codes (server-authoritative rejections)
  const isInviteGuardClose = (event) => {
    const code = Number(event?.code);

    // Step 1: Prefer explicit invite guard close codes from backend
    // 4403 = forbidden (wrong user), 4404 = not found/invalid, 4408 = expired/policy
    if ([4403, 4404, 4408].includes(code)) return true;

    // Step 2: If inviteId is missing, treat as guard failure (no reconnect thrash)
    if (!inviteId) return true;

    return false;
  };

  // Step 11: Convert close code into a user-friendly message
  const inviteGuardMessageFromClose = (event) => {
    const code = Number(event?.code);

    if (!inviteId) {
      return {
        title: "Invite required",
        detail:
          "This lobby requires a valid invite. Please accept the invite from Notifications.",
        code,
      };
    }

    if (code === 4408) {
      return {
        title: "Invite expired",
        detail:
          "This invite is no longer valid. Ask your friend to send a new one.",
        code,
      };
    }

    if (code === 4403) {
      return {
        title: "Not authorized",
        detail:
          "This invite doesn’t belong to your account. Make sure you’re logged into the correct user.",
        code,
      };
    }

    if (code === 4404) {
      return {
        title: "Invite invalid",
        detail: "This invite could not be found or is no longer valid.",
        code,
      };
    }

    return {
      title: "Invite no longer valid",
      detail: "This lobby cannot be joined with the current invite.",
      code,
    };
  };

  // Step 12: Cleanup socket + timers safely
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

  // Step 13: Handles WebSocket messages
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
    if (action) action();
    else console.warn(`Unhandled WebSocket message type: ${data.type}`);
  };

    // Step 14: Handles game start acknowledgment message
    const handleGameStartAcknowledgment = (data) => {
      gameDispatch({
        type: "SET_GAME",
        payload: {
          game_id: data.game_id,
          current_turn: data.current_turn,
          board_state: "_________",
          winner: null,
        },
      });

      // Step 1: Always derive inviteId live (avoid stale closure)
      const liveInviteId = new URLSearchParams(window.location.search).get("invite");

      // Step 2: Persist as fallback (optional)
      if (liveInviteId) {
        sessionStorage.setItem(`invite:${data.game_id}`, String(liveInviteId));
      }

      // Step 3: IMPORTANT: preserve lobby id so the game WS can validate properly
      // lobbyId is the current route param `gameId` (lobby route id)
      const nextUrl = liveInviteId
        ? buildInviteGameUrl({
            gameId: data.game_id,
            inviteId: liveInviteId,
            lobbyId: gameId,
          })
        : `/games/${data.game_id}?lobby=${encodeURIComponent(String(gameId))}`;

      navigate(nextUrl);
    };

  // Step 15: Handles game update message
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

 
    // Step 2: NEVER navigate on game_update (gameplay). This can strip ?invite= and break WS reconnects.
  };

  // Step 16: Connect WS with refresh-before-connect + controlled reconnect
  const connectLobbySocket = async ({ forceRefresh = false } = {}) => {
    if (!gameId) return;

    // Step 1: Close any existing socket (don’t reset counters here)
    cleanupSocket();

    // Step 2: Clear join error on a fresh attempt
    setJoinError(null);

    // Step 3: Ensure a fresh access token for handshake
    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      showToast("error", "You must be logged in to join the lobby.");
      navigate("/login");
      return;
    }

    // Step 4: Invite v2 join guard requires inviteId
    const qs = new URLSearchParams({
      token: encodeURIComponent(String(token)),
    });

    if (inviteId) {
      qs.set("invite", String(inviteId));
    }

    // Step 5: Build URL from config (no hardcoded localhost)
    const wsUrl = `${config.websocketBaseUrl}/lobby/${gameId}/?${qs.toString()}`;

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

      // Step 6: Invite guard failure → stop reconnect + show clean UI
      if (isInviteGuardClose(event)) {
        const msg = inviteGuardMessageFromClose(event);
        setJoinError(msg);

        // Stop reconnect thrash entirely
        reconnectAttemptRef.current = MAX_RECONNECT_ATTEMPTS + 1;

        showToast("error", msg.title);
        cleanupSocket();
        return;
      }

      // Step 7: Auth-like close? Try ONE forced refresh reconnect
      if (isAuthLikeClose(event) && !authRetryAttemptRef.current) {
        authRetryAttemptRef.current = true;

        reconnectTimerRef.current = setTimeout(async () => {
          await connectLobbySocket({ forceRefresh: true });
        }, 250);

        return;
      }

      // Step 8: Controlled backoff reconnect (prevents infinite thrash)
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

  // Step 17: Establish WebSocket connection for the lobby.
  useEffect(() => {
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectLobbySocket({ forceRefresh: false });

    return () => {
      console.log("Cleaning up WebSocket connection...");
      cleanupSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, inviteId]);

  // Step 18: Handles sending chat messages.
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

  // Step 19: Handles starting the game.
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

  // Step 20: Handles leaving the lobby.
  const handleLeaveLobby = () => {
    socketRef.current?.send(
      JSON.stringify({
        type: "leave_lobby",
      })
    );
    navigate("/");
  };

  // Step 21: Copies the lobby invite link to the clipboard.
  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${location.pathname}${location.search}`;
    navigator.clipboard.writeText(fullUrl);
    showToast("success", "Invite link copied to clipboard!");
  };

  // Step 22: Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [state.messages]);

  // Step 23: Render players list
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

  // Step 24: Join guard UX
  if (joinError) {
    return (
      <div className="lobby-container">
        <h1 className="lobby-title">Game Lobby</h1>

        <div className="lobby-error-panel">
          <h2>{joinError.title}</h2>
          <p>{joinError.detail}</p>

          <div className="lobby-error-actions">
            <button
              className="lobby-button leave-lobby-button"
              onClick={() => navigate("/")}
            >
              Back Home
            </button>
          </div>

          {typeof joinError.code === "number" && (
            <div className="lobby-error-code">Code: {joinError.code}</div>
          )}
        </div>
      </div>
    );
  }

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
