import { useReducer, useEffect, useRef, useCallback } from "react";
import { findWin, PIECE } from "../utils/c4Logic";
import config from "../../../config";
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken";
import { connectFourApi } from "../../../api/connectFourApi";

const INITIAL = {
  board: null,
  currentTurn: null,
  winner: null,
  winCells: null,
  isCompleted: false,
  myPiece: null,
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
    case "ERROR":
      return { ...state, status: "error", errorMsg: action.msg };
    default:
      return state;
  }
}

export function useConnectFourMP(gameId) {
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
          }
        } catch {}
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
  }, [gameId]);

  const sendMove = useCallback(
    (col) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "move", col }));
      }
    },
    []
  );

  const dropColumn = useCallback(
    (col) => {
      if (state.status !== "playing") return;
      if (state.currentTurn !== state.myPiece) return;
      sendMove(col);
    },
    [state, sendMove]
  );

  return { state, dropColumn };
}
