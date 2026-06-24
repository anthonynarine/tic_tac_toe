import authAxios from "../auth/authAxios";

export const connectFourApi = {
  createGame: (isAiGame = false) =>
    authAxios.post("connect-four/", { is_ai_game: isAiGame }).then((r) => r.data),

  getGame: (gameId) =>
    authAxios.get(`connect-four/${gameId}/`).then((r) => r.data),

  joinGame: (gameId) =>
    authAxios.post(`connect-four/${gameId}/join/`).then((r) => r.data),

  makeMove: (gameId, col) =>
    authAxios.post(`connect-four/${gameId}/move/`, { col }).then((r) => r.data),
};
