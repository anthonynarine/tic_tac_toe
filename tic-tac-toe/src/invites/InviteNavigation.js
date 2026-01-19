// # Filename: src/invites/inviteNavigation.js

// Step 1: Canonical LOBBY URL (Invite v2 join-guard uses ?invite=)
export const buildInviteLobbyUrl = ({ lobbyId, inviteId }) => {
  return `/lobby/${encodeURIComponent(lobbyId)}?invite=${encodeURIComponent(inviteId)}`;
};

// Step 2: Canonical GAME URL (used after Start Game)
// Invite v2: include lobbyId when it differs from gameId so the game WS can validate properly.
export const buildInviteGameUrl = ({ gameId, inviteId, lobbyId }) => {
  // Step 1: Build query params safely
  const params = new URLSearchParams();

  if (inviteId) params.set("invite", String(inviteId));
  if (lobbyId) params.set("lobby", String(lobbyId));

  // Step 2: Return canonical URL
  const qs = params.toString();
  return qs
    ? `/games/${encodeURIComponent(gameId)}?${qs}`
    : `/games/${encodeURIComponent(gameId)}`;
};
