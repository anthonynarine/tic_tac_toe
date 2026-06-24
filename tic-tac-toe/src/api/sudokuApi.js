import authAxios from "../auth/authAxios";

export const sudokuApi = {
  newPuzzle: (difficulty = "medium") =>
    authAxios.get(`sudoku/new/?difficulty=${difficulty}`).then((r) => r.data),

  getSession: (sessionId) =>
    authAxios.get(`sudoku/session/${sessionId}/`).then((r) => r.data),

  saveSession: (sessionId, payload) =>
    authAxios.put(`sudoku/session/${sessionId}/save/`, payload).then((r) => r.data),

  getStats: () =>
    authAxios.get("sudoku/stats/").then((r) => r.data),
};
