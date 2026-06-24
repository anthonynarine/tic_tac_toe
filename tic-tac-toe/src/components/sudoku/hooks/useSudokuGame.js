import { useReducer, useMemo } from "react";

// board is a flat array of 81 cells:
// { value: 0-9, isGiven: bool, notes: Set<number> }

function buildBoard(puzzleStr) {
  return Array.from(puzzleStr).map((ch) => {
    const v = parseInt(ch, 10);
    return { value: v, isGiven: v !== 0, notes: new Set() };
  });
}

function getConflictSet(board) {
  if (board.length !== 81) return new Set();
  const conflicts = new Set();
  for (let i = 0; i < 81; i++) {
    const v = board[i].value;
    if (v === 0) continue;
    const row = Math.floor(i / 9);
    const col = i % 9;
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;

    for (let j = 0; j < 81; j++) {
      if (j === i || board[j].value !== v) continue;
      const r2 = Math.floor(j / 9);
      const c2 = j % 9;
      const sameRow = r2 === row;
      const sameCol = c2 === col;
      const sameBox = Math.floor(r2 / 3) * 3 === boxR && Math.floor(c2 / 3) * 3 === boxC;
      if (sameRow || sameCol || sameBox) {
        conflicts.add(i);
        conflicts.add(j);
      }
    }
  }
  return conflicts;
}

function peers(idx) {
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const boxR = Math.floor(row / 3) * 3;
  const boxC = Math.floor(col / 3) * 3;
  const set = new Set();
  for (let c = 0; c < 9; c++) set.add(row * 9 + c);
  for (let r = 0; r < 9; r++) set.add(r * 9 + col);
  for (let r = boxR; r < boxR + 3; r++)
    for (let c = boxC; c < boxC + 3; c++) set.add(r * 9 + c);
  set.delete(idx);
  return set;
}

const INITIAL = {
  board: [],
  selected: null,
  notesMode: false,
  mistakes: 0,
  status: "idle", // idle | playing | won | failed
  solution: null,
  sessionId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD": {
      const { sessionData } = action;
      const { puzzle, current_board, notes, mistakes, elapsed_seconds } = sessionData;
      const puzzleStr = puzzle.puzzle;
      const board = Array.from(puzzleStr).map((ch, i) => {
        const isGiven = ch !== "0";
        const savedVal = current_board[i] ?? 0;
        const savedNotes = notes[String(i)] ?? [];
        return {
          value: isGiven ? parseInt(ch, 10) : savedVal,
          isGiven,
          notes: new Set(savedNotes),
        };
      });
      return {
        ...INITIAL,
        board,
        solution: puzzle.solution,
        sessionId: sessionData.id,
        mistakes: mistakes ?? 0,
        savedElapsed: elapsed_seconds ?? 0,
        status: sessionData.completed ? "won" : "playing",
      };
    }

    case "SELECT":
      return { ...state, selected: action.idx };

    case "TOGGLE_NOTES":
      return { ...state, notesMode: !state.notesMode };

    case "ENTER": {
      const { idx, num } = action;
      if (idx === null) return state;
      const cell = state.board[idx];
      if (cell.isGiven) return state;

      const board = state.board.map((c, i) => {
        if (i !== idx) return c;
        if (state.notesMode) {
          const notes = new Set(c.notes);
          notes.has(num) ? notes.delete(num) : notes.add(num);
          return { ...c, value: 0, notes };
        }
        return { ...c, value: num, notes: new Set() };
      });

      let mistakes = state.mistakes;
      if (!state.notesMode && num !== 0) {
        const correct = parseInt(state.solution[idx], 10);
        if (num !== correct) mistakes = state.mistakes + 1;
      }

      // Clear notes of peer cells when a correct value is placed
      const finalBoard = board.map((c, i) => {
        if (!state.notesMode && num !== 0 && peers(idx).has(i)) {
          const notes = new Set(c.notes);
          notes.delete(num);
          return { ...c, notes };
        }
        return c;
      });

      const allFilled = finalBoard.every((c) => c.value !== 0);
      const conflicts = getConflictSet(finalBoard);
      const won = allFilled && conflicts.size === 0;
      const failed = mistakes >= 3;

      return {
        ...state,
        board: finalBoard,
        mistakes,
        status: won ? "won" : failed ? "failed" : "playing",
      };
    }

    case "ERASE": {
      const { idx } = action;
      if (idx === null) return state;
      const cell = state.board[idx];
      if (cell.isGiven) return state;
      const board = state.board.map((c, i) =>
        i === idx ? { ...c, value: 0, notes: new Set() } : c
      );
      return { ...state, board };
    }

    default:
      return state;
  }
}

export function useSudokuGame() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const conflictSet = useMemo(() => getConflictSet(state.board), [state.board]);

  const peerSet = useMemo(
    () => (state.selected !== null ? peers(state.selected) : new Set()),
    [state.selected]
  );

  const selectedValue = state.selected !== null ? state.board[state.selected]?.value : 0;

  return {
    state,
    dispatch,
    conflictSet,
    peerSet,
    selectedValue,
  };
}
