import { useReducer, useCallback, useEffect, useRef } from "react";
import {
  EMPTY_BOARD,
  PIECE,
  dropPiece,
  checkWinner,
  findWin,
  validCols,
  getBestAIMove,
} from "../utils/c4Logic";

const INITIAL = {
  board: EMPTY_BOARD,
  currentTurn: PIECE.ONE,   // human is always piece 1
  winner: null,              // null | 1 | 2 | 0 (draw)
  winCells: null,
  status: "playing",         // playing | won | draw
  lastDrop: null,            // { row, col } for animation
  isThinking: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "DROP": {
      if (state.status !== "playing") return state;
      const { col, piece } = action;
      const next = dropPiece(state.board, col, piece);
      if (!next) return state;

      const winner = checkWinner(next);
      const winCells = winner && winner !== 0 ? findWin(next, winner) : null;

      // find landing row for animation
      let landRow = -1;
      for (let r = 5; r >= 0; r--) {
        if (next[r * 7 + col] !== state.board[r * 7 + col]) { landRow = r; break; }
      }

      return {
        ...state,
        board: next,
        currentTurn: piece === PIECE.ONE ? PIECE.TWO : PIECE.ONE,
        winner: winner ?? null,
        winCells,
        status: winner === null ? "playing" : winner === 0 ? "draw" : "won",
        lastDrop: { row: landRow, col },
        isThinking: winner === null && piece === PIECE.ONE,
      };
    }
    case "AI_THINKING":
      return { ...state, isThinking: true };
    case "AI_DONE":
      return { ...state, isThinking: false };
    case "RESET":
      return { ...INITIAL, board: [...EMPTY_BOARD] };
    default:
      return state;
  }
}

export function useConnectFourAI() {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL, board: [...EMPTY_BOARD] });
  const thinkingRef = useRef(false);

  const dropHuman = useCallback(
    (col) => {
      if (state.currentTurn !== PIECE.ONE || state.status !== "playing") return;
      if (state.isThinking) return;
      if (!validCols(state.board).includes(col)) return;
      dispatch({ type: "DROP", col, piece: PIECE.ONE });
    },
    [state]
  );

  // AI moves in a timeout so UI can render the human move first
  useEffect(() => {
    if (
      state.currentTurn !== PIECE.TWO ||
      state.status !== "playing" ||
      thinkingRef.current
    ) return;

    thinkingRef.current = true;
    const id = setTimeout(() => {
      const col = getBestAIMove(state.board);
      if (col !== null) dispatch({ type: "DROP", col, piece: PIECE.TWO });
      thinkingRef.current = false;
    }, 350);

    return () => {
      clearTimeout(id);
      thinkingRef.current = false;
    };
  }, [state.currentTurn, state.status, state.board]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, dropHuman, reset };
}
