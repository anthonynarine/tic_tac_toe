/**
 * Generates a WebSocket URL for either a direct message (DM) or game lobby chat.
 *
 * @param {Object} params
 * @param {number|string} params.id - Friend ID (for DM) or Lobby ID (for game chat)
 * @param {string} params.token - JWT access token
 * @param {boolean} params.isLobby - True if generating a lobby chat URL
 * @returns {string} Fully-qualified WebSocket URL
 */
const getWebSocketURL = ({ id, token, isLobby }) => {
  // 🧠 Resolve the backend host from environment or fallback to localhost
  const isProd = process.env.NODE_ENV === "production"; 

  const host = process.env.REACT_APP_BACKEND_WS || (isProd
    ? "tic-tac-toe-server-66c5e15cb1f1.herokuapp.com"
    : "localhost:8000");

  // 🌐 Use 'wss' if HTTPS, else 'ws' for local/dev environments
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";

  // 🧭 Prefix the path with 'lobby/' if it's a lobby chat route
  const typePath = isLobby ? "lobby/" : "";

  // 🔗 Build and return the complete WebSocket URL
  return `${scheme}://${host}/ws/chat/${typePath}${id}/?token=${token}`;
};

export default getWebSocketURL;
