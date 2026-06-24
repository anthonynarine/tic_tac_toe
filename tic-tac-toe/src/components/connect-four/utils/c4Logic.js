export const ROWS = 6;
export const COLS = 7;
export const EMPTY_BOARD = Array(ROWS * COLS).fill(0);

export const PIECE = { NONE: 0, ONE: 1, TWO: 2 };

// Returns row index where piece lands, or -1 if column full
export function getDropRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row * COLS + col] === PIECE.NONE) return row;
  }
  return -1;
}

// Returns new board array after drop, or null if column full
export function dropPiece(board, col, piece) {
  const row = getDropRow(board, col);
  if (row === -1) return null;
  const next = [...board];
  next[row * COLS + col] = piece;
  return next;
}

// Returns array of winning [row,col] pairs, or null
export function findWin(board, piece) {
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if ([0, 1, 2, 3].every((i) => board[r * COLS + c + i] === piece))
        return [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]];
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      if ([0, 1, 2, 3].every((i) => board[(r + i) * COLS + c] === piece))
        return [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]];
    }
  }
  // diagonal \
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if ([0, 1, 2, 3].every((i) => board[(r + i) * COLS + c + i] === piece))
        return [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]];
    }
  }
  // diagonal /
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if ([0, 1, 2, 3].every((i) => board[(r - i) * COLS + c + i] === piece))
        return [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]];
    }
  }
  return null;
}

export function checkWinner(board) {
  if (findWin(board, PIECE.ONE)) return PIECE.ONE;
  if (findWin(board, PIECE.TWO)) return PIECE.TWO;
  if (board.every((c) => c !== PIECE.NONE)) return 0; // draw
  return null;
}

export function validCols(board) {
  return Array.from({ length: COLS }, (_, c) => c).filter(
    (c) => board[c] === PIECE.NONE
  );
}

// ─── Minimax AI ──────────────────────────────────────────────────────────────

const AI = PIECE.TWO;
const HUMAN = PIECE.ONE;
const AI_DEPTH = 6;

function scoreWindow(window, piece) {
  const opp = piece === AI ? HUMAN : AI;
  const pCount = window.filter((c) => c === piece).length;
  const eCount = window.filter((c) => c === PIECE.NONE).length;
  const oCount = window.filter((c) => c === opp).length;

  if (pCount === 4) return 100;
  if (pCount === 3 && eCount === 1) return 5;
  if (pCount === 2 && eCount === 2) return 2;
  if (oCount === 3 && eCount === 1) return -4;
  return 0;
}

function scoreBoard(board, piece) {
  let score = 0;
  // center preference
  const center = Math.floor(COLS / 2);
  score +=
    Array.from({ length: ROWS }, (_, r) => board[r * COLS + center]).filter(
      (c) => c === piece
    ).length * 3;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += scoreWindow(
        [0, 1, 2, 3].map((i) => board[r * COLS + c + i]),
        piece
      );
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      score += scoreWindow(
        [0, 1, 2, 3].map((i) => board[(r + i) * COLS + c]),
        piece
      );
    }
  }
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += scoreWindow(
        [0, 1, 2, 3].map((i) => board[(r + i) * COLS + c + i]),
        piece
      );
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += scoreWindow(
        [0, 1, 2, 3].map((i) => board[(r - i) * COLS + c + i]),
        piece
      );
    }
  }
  return score;
}

function minimax(board, depth, alpha, beta, maximizing) {
  const cols = validCols(board);
  const isTerminal =
    findWin(board, AI) || findWin(board, HUMAN) || cols.length === 0;

  if (isTerminal) {
    if (findWin(board, AI)) return { score: 1_000_000 + depth };
    if (findWin(board, HUMAN)) return { score: -(1_000_000 + depth) };
    return { score: 0 };
  }
  if (depth === 0) return { score: scoreBoard(board, AI) };

  // prefer center columns
  const ordered = [...cols].sort((a, b) =>
    Math.abs(a - 3) - Math.abs(b - 3)
  );

  if (maximizing) {
    let best = { score: -Infinity, col: ordered[0] };
    for (const col of ordered) {
      const next = dropPiece(board, col, AI);
      if (!next) continue;
      const result = minimax(next, depth - 1, alpha, beta, false);
      if (result.score > best.score) best = { score: result.score, col };
      alpha = Math.max(alpha, best.score);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = { score: Infinity, col: ordered[0] };
    for (const col of ordered) {
      const next = dropPiece(board, col, HUMAN);
      if (!next) continue;
      const result = minimax(next, depth - 1, alpha, beta, true);
      if (result.score < best.score) best = { score: result.score, col };
      beta = Math.min(beta, best.score);
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function getBestAIMove(board) {
  const cols = validCols(board);
  if (cols.length === 0) return null;
  const result = minimax(board, AI_DEPTH, -Infinity, Infinity, true);
  return result.col ?? cols[0];
}
