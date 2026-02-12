// # Filename: tic-tac-toe/src/websocket/getWebsocketURL.jsx

/**
 * Production WebSocket URL Builder (Netlify + Heroku)
 *
 * Why this exists:
 * - In production, the frontend is served from Netlify (e.g. https://onevone.net)
 * - The backend (Django Channels) is served from Heroku (e.g. https://tic-tac-toe-server-...herokuapp.com)
 * - WebSockets MUST connect to the backend host, NOT the frontend host.
 *
 * Core rule:
 * - Never derive the WS host from `window.location.host` in production.
 *   That will point to the Netlify domain and cause lobby/chat/game sockets to silently fail.
 *
 * Expected backend routing (current architecture):
 * - Base WS root:      {wsBase}/ws
 * - Lobby socket:      {wsBase}/ws/lobby/:lobbyId/?token=...
 * - Lobby chat socket: {wsBase}/ws/chat/lobby/:lobbyName/?token=...
 * - Game socket:       {wsBase}/ws/game/:gameId/?token=...&lobby=...&sessionKey=...
 *
 * Auth:
 * - Sockets pass `token` as a query param. Ensure you NEVER log the token.
 *
 * Environments:
 * - Production: uses config.websocketBaseUrl (typically wss://<heroku-host>/ws)
 * - Dev:        uses config.websocketBaseUrl (typically ws://localhost:8000/ws)
 *
 * Debug checklist if WS fails in prod:
 * 1) DevTools → Network → WS: confirm Request URL host is the Heroku backend, not Netlify.
 * 2) Confirm WS path includes correct prefix: /ws/lobby/, /ws/chat/lobby/, /ws/game/
 * 3) Heroku logs: check for GET /ws/... and 101 upgrades.
 */

import config from "../config";

// Step 1: Shared base builder (scheme + backend host)
// config.websocketBaseUrl should already be like: wss://<heroku-host>/ws
function getWsBaseUrl() {
  return (config.websocketBaseUrl || "").replace(/\/$/, "");
}

/**
 * Step 2: Lobby WS URL
 * Route: /ws/lobby/<lobbyId>/?token=...&invite=... OR &sessionKey=...
 */
export function getLobbyWSUrl({ lobbyId, token, inviteId = null, sessionKey = null }) {
  const wsBase = getWsBaseUrl();
  const safeLobbyId = encodeURIComponent(String(lobbyId));
  const params = new URLSearchParams();

  params.set("token", token);
  if (inviteId) params.set("invite", String(inviteId));
  if (!inviteId && sessionKey) params.set("sessionKey", String(sessionKey));

  return `${wsBase}/lobby/${safeLobbyId}/?${params.toString()}`;
}

/**
 * Step 3: Lobby Chat WS URL
 * Route: /ws/chat/lobby/<lobby_name>/?token=...
 * Note: backend currently uses `lobby_name` in the URL pattern; we pass lobbyId as that name.
 */
export function getChatWSUrl({ lobbyId, token }) {
  const wsBase = getWsBaseUrl();
  const safeLobbyName = encodeURIComponent(String(lobbyId));
  const params = new URLSearchParams();

  params.set("token", token);

  return `${wsBase}/chat/lobby/${safeLobbyName}/?${params.toString()}`;
}

/**
 * Step 4: Game WS URL
 * Route: /ws/game/<gameId>/?token=...&sessionKey=...&lobby=...
 */
export function getGameWSUrl({
  gameId,
  token,
  sessionKey = null,
  lobbyId = null,
  inviteId = null,
}) {
  const wsBase = getWsBaseUrl();
  const safeGameId = encodeURIComponent(String(gameId));
  const params = new URLSearchParams();

  params.set("token", token);

  if (inviteId) params.set("invite", String(inviteId));
  if (!inviteId && sessionKey) params.set("sessionKey", String(sessionKey));

  const stableLobbyId = lobbyId ? String(lobbyId) : String(gameId);
  params.set("lobby", stableLobbyId);

  return `${wsBase}/game/${safeGameId}/?${params.toString()}`;
}

/**
 * getWebSocketURL (legacy compatibility)
 * - Keeps existing call sites working:
 *   - isLobby=true  -> lobby socket
 *   - isLobby=false -> game socket
 */
export default function getWebSocketURL({
  id,
  token,
  isLobby,
  inviteId = null,
  sessionKey = null,
  lobbyId = null,
}) {
  if (isLobby) {
    return getLobbyWSUrl({ lobbyId: id, token, inviteId, sessionKey });
  }
  return getGameWSUrl({ gameId: id, token, sessionKey, lobbyId, inviteId });
}
