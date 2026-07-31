import { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";

import config from "../../../config";
import { pokerApi } from "../../../api/pokerApi";
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken";
import { showToast } from "../../../utils/toast/Toast";

const INITIAL = {
  game: null,
  status: "loading",
  error: null,
  wsStatus: "disconnected",
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...state, game: action.game, status: "ready", error: null };
    case "ERROR":
      return { ...state, status: "error", error: action.error || "Failed to load poker." };
    case "WS_STATUS":
      return { ...state, wsStatus: action.wsStatus };
    default:
      return state;
  }
}

export function usePokerGame(gameId, { multiplayer = false } = {}) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const wsRef = useRef(null);
  const mountedRef = useRef(true);
  const autoNextHandRef = useRef(null);

  const load = useCallback(() => {
    if (!gameId) return;
    pokerApi.getGame(gameId)
      .then((game) => {
        if (mountedRef.current) dispatch({ type: "LOAD", game });
      })
      .catch(() => dispatch({ type: "ERROR", error: "Failed to load poker." }));
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
      ws = new WebSocket(`${base}/poker/${gameId}/?token=${token}`);
      wsRef.current = ws;
      dispatch({ type: "WS_STATUS", wsStatus: "connecting" });

      ws.onopen = () => dispatch({ type: "WS_STATUS", wsStatus: "connected" });
      ws.onclose = () => dispatch({ type: "WS_STATUS", wsStatus: "disconnected" });
      ws.onerror = () => dispatch({ type: "WS_STATUS", wsStatus: "disconnected" });
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "game_state" || data.type === "game_update") {
            dispatch({ type: "LOAD", game: data.game });
          } else if (data.type === "error") {
            showToast("error", data.message || "Action failed.");
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

  useEffect(() => {
    const deadline = state.game?.turn_deadline_at;
    if (!deadline || state.game?.is_completed) return undefined;
    const delay = Math.max(250, Date.parse(deadline) - Date.now() + 350);
    const timer = window.setTimeout(() => {
      if (multiplayer && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "sync" }));
      } else {
        load();
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [load, multiplayer, state.game?.id, state.game?.is_completed, state.game?.turn_deadline_at]);

  const act = useCallback(
    async (action, amount = null) => {
      if (!gameId) return;
      if (multiplayer && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "action", action, amount }));
        return;
      }
      try {
        const game = await pokerApi.action(gameId, action, amount);
        dispatch({ type: "LOAD", game });
      } catch (err) {
        showToast("error", err?.response?.data?.error || "Action failed.");
      }
    },
    [gameId, multiplayer]
  );

  const nextHand = useCallback(async (options = {}) => {
    if (!gameId) return;
    const isAuto = options?.auto === true;
    if (multiplayer && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next_hand", auto: isAuto }));
      return;
    }
    try {
      const game = await pokerApi.nextHand(gameId);
      dispatch({ type: "LOAD", game });
    } catch (err) {
      showToast("error", err?.response?.data?.error || "Could not start next hand.");
    }
  }, [gameId, multiplayer]);

  const autoDealGameId = state.game?.id;
  const autoDealHandNumber = state.game?.hand_number || 1;
  const autoDealCompleted = Boolean(state.game?.is_completed);

  useEffect(() => {
    if (!autoDealCompleted || !gameId || !autoDealGameId) return undefined;

    const handKey = `${autoDealGameId}-${autoDealHandNumber}`;
    if (autoNextHandRef.current === handKey) return undefined;

    autoNextHandRef.current = handKey;
    const timer = window.setTimeout(() => {
      nextHand({ auto: true });
    }, multiplayer ? 5200 : 4500);
    return () => window.clearTimeout(timer);
  }, [
    gameId,
    multiplayer,
    nextHand,
    autoDealCompleted,
    autoDealGameId,
    autoDealHandNumber,
  ]);

  const createAiRematch = useCallback(async () => {
    const game = await pokerApi.createGame(true);
    navigate(`/games/poker/ai/${game.id}`);
  }, [navigate]);

  return { state, act, nextHand, createAiRematch, reload: load };
}
