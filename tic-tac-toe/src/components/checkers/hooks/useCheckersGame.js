import { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";

import config from "../../../config";
import { checkersApi } from "../../../api/checkersApi";
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken";
import { showToast } from "../../../utils/toast/Toast";

const INITIAL = {
  game: null,
  myPiece: null,
  status: "loading",
  error: null,
  wsStatus: "disconnected",
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...state, game: action.game, myPiece: action.myPiece, status: "ready", error: null };
    case "ERROR":
      return { ...state, status: "error", error: action.error || "Failed to load game." };
    case "WS_STATUS":
      return { ...state, wsStatus: action.wsStatus };
    default:
      return state;
  }
}

export function useCheckersGame(gameId, { multiplayer = false } = {}) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const wsRef = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    if (!gameId) return;
    checkersApi.getGame(gameId)
      .then((game) => {
        if (!mountedRef.current) return;
        dispatch({ type: "LOAD", game, myPiece: game.my_piece });
      })
      .catch(() => dispatch({ type: "ERROR", error: "Failed to load checkers." }));
  }, [gameId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!multiplayer || !gameId) return undefined;
    mountedRef.current = true;
    let ws = null;

    const connect = async () => {
      const token = await ensureFreshAccessToken({ minTtlSeconds: 60 });
      if (!token || !mountedRef.current) return;

      const base = String(config.websocketBaseUrl || "").replace(/\/+$/, "");
      ws = new WebSocket(`${base}/checkers/${gameId}/?token=${token}`);
      wsRef.current = ws;
      dispatch({ type: "WS_STATUS", wsStatus: "connecting" });

      ws.onopen = () => dispatch({ type: "WS_STATUS", wsStatus: "connected" });
      ws.onclose = () => dispatch({ type: "WS_STATUS", wsStatus: "disconnected" });
      ws.onerror = () => dispatch({ type: "WS_STATUS", wsStatus: "disconnected" });
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "game_state" || data.type === "game_update") {
            dispatch({ type: "LOAD", game: data.game, myPiece: data.my_piece });
          } else if (data.type === "error") {
            showToast("error", data.message || "Move failed.");
          }
        } catch {
          // Ignore malformed socket messages.
        }
      };
    };

    connect();
    return () => {
      mountedRef.current = false;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [gameId, multiplayer]);

  const move = useCallback(
    async (from, to) => {
      if (!gameId) return;
      if (multiplayer && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "move", from, to }));
        return;
      }
      try {
        const game = await checkersApi.makeMove(gameId, from, to);
        dispatch({ type: "LOAD", game, myPiece: game.my_piece });
      } catch (err) {
        showToast("error", err?.response?.data?.error || "Move failed.");
      }
    },
    [gameId, multiplayer]
  );

  const createAiRematch = useCallback(async () => {
    const game = await checkersApi.createGame(true);
    navigate(`/games/checkers/ai/${game.id}`);
  }, [navigate]);

  return { state, move, createAiRematch, reload: load };
}
