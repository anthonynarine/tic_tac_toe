// # Filename: src/invites/inviteNavigation.js

// Step 1: Canonical LOBBY URL (Invite v2 join-guard uses ?invite=)
export const buildInviteLobbyUrl = ({ gameType = "tic_tac_toe", lobbyId, inviteId }) => {
  return `/lobby/${encodeURIComponent(gameType)}/${encodeURIComponent(lobbyId)}?invite=${encodeURIComponent(inviteId)}`;
};
