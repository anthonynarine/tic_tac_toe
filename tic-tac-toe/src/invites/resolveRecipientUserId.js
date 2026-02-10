// # Filename: src/invites/resolveRecipientUserId.js


/**
 * Resolve the OTHER user's id from a friend object.
 * Works across all known friend object shapes.
 */
export function resolveRecipientUserId(friend, currentUserId) {
  if (!friend || !currentUserId) return null;

  const me = Number(currentUserId);

  // Case 1: explicit friend_id (most reliable)
  if (friend.friend_id != null) {
    return Number(friend.friend_id);
  }

  // Case 2: nested user objects
  if (friend.user?.id && Number(friend.user.id) !== me) {
    return Number(friend.user.id);
  }

  if (friend.friend?.id && Number(friend.friend.id) !== me) {
    return Number(friend.friend.id);
  }

  // Case 3: relationship-style objects
  const fromId = Number(friend.from_user_id ?? friend.from_user?.id);
  const toId = Number(friend.to_user_id ?? friend.to_user?.id);

  if (fromId && toId) {
    return fromId === me ? toId : fromId;
  }

  // ❌ Never fall back to friend.id blindly
  return null;
}
