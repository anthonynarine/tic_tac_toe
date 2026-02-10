// # Filename: src/components/reducers/lobbyReducer.jsx
/**
 * Description:
 * This file defines the initial state and the reducer logic for managing the lobby state.
 *
 * Production-grade upgrade:
 * - Dedupe chat messages by server UUID (`message.id`) to prevent double-render if WS mounts twice.
 * - Normalize message shape defensively (supports a few backend payload variants).
 */

/// Initial State for the lobby
export const INITIAL_LOBBY_STATE = {
  players: [], // List of players in the lobby
  messages: [], // Chat messages
  isGameStarted: false, // Indicates if the game has started
  game: null, // Stores game-related details (e.g., board state, current turn)
};

function normalizeChatMessage(payload) {
  // Step 0: Allow callers to pass either the message object or an envelope { message: {...} }
  const raw =
    payload && typeof payload === "object" && payload.message && typeof payload.message === "object"
      ? payload.message
      : payload;

  // Step 1: Ensure object
  if (!raw || typeof raw !== "object") return null;

  // Step 2: Normalize common fields
  const idRaw =
    raw.id ??
    raw.message_id ??
    raw.messageId ??
    raw.uuid ??
    raw.pk ??
    null;

  const id = idRaw ? String(idRaw) : null;

  const senderRaw =
    raw.sender ??
    raw.first_name ??
    raw.username ??
    raw.sender_name ??
    "";

  const contentRaw =
    raw.content ??
    raw.text ??
    raw.message ??
    raw.body ??
    "";

  const sender = String(senderRaw || "").trim();
  const content = String(contentRaw || "").trim();

  // Step 3: Validate minimal requirements
  if (!sender || !content) return null;

  return { id, sender, content };
}

/**
 * Reducer for managing the lobby state.
 *
 * @param {Object} state - The current state of the lobby.
 * @param {Object} action - The action to process.
 * @returns {Object} - The updated state.
 */
export const lobbyReducer = (state, action) => {
  // Step 0: Log actions in dev only
  if (process.env.NODE_ENV !== "production") {
    console.log(`Reducer action received: ${action.type}`, action.payload);
  }

  switch (action.type) {
    case "SET_PLAYERS": {
      if (!Array.isArray(action.payload)) {
        console.error("Invalid SET_PLAYERS payload:", action.payload);
        return state;
      }
      return {
        ...state,
        players: action.payload,
      };
    }

    case "ADD_PLAYER": {
      if (!action.payload || typeof action.payload.id === "undefined") {
        console.error("Invalid ADD_PLAYER payload:", action.payload);
        return state;
      }

      const exists = state.players.some((p) => p?.id === action.payload.id);
      if (exists) return state;

      return {
        ...state,
        players: [...state.players, action.payload],
      };
    }

    case "PLAYER_LIST": {
      if (!Array.isArray(action.payload)) {
        console.error("Invalid PLAYER_LIST payload:", action.payload);
        return state;
      }

      const normalizedPlayers = action.payload.map((player) => ({
        id: player.id,
        first_name: player.first_name || "Unknown",
        role: player.role,
      }));

      return {
        ...state,
        players: normalizedPlayers,
      };
    }

    case "ADD_MESSAGE": {
      const msg = normalizeChatMessage(action.payload);
      if (!msg) {
        console.error("Invalid ADD_MESSAGE payload:", action.payload);
        return state;
      }

      // Step 1: Hard dedupe by id at reducer boundary
      if (msg.id) {
        const alreadyExists = state.messages.some((m) => String(m?.id) === msg.id);
        if (alreadyExists) return state;
      }

      return {
        ...state,
        messages: [...state.messages, msg],
      };
    }

    case "SET_GAME": {
      const {
        board_state,
        current_turn,
        winner,
        player_x,
        player_o,
        player_role,
        game_id,
      } = action.payload || {};

      if (process.env.NODE_ENV !== "production") {
        console.log("SET_GAME payload:", {
          board_state,
          current_turn,
          winner,
          player_x,
          player_o,
          player_role,
          game_id,
        });
      }

      const normalizedPlayerX = {
        id: player_x?.id || null,
        first_name: player_x?.first_name || "Unknown",
      };

      const normalizedPlayerO = {
        id: player_o?.id || null,
        first_name: player_o?.first_name || "Unknown",
      };

      return {
        ...state,
        game: {
          board_state: board_state || "_________",
          current_turn: current_turn || "",
          winner: winner || null,
          player_x: normalizedPlayerX,
          player_o: normalizedPlayerO,
        },
        game_id,
        playerRole: player_role || state.playerRole,
        isGameStarted: true,
      };
    }

    case "START_GAME": {
      return {
        ...state,
        isGameStarted: true,
      };
    }

    case "REMOVE_PLAYER": {
      if (!action.payload?.id) {
        console.error("Invalid REMOVE_PLAYER payload:", action.payload);
        return state;
      }
      return {
        ...state,
        players: state.players.filter((player) => player.id !== action.payload.id),
      };
    }

    case "RESET_LOBBY": {
      return { ...INITIAL_LOBBY_STATE };
    }

    default: {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Unknown action type: ${action.type}`);
      }
      return state;
    }
  }
};
