# useInviteAndNotifyFriend

**Source:** `src/hooks/useInviteAndNotifyFriend.jsx`

High-level flow hook that invites a friend to a game and notifies them via DM, then navigates the inviter to the lobby.

---


## Responsibilities

The `invite(friend)` function:

1. Opens the DM chat with the friend (and opens the drawer UI).
2. Calls `sendGameInvite(friend)` (which should also ensure the socket is ready).
3. Stores `gameId` + `lobbyId` in the direct message reducer (optional tracking).
4. Sends a DM message like: `Join my game 👉 /lobby/{lobbyId}` (delayed by 200ms).
5. Navigates to `/lobby/{lobbyId}`.

## Dependencies

- `useDirectMessage()` (directMessageContext):
  - `openChat`, `sendMessage`, `sendGameInvite`, `dispatch`
- `useUI()` (uiContext):
  - opens the drawer
- `useNavigate()` for navigation

## Common pitfalls

### 1) Timing assumptions (`setTimeout(..., 200)`)
The `setTimeout` is trying to ensure the chat is open / socket is ready before sending.

If you see “message sometimes doesn’t send”, replace the timer with a guaranteed handshake:
- `await sendGameInvite(friend)` returns only when socket open
- then send DM immediately
- or have `sendMessage` internally queue until socket is open

### 2) Two drawer setters (`setDMOpen` vs `setDrawerOpen`)
The hook destructures `setDMOpen` from `useDirectMessage()` and also reads `setDMOpen` from `useUI()` (aliased as `setDrawerOpen`).

Pick a single “source of truth” for drawer open state:
- either UIContext owns drawer state, or
- DirectMessageContext owns it

### 3) Error handling is only `console.error`
If invites are user-visible actions, consider a toast:
- `showToast("Error", "Failed to invite friend")`

## Example usage

```jsx
// # Filename: src/components/friends/FriendRow.jsx
// ✅ New Code

import { useInviteAndNotifyFriend } from "../../hooks/useInviteAndNotifyFriend";

export default function FriendRow({ friend }) {
  const invite = useInviteAndNotifyFriend();

  const onInvite = async () => {
    // Step 1: start invite flow
    await invite(friend);
  };

  return (
    <div>
      <span>{friend.name}</span>
      <button onClick={onInvite}>Invite</button>
    </div>
  );
}
```
