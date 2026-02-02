
// Filename: src/api/inviteApi.js

// Step 1: Use the shared authenticated axios instance
import authAxios from "../auth/authAxios";

/**
 * Invite API
 * ----------------------------
 * Uses the app-wide authenticated axios client (authAxios).
 *
 * Why:
 * - Single baseURL source of truth (config.apiBaseUrl)
 * - Consistent cookie + token behavior
 * - Shares refresh logic via useAuthAxios interceptors (when mounted)
 */

/**
 * Fetch the authenticated user's invite inbox (rehydration endpoint).
 *
 * Backend:
 *   GET /api/invites/inbox/?status=pending&role=to_user|from_user
 *
 * @param {Object} [params]
 * @param {string} [params.status="pending"]
 * @param {"to_user"|"from_user"} [params.role="to_user"]
 * @returns {Promise<Array<Object>>} list of invites
 */
export const fetchInvites = async ({ status = "pending", role = "to_user" } = {}) => {
  // Step 1: Call backend inbox endpoint
  const res = await authAxios.get("/invites/inbox/", {
    params: { status, role },
  });

  // Step 2: Return invites list
  return res.data;
};

export const createInvite = async ({ toUserId, gameType = "tic_tac_toe" }) => {
  // Step 1: Create invite (server authoritative)
  const res = await authAxios.post("/invites/", {
    to_user_id: toUserId,
    game_type: gameType,
  });

  return res.data;
};

export const acceptInvite = async (inviteId) => {
  // Step 1: Accept invite (idempotent)
  const res = await authAxios.post(`/invites/${inviteId}/accept/`, {});
  return res.data;
};

export const declineInvite = async (inviteId) => {
  // Step 1: Decline invite (idempotent)
  const res = await authAxios.post(`/invites/${inviteId}/decline/`, {});
  return res.data;
};
