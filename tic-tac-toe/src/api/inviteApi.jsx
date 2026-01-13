
// # Filename: src/api/inviteApi.js

// Step 1: Axios import
import axios from "axios";

// Step 2: Resolve API base URL
// - If you already have a shared axios instance (recommended), replace this file’s
//   axiosClient with: import axiosClient from "./http";
const isProd = process.env.NODE_ENV === "production";

const API_BASE_URL =
  process.env.REACT_APP_BACKEND_HTTP ||
  (isProd
    ? "https://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com"
    : "http://localhost:8000");

// Step 3: Create a lightweight axios client
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});


// Step 4: Attach token automatically if you store it (adjust storage key as needed)
axiosClient.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Create a new invite (server-authoritative).
 *
 * POST /api/invites/
 *
 * @param {Object} params
 * @param {number|string} params.toUserId
 * @param {string} params.gameType - ex: "tic_tac_toe"
 * @returns {Promise<{invite: Object, lobbyId: string}>}
 *
 * Expected response:
 * {
 *   "invite": { "inviteId": "...", "lobbyId": "...", "status": "pending", ... },
 *   "lobbyId": "123"
 * }
 */
export const createInvite = async ({ toUserId, gameType = "tic_tac_toe" }) => {
  // Step 1: Call backend
  const res = await axiosClient.post("/api/invites/", {
    to_user_id: toUserId,
    game_type: gameType,
  });

  // Step 2: Return normalized data
  return res.data;
};

/**
 * Accept an invite (idempotent).
 *
 * POST /api/invites/:inviteId/accept/
 *
 * @param {string} inviteId
 * @returns {Promise<{invite: Object, lobbyId: string}>}
 */
export const acceptInvite = async (inviteId) => {
  // Step 1: Call backend
  const res = await axiosClient.post(`/api/invites/${inviteId}/accept/`, {});
  return res.data;
};

/**
 * Decline an invite (idempotent).
 *
 * POST /api/invites/:inviteId/decline/
 *
 * @param {string} inviteId
 * @returns {Promise<{invite: Object}>}
 */
export const declineInvite = async (inviteId) => {
  // Step 1: Call backend
  const res = await axiosClient.post(`/api/invites/${inviteId}/decline/`, {});
  return res.data;
};
