// # Filename: src/components/lobby/Lobby.jsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useLobbyContext } from "../context/lobbyContext";
import { useGameContext } from "../context/gameContext";
import { useUserContext } from "../context/userContext";
import { showToast } from "../../utils/toast/Toast";
import { CiCirclePlus } from "react-icons/ci";
import config from "../../config";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";
import { buildInviteGameUrl } from "../../invites/InviteNavigation";

/**
 * Lobby Component
 *
 * Invite v2:
 * - Invitee joins with ?invite=<invite_uuid>
 * - Host joins with ?sessionKey=<session_key>
 *
 * WS contract:
 * - /ws/lobby/<lobbyId>/?token=<jwt>&invite=<uuid>
 * - /ws/lobby/<lobbyId>/?token=<jwt>&sessionKey=<sessionKey>
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

  // Step 3: URL params
  const inviteId = useMemo(() => {
    return new URLSearchParams(location.search).get("invite");
  }, [location.search]);

  const sessionKey = useMemo(() => {
    return new URLSearchParams(location.search).get("sessionKey");
  }, [location.search]);

  // Step 4: Local state
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const chatContainerRef = useRef(null);

  // Step 5: Join guard UX state
  const [joinError, setJoinError] = useState(null);

  // Step 6: Keep socket + timers in refs
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

  // Step 8: Auth-like close detection
  const isAuthLikeClose = (event) => {
    const code = Number(event?.code);
    return code === 4401 || code === 1006;
  };

  // ✅ New Code
  // Step 9: Invite/session join guard close detection
  const isJoinGuardClose = (event) => {
    const code = Number(event?.code);

    // Step 1: Prefer explicit server close codes
    if ([4403, 4404, 4408].includes(code)) return true;

    // Step 2: If neither invite nor sessionKey is present, treat as guard failure
    if (!inviteId && !sessionKey) return true;

    return false;
  };

  // ✅ New Code
  // Step 10: Close -> user friendly
  const joinGuardMessageFromClose = (event) => {
    const code = Number(event?.code);

    if (!inviteId && !sessionKey) {
      return {
        title: "Invite or session required",
        detail:
          "Hosts must enter via Home (session). Invitees must accept an invite from Notifications.",
        code,
      };
    }

    if (code === 4408) {
      return {
        title: "Invite expired",
        detail: "This invite is no longer valid. Ask your friend to send a new one.",
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
      title: "Unable to join lobby",
      detail: "This lobby cannot be joined with the current link.",
      code,
    };
  };

  // Step 11: Cleanup socket + timers
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

  // Step 12: Message router
  const handleWebSocketMessage = (event) => {
    const data = JSON.parse(event.data);

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
  };

  // ✅ New Code
  // Step 13: Game start ack -> route to live game (preserve invite/sessionKey)
  const handleGameStartAcknowledgment = (data) => {
    showToast("success", data.message);

    gameDispatch({
      type: "SET_GAME",
      payload: {
        game_id: data.game_id,
        current_turn: data.current_turn,
        board_state: "_________",
        winner: null,
      },
    });

    const liveInviteId = new URLSearchParams(window.location.search).get("invite");
    const liveSessionKey = new URLSearchParams(window.location.search).get("sessionKey");

    if (liveInviteId) {
      sessionStorage.setItem(`invite:${data.game_id}`, String(liveInviteId));
    }

    const nextUrl = liveInviteId
      ? buildInviteGameUrl({
          gameId: data.game_id,
          inviteId: liveInviteId,
          lobbyId: gameId,
        })
      : `/games/${data.game_id}?lobby=${encodeURIComponent(
          String(gameId)
        )}${liveSessionKey ? `&sessionKey=${encodeURIComponent(liveSessionKey)}` : ""}`;

    navigate(nextUrl);
  };

  // Step 14: Game update
  const handleGameUpdate = (data) => {
    if (!data.board_state || !data.current_turn) {
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
  };

  // ✅ New Code
  // Step 15: Connect WS with invite/sessionKey + refresh-before-connect + controlled reconnect
  const connectLobbySocket = async ({ forceRefresh = false } = {}) => {
    if (!gameId) return;

    // Step 1: Clear any previous join error on new attempts
    setJoinError(null);

    // Step 2: Close any existing socket
    cleanupSocket();

    // Step 3: Ensure a fresh access token for handshake
    const token = await ensureFreshAccessToken({
      minTtlSeconds: forceRefresh ? 999999999 : 60,
    });

    if (!token) {
      showToast("error", "You must be logged in to join the lobby.");
      navigate("/login");
      return;
    }

    // Step 4: Join guard on client side (don’t even attempt WS if missing both)
    if (!inviteId && !sessionKey) {
      const msg = {
        title: "Invite or session required",
        detail:
          "Hosts must enter via Home (session). Invitees must accept an invite from Notifications.",
        code: 0,
      };
      setJoinError(msg);
      showToast("error", msg.title);
      return;
    }

    // Step 5: Build URL from config + include invite OR sessionKey
    const qs = new URLSearchParams();
    qs.set("token", token);

    if (inviteId) qs.set("invite", inviteId);
    if (!inviteId && sessionKey) qs.set("sessionKey", sessionKey);

    const wsUrl = `${config.websocketBaseUrl}/lobby/${gameId}/?${qs.toString()}`;

    console.log("[Lobby] WS connecting:", wsUrl);

    const webSocket = new WebSocket(wsUrl);

    socketRef.current = webSocket;
    setSocket(webSocket);

    webSocket.onopen = () => {
      console.log("[Lobby] WebSocket connected.");
      reconnectAttemptRef.current = 0;
      authRetryAttemptRef.current = false;
    };

    webSocket.onmessage = (event) => handleWebSocketMessage(event);

    webSocket.onerror = (error) => {
      console.error("[Lobby] WebSocket encountered an error:", error);
    };

    webSocket.onclose = (event) => {
      console.log("[Lobby] WebSocket disconnected.", event?.code);

      // Step 6: Join guard closes should NOT reconnect
      if (isJoinGuardClose(event)) {
        const msg = joinGuardMessageFromClose(event);
        setJoinError(msg);
        showToast("error", msg.title);
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

      // Step 8: Controlled backoff reconnect
      reconnectAttemptRef.current += 1;

      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        console.warn(
          `[Lobby] WS: max reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}).`
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

  // Step 16: Establish WebSocket connection for the lobby.
  useEffect(() => {
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectLobbySocket({ forceRefresh: false });

    return () => {
      cleanupSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, inviteId, sessionKey]);

  // Step 17: Handles sending chat messages.
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

  // Step 18: Handles starting the game.
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

  // Step 19: Handles leaving the lobby.
  const handleLeaveLobby = () => {
    socketRef.current?.send(
      JSON.stringify({
        type: "leave_lobby",
      })
    );
    navigate("/");
  };

  // Step 20: Copies the lobby invite link to the clipboard.
  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/lobby/${gameId}`);
    showToast("success", "Invite link copied to clipboard!");
  };

  // Step 21: Auto scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [state.messages]);

  // Step 22: Render players list
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
      {/* Step 23: Optional join error banner */}
      {joinError ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200/80">
          <div className="font-semibold">
            {joinError.title} {joinError.code ? `(code ${joinError.code})` : null}
          </div>
          <div className="mt-1 text-sm text-red-200/70">{joinError.detail}</div>
        </div>
      ) : null}

      <h2 className="lobby-title">Lobby</h2>

      <div className="lobby-content">
        <div className="players-section">{renderPlayersList}</div>

        <div className="chat-section">
          <div className="chat-messages" ref={chatContainerRef}>
            {state.messages.map((msg, idx) => (
              <div key={idx} className="chat-message">
                <strong>{msg.username}:</strong> {msg.message}
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <button type="button" onClick={handleSendMessage}>
              Send
            </button>
          </div>
        </div>

        <div className="lobby-actions">
          <button type="button" onClick={handleStartGame} disabled={!isLobbyFull}>
            Start Game
          </button>
          <button type="button" onClick={handleLeaveLobby}>
            Leave Lobby
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
