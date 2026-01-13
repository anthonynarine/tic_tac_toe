# Invites App (Invite v2)

Server-authoritative, first-class game invites for a multiplayer **Game Hub** (Tic-Tac-Toe today, Connect4 next).

This app fixes the core problem with “invite links in chat”:

- Old invites embedded as clickable `/lobby/:id` links **never expire** and remain clickable forever (“time travel”).
- Reconnects can duplicate invite messages.
- Chat/DM becomes an accidental “join source of truth”.

Invite v2 makes the **backend authoritative**:
- Invites are persisted in the database as `GameInvite` rows.
- Accept/Decline is validated server-side.
- Expired invites are not usable and must never navigate.
- Frontend dedupes by `inviteId` everywhere.


---

## Phase 1 Scope (this repo)

Backend deliverables in this app:

1. **DB model**
   - `GameInvite` with UUID id (`inviteId`), from/to users, `game_type`, `lobby_id`, status, and timestamps.

2. **REST endpoints**
   - Create invite: `POST /api/invites/`
   - Accept invite: `POST /api/invites/<invite_id>/accept/`
   - Decline invite: `POST /api/invites/<invite_id>/decline/`

3. **Notifications WS events** (sent on your Notifications socket)
   - `invite_created` → receiver only
   - `invite_status` → sender + receiver
   - Events are emitted **after DB commit** using `transaction.on_commit()` to prevent “phantom” notifications.

4. **Join Guard**
   - Lobby WebSocket connect must include `?invite=<inviteId>`.
   - Server validates invite is valid, not expired, and user is authorized for that lobby.
   - This prevents stale `/lobby/:id` links from being a join source.


---

## URL Routing

Project urlconf includes:

- `path("api/invites/", include("invites.urls"))`

So app urls are **relative** to that prefix.

### Endpoints

- `POST /api/invites/`
- `POST /api/invites/<invite_id>/accept/`
- `POST /api/invites/<invite_id>/decline/`


---

## Data Model

### `GameInvite` (invites/models.py)

Core fields:

- `id` (UUID) → frontend dedupe key (`inviteId`)
- `from_user`, `to_user`
- `game_type` (e.g. `"tic_tac_toe"`)
- `lobby_id` (Phase 1: your current lobby/game route id)
- `status`: `pending | accepted | declined | expired | canceled`
- `created_at`, `expires_at`, `responded_at`

Lifecycle:

- Created as **pending**
- Receiver may **accept** or **decline**
- Server may set **expired** after `expires_at`
- (Future) Sender may **cancel**


---

## Non-Negotiable Rules (Enforced)

1. **Backend authoritative**
   - Invite state is stored in DB and transitions are controlled in `invites/services.py`.

2. **Accept is idempotent**
   - Accepting an already-accepted invite returns the same invite/lobby id.
   - It must not create a new lobby/game.

3. **Only the receiver can accept/decline**
   - Requests by any other user are rejected.

4. **Expired invites never navigate**
   - REST returns an explicit error for expired.
   - Join guard rejects expired.

5. **Deduplicate by inviteId everywhere**
   - Frontend stores invites keyed by `inviteId`.
   - WS events upsert by id; reconnects do not double-create.


---

## Module Map (What each file does)

### `invites/models.py`
Defines the `GameInvite` DB model and status enum.

### `invites/serializers.py`
Defines canonical REST/WS-friendly serializer field names:
- `inviteId`, `fromUserId`, `toUserId`, `gameType`, `lobbyId`, timestamps.

### `invites/services.py`
Authoritative business logic:
- `create_invite()`
- `accept_invite()` (idempotent)
- `decline_invite()` (idempotent)
- `expire_invite_if_needed()`

Also emits notification events using:
- `transaction.on_commit(lambda: notify_user(...))`

### `invites/views.py`
Thin HTTP endpoints:
- validates input via serializers
- creates the lobby/game via the **game factory**
- calls `invites/services.py` for invite state changes

### `invites/urls.py`
Routes endpoints under `/api/invites/`.

### `invites/guards.py`
Join guard for lobby WebSocket connects:
- validates `inviteId` is present and is a UUID
- invite exists + matches `lobby_id`
- not expired
- user is sender or receiver
- receiver can join only after accepted (Phase 1 policy)

Used by the lobby consumer before `accept()` to prevent time-travel joins.


---

## WebSocket Event Contracts (Notifications Socket)

These are the only events needed for Phase 1.

### `invite_created` (receiver only)

```json
{
  "type": "invite_created",
  "invite": {
    "inviteId": "7b2a0f0f-9b61-4f01-8e25-2f7cc2cdd6d2",
    "fromUserId": 12,
    "toUserId": 44,
    "gameType": "tic_tac_toe",
    "lobbyId": "123",
    "status": "pending",
    "createdAt": "2026-01-12T15:21:11.231Z",
    "expiresAt": "2026-01-12T15:31:11.231Z",
    "respondedAt": null
  }
}
```

### `invite_status` (sender + receiver)

```json
{
  "type": "invite_status",
  "invite": {
    "inviteId": "7b2a0f0f-9b61-4f01-8e25-2f7cc2cdd6d2",
    "fromUserId": 12,
    "toUserId": 44,
    "gameType": "tic_tac_toe",
    "lobbyId": "123",
    "status": "accepted",
    "createdAt": "2026-01-12T15:21:11.231Z",
    "expiresAt": "2026-01-12T15:31:11.231Z",
    "respondedAt": "2026-01-12T15:22:09.002Z"
  }
}
```

Frontend must upsert/dedupe by `invite.inviteId`.


---

## Join Guard (Lobby WS)

To join the lobby via WebSocket, the client must include the invite id:

Example WS URL:

```
wss://<host>/ws/game/<lobbyId>/?token=<jwt>&invite=<inviteId>
```

The lobby consumer validates the invite via `invites/guards.py` **before**:
- group add
- Redis tracking
- `self.accept()`

If missing/invalid/expired, the socket is closed and the UI must not navigate.


---

## Extending to a Game Hub (Connect4)

Add a new game type by:
1. Adding the new `game_type` value (e.g. `"connect4"`)
2. Adding a new game factory in the game app:
   - `create_connect4_game(...)`
3. Updating `invites/views.py` to route `game_type -> factory`


---

## Testing Notes (Phase 1)

You’ll need an auth token to call endpoints. This project uses SimpleJWT:

- Obtain token: `POST /api/token/`
- Refresh token: `POST /api/token/refresh/`

Suggested smoke test flow:
1. Sender calls `POST /api/invites/` with `to_user_id`
2. Receiver sees `invite_created` via notifications socket
3. Receiver calls `POST /api/invites/<id>/accept/`
4. Both users receive `invite_status`
5. Receiver joins lobby with `?invite=<id>` and server validates it


---

## Why this app exists

Invite v2 prevents stale lobby joins, eliminates “link in chat” as a join mechanism, and creates a stable foundation for multi-game expansion while keeping the backend authoritative.
