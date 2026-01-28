// # Filename: src/components/lobby/Lobby.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CiCirclePlus } from "react-icons/ci";

import { useUserContext } from "../context/userContext";
import { useLobbyContext } from "../context/lobbyContext";
import { useGameContext } from "../context/gameContext";

import { showToast } from "../../utils/toast/Toast";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";
import { buildInviteGameUrl } from "../../invites/InviteNavigation";
import getWebSocketURL from "../websocket/getWebsocketURL";

const Lobby = () => {
  // Step 1: Context + router
  const { user } = useUserContext();
  const { state, dispatch: lobbyDispatch } = useLobbyContext();
  const { dispatch: gameDispatch } = useGameContext();

  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Step 2: Query params
  const inviteId = useMemo(
    () => new URLSearchParams(location.search).get("invite"),
    [location.search]
  );

  const sessionKey = useMemo(
    () => new URLSearchParams(location.search).get("sessionKey"),
    [location.search]
  );

  // Step 3: Local UI state
  const [message, setMessage] = useState("");
  const [joinError, setJoinError] = useState(null);

  // Step 4: Socket refs
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const authRetryAttemptRef = useRef(false);
  const chatContainerRef = useRef(null);

  // Step 5: Constants
  const MAX_PLAYERS = 2;
  const isLobbyFull = (state?.players || []).length === MAX_PLAYERS;

  const MAX_RECONNECT_ATTEMPTS = 6;
  const BASE_DELAY_MS = 750;
  const MAX_DELAY_MS = 8000;

  // Step 6: Cleanup
  const cleanupSocket = useCallback(() => {
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
  }, []);

  // Step 7: Game update
  const handleGameUpdate = useCallback(
    (data) => {
      if (!data?.board_state || !data?.current_turn) {
        showToast("error", "Failed to update the game.");
        return;
      }

      const playerRole =
        user?.id === data?.player_x?.id
          ? "X"
          : user?.id === data?.player_o?.id
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
    },
    [gameDispatch, user?.id]
  );

  // Step 8: Start ack -> navigate to game route (preserve invite/sessionKey)
  const handleGameStartAcknowledgment = useCallback(
    (data) => {
      showToast("success", data?.message || "Game starting...");

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
      const liveSessionKey = new URLSearchParams(window.location.search).get(
        "sessionKey"
      );

      if (liveInviteId) {
        sessionStorage.setItem(`invite:${data.game_id}`, String(liveInviteId));
      }

      const nextUrl = liveInviteId
        ? buildInviteGameUrl({
            gameId: data.game_id,
            inviteId: liveInviteId,
            lobbyId: gameId,
          })
        : `/games/${data.game_id}?lobby=${encodeURIComponent(String(gameId))}${
            liveSessionKey
              ? `&sessionKey=${encodeURIComponent(String(liveSessionKey))}`
              : ""
          }`;

      navigate(nextUrl);
    },
    [gameDispatch, navigate, gameId]
  );

  // Step 9: Message router
  const handleWebSocketMessage = useCallback(
    (event) => {
      const data = JSON.parse(event.data);

      const actions = {
        session_established: () => {
          if (data?.sessionKey && data?.lobbyId) {
            sessionStorage.setItem(
              `sessionKey:${String(data.lobbyId)}`,
              String(data.sessionKey)
            );
          }
        },

        update_player_list: () => {
          lobbyDispatch({ type: "PLAYER_LIST", payload: data.players || [] });
        },

        player_list: () => {
          lobbyDispatch({ type: "PLAYER_LIST", payload: data.players || [] });
        },

        chat_message: () => {
          lobbyDispatch({ type: "ADD_MESSAGE", payload: data.message });
        },

        game_start_acknowledgment: () => handleGameStartAcknowledgment(data),

        game_update: () => handleGameUpdate(data),

        error: () => {
          showToast("error", data?.message || "An error occurred.");
        },
      };

      const action = actions[data.type];
      if (action) action();
    },
    [handleGameStartAcknowledgment, handleGameUpdate, lobbyDispatch]
  );

  // Step 10: Connect WS
  const connectLobbySocket = useCallback(
    async ({ forceRefresh = false } = {}) => {
      if (!gameId) return;

      // Step 1: reset errors + cleanup old socket
      setJoinError(null);
      cleanupSocket();

      // Step 2: Client-side guard (host must have sessionKey, invitee must have invite)
      if (!inviteId && !sessionKey) {
        const msg = {
          title: "Invite or session required",
          detail:
            "Hosts must enter via Home (sessionKey). Invitees must join from an invite link.",
          code: 0,
        };
        setJoinError(msg);
        showToast("error", msg.title);
        return;
      }

      // Step 3: Fresh token
      const token = await ensureFreshAccessToken({
        minTtlSeconds: forceRefresh ? 999999999 : 60,
      });

      if (!token) {
        showToast("error", "You must be logged in to join the lobby.");
        navigate("/login");
        return;
      }

      // Step 4: Build WS url (backend: /ws/game/<id>/)
      const wsUrl = getWebSocketURL({
        id: gameId,
        token,
        isLobby: true,
        inviteId: inviteId || null,
        sessionKey: !inviteId ? sessionKey || null : null,
        lobbyId: gameId,
      });

      console.log("[Lobby] WS connecting:", wsUrl);

      const webSocket = new WebSocket(wsUrl);
      socketRef.current = webSocket;

      webSocket.onopen = () => {
        console.log("[Lobby] WebSocket connected.");
        reconnectAttemptRef.current = 0;
        authRetryAttemptRef.current = false;

        // ✅ IMPORTANT: send nothing on open
        // join_lobby and update_user_list both cause 4003 in your backend router.
      };

      webSocket.onmessage = handleWebSocketMessage;

      webSocket.onerror = (error) => {
        console.error("[Lobby] WebSocket encountered an error:", error);
      };

      webSocket.onclose = (event) => {
        console.log("[Lobby] WebSocket disconnected.", event?.code);

        const code = Number(event?.code);

        // Step 5: invalid payload / message type -> stop (don’t loop)
        if (code === 4003) {
          showToast("error", "Lobby socket closed: invalid message type/payload.");
          return;
        }

        // Step 6: auth close -> refresh once
        if (code === 4401 && !authRetryAttemptRef.current) {
          authRetryAttemptRef.current = true;
          reconnectTimerRef.current = setTimeout(async () => {
            await connectLobbySocket({ forceRefresh: true });
          }, 250);
          return;
        }

        // Step 7: backoff reconnect
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
    },
    [
      BASE_DELAY_MS,
      MAX_DELAY_MS,
      MAX_RECONNECT_ATTEMPTS,
      cleanupSocket,
      gameId,
      handleWebSocketMessage,
      inviteId,
      navigate,
      sessionKey,
    ]
  );

  // Step 11: Mount/unmount WS by route
  useEffect(() => {
    reconnectAttemptRef.current = 0;
    authRetryAttemptRef.current = false;

    connectLobbySocket({ forceRefresh: false });

    return () => {
      cleanupSocket();
    };
  }, [connectLobbySocket, cleanupSocket, gameId, inviteId, sessionKey]);

  // Step 12: Send chat message
  const handleSendMessage = () => {
    const ws = socketRef.current;
    if (!message.trim()) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast("error", "Lobby socket is not connected.");
      return;
    }

    ws.send(JSON.stringify({ type: "chat_message", message }));
    setMessage("");
  };

  // Step 13: Start game
  const handleStartGame = () => {
    if (!isLobbyFull) {
      showToast("error", "You need 2 players to start the game.");
      return;
    }

    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast("error", "Lobby socket is not connected.");
      return;
    }

    ws.send(JSON.stringify({ type: "start_game" }));
  };

  // Step 14: Leave lobby
  const handleLeaveLobby = () => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "leave_lobby" }));
    }
    navigate("/");
  };

  // Step 15: Copy lobby link (preserve query string)
  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/lobby/${gameId}${location.search}`
    );
    showToast("success", "Invite link copied to clipboard!");
  };

  // Step 16: Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [state?.messages]);

  // Step 17: Render players list
  const renderPlayersList = useMemo(() => {
    const players = state?.players || [];

    return (
      <div className="players-list">
        {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
          const player = players[index];

          return (
            <div key={index} className="player-slot">
              {player ? (
                <div className="player-details">
                  <div className="player-avatar">
                    {player?.first_name?.charAt(0)?.toUpperCase?.() || "?"}
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
  }, [MAX_PLAYERS, handleCopyLink, state?.players]);

  return (
    <div className="lobby-container">
      {/* Step 18: Join error banner */}
      {joinError ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200/80">
          <div className="font-semibold">{joinError.title}</div>
          <div className="mt-1 text-sm text-red-200/70">{joinError.detail}</div>
        </div>
      ) : null}

      <h2 className="lobby-title">Lobby</h2>

      <div className="lobby-content">
        <div className="players-section">{renderPlayersList}</div>

        <div className="chat-section">
          <div className="chat-messages" ref={chatContainerRef}>
            {(state?.messages || []).map((msg, idx) => (
              <div key={idx} className="chat-message">
                <strong>{msg?.username || "User"}:</strong> {msg?.message || ""}
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
