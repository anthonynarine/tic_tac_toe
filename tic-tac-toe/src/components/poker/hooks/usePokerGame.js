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
  handResultAnimation: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        game: action.game,
        status: "ready",
        error: null,
        handResultAnimation: action.handResultAnimation || state.handResultAnimation,
      };
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
  const stateRef = useRef(INITIAL);
  const seenHandResultRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const commitGame = useCallback((game) => {
    if (!mountedRef.current) return;
    const result = game?.last_hand_result;
    const handNumber = result?.hand_number;
    const resultKey = game?.id && handNumber != null ? `${game.id}-${handNumber}` : null;
    const previousGame = stateRef.current.game;
    let handResultAnimation = null;

    if (resultKey && seenHandResultRef.current !== resultKey) {
      if (previousGame && String(previousGame.id) === String(game.id)) {
        handResultAnimation = {
          key: resultKey,
          result,
          previousGame,
        };
      }
      seenHandResultRef.current = resultKey;
    }

    dispatch({ type: "LOAD", game, handResultAnimation });
  }, []);

  const load = useCallback(() => {
    if (!gameId) return;
    pokerApi.getGame(gameId)
      .then((game) => {
        commitGame(game);
      })
      .catch(() => dispatch({ type: "ERROR", error: "Failed to load poker." }));
  }, [commitGame, gameId]);

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
            commitGame(data.game);
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
  }, [commitGame, gameId, multiplayer]);

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
        const before = stateRef.current.game;
        wsRef.current.send(JSON.stringify({ type: "action", action, amount }));
        window.setTimeout(async () => {
          const current = stateRef.current.game;
          const stillWaitingForUpdate = (
            mountedRef.current
            && current
            && before
            && String(current.id) === String(gameId)
            && Number(current.hand_number || 1) === Number(before.hand_number || 1)
            && Number(current.current_turn) === Number(before.current_turn)
            && String(current.phase || "") === String(before.phase || "")
            && Number(current.pot || 0) === Number(before.pot || 0)
            && String(current.last_action || "") === String(before.last_action || "")
            && !current.is_completed
          );
          if (!stillWaitingForUpdate) return;

          try {
            const game = await pokerApi.action(gameId, action, amount);
            commitGame(game);
          } catch (err) {
            const message = err?.response?.data?.error || "";
            if (String(message).toLowerCase().includes("not your turn")) {
              load();
              return;
            }
            showToast("error", message || "Action failed.");
          }
        }, 700);
        return;
      }
      try {
        const game = await pokerApi.action(gameId, action, amount);
        commitGame(game);
      } catch (err) {
        showToast("error", err?.response?.data?.error || "Action failed.");
      }
    },
    [commitGame, gameId, load, multiplayer]
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
      commitGame(game);
    } catch (err) {
      showToast("error", err?.response?.data?.error || "Could not start next hand.");
    }
  }, [commitGame, gameId, multiplayer]);

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
    const aiPlayerCount = Math.max(
      1,
      (state.game?.players || state.game?.table_seats || []).filter((player) => player?.is_ai).length
    );
    const game = await pokerApi.createGame(true, { ai_player_count: aiPlayerCount });
    navigate(`/games/poker/ai/${game.id}`);
  }, [navigate, state.game?.players, state.game?.table_seats]);

  return { state, act, nextHand, createAiRematch, reload: load };
}
