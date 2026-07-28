import authAxios from "../auth/authAxios";

export const statsApi = {
  getPvpLeaderboard: (gameType) =>
    authAxios.get(`stats/leaderboard/${gameType}/`).then((r) => r.data),

  getSudokuLeaderboard: (difficulty = "medium") =>
    authAxios.get("stats/leaderboard/sudoku/", { params: { difficulty } }).then((r) => r.data),

  getMySudokuBests: () =>
    authAxios.get("stats/me/sudoku/").then((r) => r.data),
};
