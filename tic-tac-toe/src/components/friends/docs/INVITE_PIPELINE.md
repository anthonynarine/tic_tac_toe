# Invite Pipeline (Sidebar → Lobby Deep-Link)

This document captures the **current invite pipeline** implemented by the sidebar (Friends UI), plus the **recommended evolution** to support inviting friends into an **already-created lobby** (e.g., host clicks *Play Multiplayer* and then invites someone).

---

## Glossary

- **Sender / Host**: The user initiating the invite.
- **Recipient**: The friend being invited.
- **Lobby**: A multiplayer waiting room (e.g., `/lobby/:lobbyId`).
- **Invite Deep-Link**: A URL of the form `/lobby/:lobbyId?invite=:inviteId` that allows the recipient to join.
- **Session Key**: A server-issued key that authorizes lobby participation; promoted into `sessionStorage` and the URL as `?sessionKey=...` after `session_established`.

---

## Current Sidebar Invite Pipeline (as implemented)

### A) Frontend flow (Friends Sidebar)

**User action**
1. The sender opens the sidebar friends list.
2. Sender clicks the **Invite/Gamepad** action on a specific friend row.

**Component chain**
- `FriendRow` (UI button) → triggers `onInvite(friend)`
- `FriendsPanel` passes the handler down
- `FriendsSidebar.handleInvite(friend)` executes the invite flow

**Invite creation**
1. Resolve which user ID to invite:
   - `resolveRecipientUserId(friend, currentUserId)`
2. Create the invite via HTTP:
   - `createInvite({ toUserId, gameType: "tic_tac_toe" })`
3. Parse response fields:
   - expect `inviteId` and `lobbyId` (or equivalent fields in the response payload)
4. Navigate sender into the lobby via deep-link:
   - `navigate(buildInviteLobbyUrl({ lobbyId, inviteId }))`
   - Example: `/lobby/685?invite=<inviteId>`

**Key behavior**
- The sender **creates a brand-new lobby/game** as part of inviting.
- The sender is then navigated into that new lobby via the invite deep-link.

---

### B) Backend flow (Invite Create Endpoint)

**Endpoint**
- `POST /api/invites/`

**Behavior today**
1. Creates a **new** tic-tac-toe game/lobby (e.g., using `create_tictactoe_game(...)`)
2. Assigns `lobby_id = str(game.id)`
3. Creates an invite record (e.g., `GameInvite`) that ties:
   - `from_user` → sender
   - `to_user` → recipient
   - `lobby_id` → newly created lobby
4. Returns payload to the frontend with:
   - `inviteId`
   - `lobbyId`

---

### C) Recipient flow (Accepting/Using the Invite)

**High-level behavior**
1. Recipient receives an invite notification (typically via WS notifications or a refreshed invites list).
2. Recipient clicks the invite.
3. App navigates recipient to:
   - `/lobby/:lobbyId?invite=:inviteId`

**Lobby WS join**
1. Lobby WebSocket is opened with `invite` query param.
2. Server validates invite and establishes a session.
3. Server emits:
   - `session_established` with `sessionKey`

**SessionKey promotion**
- On `session_established`, client:
  1. Stores `sessionKey` in `sessionStorage` (e.g., `sessionKey:<lobbyId>`)
  2. Replaces URL query string:
     - `?invite=...` → `?sessionKey=...`

This prevents reusing the invite link repeatedly and makes reconnection stable.

---

## Recommended Evolution: Invite into an Existing Lobby

### Problem
The current pipeline always **creates a new lobby** as part of sending an invite.  
But when a host clicks **Play Multiplayer / Create Multiplayer Game**, they’re already in a lobby and need to invite friends **into that existing lobby**.

### Goal
Reuse the existing invite architecture (HTTP create + invite state + deep-link join) while adding the ability to target an **existing lobby**.

---

## Evolution Option (Recommended): Extend `POST /api/invites/` with `lobby_id`

### A) Backend: updated endpoint behavior

**Request**
- `POST /api/invites/`
- Add an optional field:
  - `lobby_id` (string)

**Behavior**
- If `lobby_id` is **provided**:
  1. **Do not** create a new game/lobby.
  2. Validate the lobby exists and sender is allowed to invite into it.
  3. Create invite record pointing to that lobby.
  4. Return `{ inviteId, lobbyId: lobby_id }`.

- If `lobby_id` is **not provided**:
  - Keep existing behavior:
    1. Create a new lobby/game.
    2. Create invite pointing to it.
    3. Return `{ inviteId, lobbyId }`.

**Suggested backend guards**
- prevent inviting self
- prevent duplicate pending invites for same `(to_user, lobby_id)`
- (optional) prevent invites if lobby is already full

---

### B) Frontend: make the sidebar invite action lobby-aware

**Detect current lobby context**
- If the sender is on `/lobby/:id` (or otherwise has a current lobbyId):
  - call:
    - `createInvite({ toUserId, gameType, lobbyId: currentLobbyId })`
  - **do not navigate away** (already in correct lobby)
  - show toast: “Invite sent” (optional: copy invite URL)

- Else (not in lobby):
  - keep current behavior:
    - `createInvite({ toUserId, gameType })`
    - navigate sender to `/lobby/:lobbyId?invite=:inviteId`

This keeps one canonical invitation mechanism while supporting both entry points.

---

## End-to-End Sequence Diagrams

### Current flow (creates new lobby)
1. Sender clicks invite in sidebar
2. Frontend `POST /api/invites/` (no lobby_id)
3. Backend creates new lobby/game + invite
4. Backend responds `{ lobbyId, inviteId }`
5. Sender navigates to `/lobby/:lobbyId?invite=:inviteId`
6. Recipient receives invite + clicks it → same deep-link
7. Lobby WS validates invite → `session_established`
8. Client promotes to `?sessionKey=...`

### Evolved flow (invites into existing lobby)
1. Host creates/enters lobby `/lobby/:lobbyId`
2. Host clicks invite in sidebar
3. Frontend `POST /api/invites/` with `{ lobby_id: currentLobbyId }`
4. Backend creates invite only (no new lobby)
5. Backend responds `{ lobbyId: currentLobbyId, inviteId }`
6. Recipient clicks invite deep-link → `/lobby/:lobbyId?invite=:inviteId`
7. Lobby WS validates invite → `session_established`
8. Client promotes to `?sessionKey=...`

---

## Implementation Notes (Production-grade)

- **Single source of truth**: invites stored in invite reducer/context; lobby/chat stored in lobby reducer/context.
- **No extra sockets**: lobby screen owns lobby + chat sockets only; invites should arrive via notifications/invites system (not the lobby socket).
- **Defense-in-depth**:
  - reducer-level dedupe for chat by `message.id`
  - server should generate stable `inviteId` and stable `message.id`
- **Security**:
  - never log tokens
  - validate invite ownership + lobby existence server-side
- **UX**:
  - in-lobby invites should not navigate host away; show “Invite sent”.
  - deep-link remains the canonical join mechanism for recipients.

---

## Checklist

- [ ] Sidebar invite creates invite via HTTP
- [ ] When in lobby, invite targets existing lobby (no new lobby created)
- [ ] Recipient can join via `/lobby/:id?invite=:inviteId`
- [ ] Lobby WS mints sessionKey, client promotes URL to `?sessionKey=...`
- [ ] Lobby/chat sockets do not duplicate; leaving lobby closes sockets cleanly
