// # Filename: src/components/lobby/utils/getWebsocketURL.jsx
// ✅ New Code

export default function getWebSocketURL({
  id,
  token,
  isLobby,
  inviteId = null,
  sessionKey = null,
  lobbyId = null,
}) {
  // Step 1: Determine scheme + host
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host.includes("localhost")
    ? "localhost:8000"
    : window.location.host;

  // Step 2: For BOTH lobby + game, your backend uses /ws/game/<game_id>/
  const safeId = encodeURIComponent(String(id));
  const params = new URLSearchParams();

  params.set("token", token);

  if (inviteId) params.set("invite", String(inviteId));
  if (!inviteId && sessionKey) params.set("sessionKey", String(sessionKey));

  // Step 3: GameConsumer expects lobby=<lobbyId> for invite/session continuity
  // If lobbyId not provided, use id (stable enough for first join)
  const stableLobbyId = lobbyId ? String(lobbyId) : String(id);
  params.set("lobby", stableLobbyId);

  const wsUrl = `${scheme}://${host}/ws/game/${safeId}/?${params.toString()}`;

  console.log("📡 WebSocket URL:", wsUrl);
  return wsUrl;
}
