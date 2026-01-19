
// # Filename: src/components/lobby/utils/getWebsocketURL.jsx

/**
 * Generates a WebSocket URL for either a direct message (DM) or game lobby chat.
 *
 * IMPORTANT:
 * - This function is synchronous and expects you to pass a VALID access token.
 * - Before calling this, get a fresh token with ensureFreshAccessToken() in the caller.
 *
 * Invite v2 join guard:
 * - Lobby WebSocket connections must include ?invite=<invite_uuid>
 * - The backend validates invite before accepting the connection
 *
 * @param {Object} params
 * @param {number|string} params.id - Friend ID (for DM) or Lobby ID (for game chat)
 * @param {string} params.token - JWT access token (should already be fresh)
 * @param {boolean} params.isLobby - True if generating a lobby chat URL
 * @param {string|null} [params.inviteId=null] - Invite UUID for lobby join guard (Invite v2)
 * @returns {string} Fully-qualified WebSocket URL
 */
const getWebSocketURL = ({ id, token, isLobby, inviteId = null }) => {
  // Step 1: Validate inputs early (helps debugging)
  if (!id) {
    throw new Error("getWebSocketURL: 'id' is required.");
  }

  if (!token) {
    throw new Error("getWebSocketURL: 'token' is required.");
  }

  // Step 2: Resolve backend host
  const isProd = process.env.NODE_ENV === "production";
  const host =
    process.env.REACT_APP_BACKEND_WS ||
    (isProd
      ? "tic-tac-toe-server-66c5e15cb1f1.herokuapp.com"
      : "localhost:8000");

  // Step 3: Choose ws/wss based on page protocol
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";

  // Step 4: Route path prefix for lobby chat
  const typePath = isLobby ? "lobby/" : "";

  // Step 5: Escape ONLY path parameters
  const safeId = encodeURIComponent(String(id));

  // Step 6: Build query string (URLSearchParams handles encoding)
  const qs = new URLSearchParams({
    token: String(token),
  });

  // Step 7: Append inviteId only when present (Invite v2)
  if (inviteId) {
    qs.set("invite", String(inviteId));
  }

  // Step 8: Build final URL
  const url = `${scheme}://${host}/ws/chat/${typePath}${safeId}/?${qs.toString()}`;

  // Step 9: Optional debug logging
  const isDebug = String(process.env.REACT_APP_DEBUG).toLowerCase() === "true";
  if (isDebug) {
    console.log("📡 WebSocket URL:", url);
  }

  return url;
};

export default getWebSocketURL;