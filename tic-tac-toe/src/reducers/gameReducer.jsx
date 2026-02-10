// # Filename: src/components/reducers/gameReducer.jsx

/**
 * Production-grade gameReducer for TicTacToe (WS-backed)
 *
 * Goals:
 * - Accept both "game_state" (connect snapshot) and "game_update" (live updates)
 * - Normalize payload keys (gameId vs game_id, winning_combination vs winningCombination, etc.)
 * - Never crash on partial payloads
 * - Keep reducer pure and deterministic
 */

const EMPTY_BOARD = "_".repeat(9);

function normalizeBoardState(boardState) {
  if (typeof boardState !== "string") return EMPTY_BOARD;
  if (boardState.length !== 9) return EMPTY_BOARD;
  return boardState;
}

function boardToCells(boardState) {
  const safe = normalizeBoardState(boardState);
  return safe.split("").map((cell) => (cell === "_" ? "" : cell));
}

function countTurnsLeft(boardState) {
  const safe = normalizeBoardState(boardState);
  return safe.split("").filter((c) => c === "_").length;
}

function normalizeWinner(winner) {
  // winner might be null, "X", "O", "D", or sometimes "" depending on server
  if (winner === "" || winner === undefined) return null;
  return winner ?? null;
}

function normalizeWinningCombo(payload) {
  const combo =
    payload?.winning_combination ??
    payload?.winningCombination ??
    payload?.winning_combo ??
    payload?.winningCombo ??
    [];

  return Array.isArray(combo) ? combo : [];
}

function normalizePlayers(payload) {
  // best-effort; not required for moves
  const playerX = payload?.player_x ?? payload?.playerX ?? null;
  const playerO = payload?.player_o ?? payload?.playerO ?? null;

  return {
    player_x: playerX,
    player_o: playerO,
  };
}

function normalizeGameId(payload) {
  return (
    payload?.game_id ??
    payload?.gameId ??
    payload?.id ??
    payload?.game ??
    null
  );
}

function normalizePayload(payload) {
  const board_state = normalizeBoardState(
    payload?.board_state ?? payload?.boardState ?? payload?.board ?? EMPTY_BOARD
  );

  const current_turn =
    payload?.current_turn ?? payload?.currentTurn ?? payload?.turn ?? "X";

  const winner = normalizeWinner(payload?.winner);

  const is_completed =
    payload?.is_completed ??
    payload?.isCompleted ??
    payload?.completed ??
    false;

  const is_ai_game =
    payload?.is_ai_game ??
    payload?.isAI ??
    payload?.is_ai ??
    false;

  const player_role =
    payload?.player_role ??
    payload?.playerRole ??
    payload?.role ??
    null;

  const game_id = normalizeGameId(payload);

  const { player_x, player_o } = normalizePlayers(payload);

  return {
    // core
    game_id,
    board_state,
    current_turn,
    winner,
    is_completed: Boolean(is_completed),
    is_ai_game: Boolean(is_ai_game),
    player_role,

    // extras
    player_x,
    player_o,
    winning_combination: normalizeWinningCombo(payload),

    // keep everything else (safe for future fields)
    rest: payload ?? {},
  };
}

export const INITIAL_STATE = {
  game: {},
  cellValues: Array(9).fill(""),
  xIsNext: true,
  isGameOver: false,
  isCompleted: false,
  numOfTurnsLeft: 9,
  winner: null,
  winningCombination: [],
  isAI: false,
  playerRole: null,
  players: [],

  // Rematch modal state
  rematchMessage: "",
  isRematchOfferVisible: false,
  rematchRequestedBy: null,
  rematchPending: false,
  rawRematchOffer: null,
  rematchButtonLocked: false,
  rematchRequesterUserId: null,
  rematchReceiverUserId: null,
  rematchShowActions: false,
  rematchUiMode: null,
  rematchCreatedAtMs: null,
  rematchGameId: null,
};

const resetRematchState = () => ({
  rematchMessage: "",
  isRematchOfferVisible: false,
  rematchRequestedBy: null,
  rematchPending: false,
  rawRematchOffer: null,
  rematchButtonLocked: false,

  rematchRequesterUserId: null,
  rematchReceiverUserId: null,
  rematchShowActions: false,
  rematchUiMode: null,
  rematchCreatedAtMs: null,
  rematchGameId: null,
});

function applyGameSnapshot(state, payload) {
  const normalized = normalizePayload(payload);

  const cells = boardToCells(normalized.board_state);
  const turnsLeft = countTurnsLeft(normalized.board_state);

  const isGameOver = Boolean(normalized.winner) || normalized.is_completed;

  return {
    ...state,
    game: {
      ...state.game,
      ...normalized.rest,
      game_id: normalized.game_id ?? state.game?.game_id,
      board_state: normalized.board_state,
      current_turn: normalized.current_turn,
      winner: normalized.winner,
      // keep player info inside game for convenience
      player_x: normalized.player_x ?? state.game?.player_x,
      player_o: normalized.player_o ?? state.game?.player_o,
    },

    cellValues: cells,
    xIsNext: normalized.current_turn === "X",
    isGameOver,
    isCompleted: normalized.is_completed,
    winner: normalized.winner,
    winningCombination: normalized.winning_combination,
    numOfTurnsLeft: turnsLeft,

    isAI: normalized.is_ai_game,
    playerRole: normalized.player_role ?? state.playerRole,
  };
}

export const gameReducer = (state, action) => {
  if (process.env.NODE_ENV === "development") {
    // Avoid logging tokens; payload should be safe.
    console.log(`[gameReducer] ${action.type}`, action?.payload);
  }

  switch (action.type) {
    // --- WS snapshots / updates ---
    // Backend connect snapshot
    case "GAME_STATE":
    case "SET_GAME":
    case "UPDATE_GAME_STATE":
    case "MAKE_MOVE": {
      return applyGameSnapshot(state, action.payload);
    }

    // --- Reset ---
    case "RESET_GAME": {
      const board_state = normalizeBoardState(action?.payload?.board_state ?? EMPTY_BOARD);

      return {
        ...INITIAL_STATE,
        game: {},
        cellValues: boardToCells(board_state),
        numOfTurnsLeft: countTurnsLeft(board_state),
      };
    }

    case "RESET_GAME_STATE": {
      return { ...INITIAL_STATE };
    }

    case "MARK_COMPLETED": {
      return {
        ...state,
        isGameOver: true,
        isCompleted: true,
      };
    }

    // --- Player list ---
    case "PLAYER_LIST": {
      return {
        ...state,
        players: Array.isArray(action.payload) ? action.payload : [],
      };
    }

    // --- Rematch flow ---
    case "SHOW_REMATCH_MODAL": {
      const p = action.payload || {};
      return {
        ...state,
        rematchMessage: p.message || "",
        rematchRequestedBy: p.rematchRequestedBy ?? null,
        isRematchOfferVisible: p.isRematchOfferVisible ?? true,
        rematchPending: p.rematchPending ?? false,

        rematchRequesterUserId: p.requesterUserId ?? null,
        rematchReceiverUserId: p.receiverUserId ?? null,
        rematchShowActions: Boolean(p.showActions),
        rematchUiMode: p.uiMode ?? null,
        rematchCreatedAtMs: p.createdAtMs ?? null,
        rematchGameId: p.game_id ?? p.gameId ?? null,
      };
    }

    case "RECEIVE_RAW_REMATCH_OFFER": {
      return {
        ...state,
        rawRematchOffer: action.payload ?? null,
      };
    }

    case "LOCK_REMATCH_BUTTON": {
      return {
        ...state,
        rematchButtonLocked: true,
      };
    }

    case "HIDE_REMATCH_MODAL":
    case "CLEAR_REMATCH_STATE": {
      return {
        ...state,
        ...resetRematchState(),
      };
    }

    default: {
      console.warn(`[gameReducer] Unknown action type: ${action.type}`);
      return state;
    }
  }
};
