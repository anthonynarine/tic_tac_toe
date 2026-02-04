// # Filename: src/api/inviteApi.js

// Step 1: Use the shared authenticated axios instance
import authAxios from "../auth/authAxios";

export const fetchInvites = async ({ status = "pending", role = "to_user" } = {}) => {
  const res = await authAxios.get("/invites/inbox/", {
    params: { status, role },
  });
  return res.data;
};

export const createInvite = async ({ toUserId, gameType = "tic_tac_toe", lobbyId } = {}) => {
  // Step 1: Build payload in the server’s expected shape (snake_case)
  const payload = {
    to_user_id: Number(toUserId),
    game_type: gameType,
  };

  // Step 2: If inviting into an existing lobby, include lobby_id
  if (lobbyId != null && String(lobbyId).trim() !== "") {
    payload.lobby_id = String(lobbyId);

    // Optional: keep camelCase too (harmless, helps compatibility)
    payload.lobbyId = String(lobbyId);
  }

  // Step 3: Create invite (server authoritative)
  const res = await authAxios.post("/invites/", payload);
  return res.data;
};

export const acceptInvite = async (inviteId) => {
  const res = await authAxios.post(`/invites/${inviteId}/accept/`, {});
  return res.data;
};

export const declineInvite = async (inviteId) => {
  const res = await authAxios.post(`/invites/${inviteId}/decline/`, {});
  return res.data;
};
