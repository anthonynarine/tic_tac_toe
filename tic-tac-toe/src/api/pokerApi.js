import authAxios from "../auth/authAxios";

export const pokerApi = {
  createGame: (isAiGame = false) =>
    authAxios.post("poker/", { is_ai_game: isAiGame }).then((r) => r.data),

  getGame: (gameId) =>
    authAxios.get(`poker/${gameId}/`).then((r) => r.data),

  updateSettings: (gameId, settings) =>
    authAxios.patch(`poker/${gameId}/settings/`, settings).then((r) => r.data),

  joinGame: (gameId) =>
    authAxios.post(`poker/${gameId}/join/`).then((r) => r.data),

  action: (gameId, action, amount = null) =>
    authAxios.post(`poker/${gameId}/action/`, { action, amount }).then((r) => r.data),

  nextHand: (gameId) =>
    authAxios.post(`poker/${gameId}/next-hand/`).then((r) => r.data),
};
