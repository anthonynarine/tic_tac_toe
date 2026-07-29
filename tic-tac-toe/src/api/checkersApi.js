import authAxios from "../auth/authAxios";

export const checkersApi = {
  createGame: (isAiGame = false) =>
    authAxios.post("checkers/", { is_ai_game: isAiGame }).then((r) => r.data),

  getGame: (gameId) =>
    authAxios.get(`checkers/${gameId}/`).then((r) => r.data),

  joinGame: (gameId) =>
    authAxios.post(`checkers/${gameId}/join/`).then((r) => r.data),

  makeMove: (gameId, from, to) =>
    authAxios.post(`checkers/${gameId}/move/`, { from, to }).then((r) => r.data),
};
