// # Filename: src/invites/inviteNavigation.js

// Step 1: Canonical LOBBY URL (Invite v2 join-guard uses ?invite=)
export const buildInviteLobbyUrl = ({ lobbyId, inviteId }) => {
  return `/lobby/${encodeURIComponent(lobbyId)}?invite=${encodeURIComponent(inviteId)}`;
};

// Step 2: Canonical GAME URL (used after Start Game)
export const buildInviteGameUrl = ({ gameId, inviteId }) => {
  return `/games/${encodeURIComponent(gameId)}?invite=${encodeURIComponent(inviteId)}`;
};
