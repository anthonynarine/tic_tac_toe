import { useReducer, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { findWin } from "../utils/c4Logic";
import config from "../../../config";
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken";
import { connectFourApi } from "../../../api/connectFourApi";
import { showToast } from "../../../utils/toast/Toast";

const INITIAL = {
  board: null,
  currentTurn: null,
  winner: null,
  winCells: null,
  isCompleted: false,
  myPiece: null,
  playerOneName: "Player 1",
  playerTwoName: "Player 2",
  rematchMessage: "",
  rematchShowActions: false,
  rematchPending: false,
  rematchButtonLocked: false,
  status: "loading",   // loading | waiting | playing | won | draw | error
  errorMsg: null,
  wsStatus: "disconnected",
};

function boardFromStr(str) {
  return Array.from(str).map(Number);
}

function reducer(state, action) {
  switch (action.type) {
    case "GAME_LOADED": {
      const { game, myPiece } = action;
      const board = boardFromStr(game.board);
      const hasP2 = Boolean(game.player_two_name);
      const status = game.is_completed
        ? game.winner === 0 ? "draw" : "won"
        : hasP2 ? "playing" : "waiting";
      const winCells =
        game.winner && game.winner !== 0
          ? findWin(board, game.winner)
          : null;
      return {
        ...state,
        board,
        currentTurn: game.current_turn,
        winner: game.winner ?? null,
        winCells,
        isCompleted: game.is_completed,
        myPiece: myPiece ?? state.myPiece,
        playerOneName: game.player_one_name || "Player 1",
        playerTwoName: game.player_two_name || "Player 2",
        status,
      };
    }
    case "GAME_UPDATE": {
      const { board: boardStr, current_turn, winner, is_completed, my_piece } = action;
      const board = boardFromStr(boardStr);
      const status = is_completed
        ? winner === 0 ? "draw" : "won"
        : "playing";
      const winCells =
        winner && winner !== 0 ? findWin(board, winner) : null;
      return {
        ...state,
        board,
        currentTurn: current_turn,
        winner: winner ?? null,
        winCells,
        isCompleted: is_completed,
        myPiece: my_piece ?? state.myPiece,
        status,
      };
    }
    case "WS_STATUS":
      return { ...state, wsStatus: action.wsStatus };
    case "OPPONENT_JOINED":
      return { ...state, status: "playing" };
    case "REMATCH_OFFER":
      return {
        ...state,
        rematchMessage: action.message || "Rematch requested.",
        rematchShowActions: Boolean(action.showActions),
        rematchPending: action.rematchPending ?? true,
        rematchButtonLocked: false,
      };
    case "REMATCH_CLEAR":
      return {
        ...state,
        rematchMessage: "",
        rematchShowActions: false,
        rematchPending: false,
        rematchButtonLocked: false,
      };
    case "REMATCH_LOCK":
      return { ...state, rematchButtonLocked: true };
    case "REMATCH_UNLOCK":
      return { ...state, rematchButtonLocked: false };
    case "ERROR":
      return { ...state, status: "error", errorMsg: action.msg };
    default:
      return state;
  }
}

export function useConnectFourMP(gameId) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const wsRef = useRef(null);
  const mountedRef = useRef(true);

  // Load initial game state via REST
  useEffect(() => {
    if (!gameId) return;
    connectFourApi.getGame(gameId)
      .then((game) => {
        if (!mountedRef.current) return;
        dispatch({ type: "GAME_LOADED", game, myPiece: game.my_piece });
      })
      .catch(() => dispatch({ type: "ERROR", msg: "Failed to load game." }));
  }, [gameId]);

  // Connect WebSocket
  useEffect(() => {
    if (!gameId) return;
    mountedRef.current = true;

    let ws = null;

    const connect = async () => {
      const token = await ensureFreshAccessToken({ minTtlSeconds: 60 });
      if (!token || !mountedRef.current) return;

      const base = String(config.websocketBaseUrl || "").replace(/\/+$/, "");
      const url = `${base}/c4/${gameId}/?token=${token}`;

      ws = new WebSocket(url);
      wsRef.current = ws;
      dispatch({ type: "WS_STATUS", wsStatus: "connecting" });

      ws.onopen = () => {
        if (!mountedRef.current) return;
        dispatch({ type: "WS_STATUS", wsStatus: "connected" });
      };

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "game_state") {
            dispatch({ type: "GAME_LOADED", game: data.game, myPiece: data.my_piece });
          } else if (data.type === "game_update") {
            dispatch({ type: "GAME_UPDATE", ...data });
            // detect opponent joining (board still empty but now has two pieces defined)
            if (!data.is_completed && data.current_turn) {
              dispatch({ type: "OPPONENT_JOINED" });
            }
          } else if (data.type === "error") {
            showToast("error", data.message || "Move failed.");
          } else if (data.type === "rematch_offer") {
            dispatch({
              type: "REMATCH_OFFER",
              message: data.message,
              showActions: data.showActions,
              rematchPending: data.rematchPending,
            });
          } else if (data.type === "rematch_declined") {
            dispatch({ type: "REMATCH_CLEAR" });
            showToast("info", data.message || "Rematch declined.");
          } else if (data.type === "rematch_start") {
            dispatch({ type: "REMATCH_CLEAR" });
            const nextId = data.new_game_id || data.newGameId;
            if (!nextId) {
              showToast("error", "Rematch failed: missing game id.");
              return;
            }
            navigate(`/games/connect-four/${nextId}`);
          }
        } catch {
          // Ignore malformed socket messages.
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        dispatch({ type: "WS_STATUS", wsStatus: "disconnected" });
      };

      ws.onerror = () => {
        dispatch({ type: "WS_STATUS", wsStatus: "disconnected" });
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [gameId, navigate]);

  // Keep both boards fresh if a socket event is missed or the socket is still
  // reconnecting. REST remains the authoritative source of game state.
  useEffect(() => {
    if (!gameId || state.isCompleted || state.status === "error") return undefined;

    const syncGame = () => {
      connectFourApi.getGame(gameId)
        .then((game) => {
          if (!mountedRef.current) return;
          dispatch({ type: "GAME_LOADED", game, myPiece: game.my_piece });
        })
        .catch(() => {
          // Avoid turning a live game into an error state for a transient poll miss.
        });
    };

    const id = window.setInterval(syncGame, 1500);
    return () => window.clearInterval(id);
  }, [gameId, state.isCompleted, state.status]);

  const sendMove = useCallback(
    (col) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "move", col }));
        return true;
      }
      return false;
    },
    []
  );

  const dropColumn = useCallback(
    async (col) => {
      if (state.status !== "playing") return;
      if (state.currentTurn !== state.myPiece) return;

      const sentViaSocket = sendMove(col);
      if (sentViaSocket) return;

      try {
        const game = await connectFourApi.makeMove(gameId, col);
        dispatch({ type: "GAME_LOADED", game, myPiece: game.my_piece });
        showToast("info", "Reconnected move through REST.");
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          "Move failed.";
        showToast("error", String(msg));
      }
    },
    [gameId, state, sendMove]
  );

  const sendSocketMessage = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast("error", "Game socket not connected yet.");
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const requestRematch = useCallback(() => {
    dispatch({ type: "REMATCH_LOCK" });
    if (!sendSocketMessage({ type: "rematch_request" })) {
      dispatch({ type: "REMATCH_UNLOCK" });
    }
  }, [sendSocketMessage]);

  const acceptRematch = useCallback(() => {
    dispatch({ type: "REMATCH_LOCK" });
    if (!sendSocketMessage({ type: "rematch_accept" })) {
      dispatch({ type: "REMATCH_UNLOCK" });
    }
  }, [sendSocketMessage]);

  const declineRematch = useCallback(() => {
    dispatch({ type: "REMATCH_LOCK" });
    if (!sendSocketMessage({ type: "rematch_decline" })) {
      dispatch({ type: "REMATCH_UNLOCK" });
    }
  }, [sendSocketMessage]);

  return { state, dropColumn, requestRematch, acceptRematch, declineRematch };
}
