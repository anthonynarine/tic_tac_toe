// # Filename: src/components/websockets/getWebsocketURL.jsx

// Step 1: Shared base builder (scheme + host)
function getWsBase() {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host.includes("localhost")
    ? "localhost:8000"
    : window.location.host;

  return { scheme, host };
}

/**
 * Step 2: Lobby WS URL
 * Route: /ws/lobby/<lobbyId>/?token=...&invite=... OR &sessionKey=...
 */
export function getLobbyWSUrl({ lobbyId, token, inviteId = null, sessionKey = null }) {
  const { scheme, host } = getWsBase();
  const safeLobbyId = encodeURIComponent(String(lobbyId));
  const params = new URLSearchParams();

  params.set("token", token);
  if (inviteId) params.set("invite", String(inviteId));
  if (!inviteId && sessionKey) params.set("sessionKey", String(sessionKey));

  return `${scheme}://${host}/ws/lobby/${safeLobbyId}/?${params.toString()}`;
}

/**
 * Step 3: Chat WS URL
 * Route: /ws/chat/lobby/<lobby_name>/?token=...
 * (Your backend uses lobby_name — you are passing lobbyId as that name.)
 */
export function getChatWSUrl({ lobbyId, token }) {
  const { scheme, host } = getWsBase();
  const safeLobbyName = encodeURIComponent(String(lobbyId));
  const params = new URLSearchParams();

  params.set("token", token);

  return `${scheme}://${host}/ws/chat/lobby/${safeLobbyName}/?${params.toString()}`;
}

/**
 * Step 4: Game WS URL
 * Route: /ws/game/<gameId>/?token=...&sessionKey=...&lobby=...
 * (Invite is kept optional for backward compatibility until FE fully migrates.)
 */
export function getGameWSUrl({
  gameId,
  token,
  sessionKey = null,
  lobbyId = null,
  inviteId = null,
}) {
  const { scheme, host } = getWsBase();
  const safeGameId = encodeURIComponent(String(gameId));
  const params = new URLSearchParams();

  params.set("token", token);

  // Prefer sessionKey. Keep invite optional until you fully deprecate it.
  if (inviteId) params.set("invite", String(inviteId));
  if (!inviteId && sessionKey) params.set("sessionKey", String(sessionKey));

  // GameConsumer currently expects lobby=<lobbyId> for continuity
  const stableLobbyId = lobbyId ? String(lobbyId) : String(gameId);
  params.set("lobby", stableLobbyId);

  return `${scheme}://${host}/ws/game/${safeGameId}/?${params.toString()}`;
}

/**
 * Step 5: Backward-compatible default export.
 * Existing callers pass { id, token, isLobby, inviteId, sessionKey, lobbyId }.
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
