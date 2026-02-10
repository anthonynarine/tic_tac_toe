# Notifications App (Global User WebSocket)

This Django app provides the **single, global, authenticated WebSocket** connection for a logged-in user.

It exists to keep realtime concerns **separate from domain apps** (chat, invites, friends, game) while still allowing those apps to broadcast events to the user reliably.

---

## Why this app exists

As the game hub grows, multiple features need to deliver realtime updates:

- Game invites (create / accept / decline / cancel / expire)
- Unread badges (DM + invites)
- Friend presence updates (online/offline)
- Future: system notifications, tournaments, new games (Connect 4), etc.

If these events are delivered over a domain-specific socket (like the DM socket), you get:

- unnecessary state churn in unrelated reducers
- unread badge side-effects
- “render storms” right after login
- unclear architecture (invites ≠ chat)

This app solves that by providing:

✅ **One user socket** → `/ws/notifications/`  
✅ **One user group** → `user_<user_id>`  
✅ **One consumer** that forwards server events to the client

---

## Key design rules (contract)

### 1) HTTP writes, WS broadcasts
- **HTTP endpoints remain authoritative** for changes (create/accept/decline/etc.).
- After a successful state change, the server broadcasts a notification event
  to the relevant user group(s).

This keeps the system predictable and debuggable:
- DB is truth
- WS is awareness

### 2) Domain apps produce events; Notifications delivers them
- `invites` produces invite lifecycle events
- `friends` produces presence events
- `chat` produces DM badge events (or lightweight DM previews)

Notifications does **not** own business logic.

### 3) Reconnect safety
Clients should treat the notification stream as **deltas only**.
On reconnect, the client rehydrates truth via REST (e.g., pending invites inbox)
to prevent “invite resurrection” and missed events.

---

## WebSocket endpoint

### URL
`/ws/notifications/`

### Auth
JWT is expected in the query string:

`/ws/notifications/?token=<access_token>`

Authentication is handled by your project-level JWT middleware
(e.g., `JWTWebSocketMiddleware`) which populates:

- `scope["user"]`

If the user is anonymous, the consumer closes with `4401`.

---

## Group naming

On connect, the consumer joins:

`user_<user_id>`

Example:
- user id 42 → `user_42`

Domain apps broadcast to this group using Channels `group_send`.

---

## Consumer: `NotificationConsumer`

### Responsibilities
The consumer is intentionally minimal:

1. Reject unauthenticated connections
2. Join the user group
3. Forward server events to the client as JSON

It does **not**:
- create invites
- send DMs
- compute unread counts
- manage presence state
- perform DB writes

### Key methods

#### `connect()`
- reads `self.scope["user"]`
- rejects anonymous users (`close(code=4401)`)
- joins group `user_<id>`
- accepts the socket

#### `disconnect(code)`
- discards the channel from the user group
- logs disconnect safely even if connect never completed

#### `notify(event)`
This is the handler for `group_send` events of type `"notify"`.

Expected event shape:
```python
{
  "type": "notify",
  "payload": {...}   # JSON-serializable dict
}
```

The consumer sends:
```json
{ ...payload }
```

---

## Event contract (server → client)

Notifications emits **typed JSON** messages.

### Invite lifecycle (recommended)
```json
{ "type": "invite_created", "invite": { ...canonical_invite } }
{ "type": "invite_status",  "invite": { ...canonical_invite } }
```

Canonical invite fields should come from the server serializer
to prevent drift.

### Presence updates
```json
{ "type": "presence_update", "user_id": 123, "status": "online" }
```

### DM badge ping (lightweight)
```json
{ "type": "dm", "senderId": 123, "message_id": 555, "timestamp": "..." }
```

**Important:** DM message content should be delivered via the DM channel or REST
(depending on your UX). The notification event should be lightweight.

---

## How other apps broadcast events

A typical broadcast helper looks like this:

```python
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

def notify_user(user_id: int, payload: dict) -> None:
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {"type": "notify", "payload": payload},
    )
```

Then:
- invites app broadcasts `invite_created` to the receiver
- invites app broadcasts `invite_status` to both sender + receiver on accept/decline/expire
- friends app broadcasts `presence_update` to friends
- chat app broadcasts `dm` to the receiver

---

## Frontend integration notes

On the frontend, the Notifications WebSocket should be:

- opened once after login (global provider)
- responsible for routing events to:
  - InviteContext (invites)
  - FriendsContext (presence)
  - Notification badge state (unread counts)

The DM WebSocket should be:

- message-only
- opened only when the DM drawer is active

This boundary prevents DM reducer churn and eliminates login-time render storms.

---

## Testing checklist

### Backend
- Connect unauthenticated → closes with `4401`
- Connect authenticated → joins `user_<id>`
- `group_send` to that group → client receives payload JSON

### Frontend
- After login, exactly one socket is open: `/ws/notifications/`
- Invites appear instantly on `invite_created`
- Invites disappear instantly after `invite_status` (accepted/declined/expired)
- Presence updates update `friend_status` via reducer
- DM socket opens only when DM UI is active

---

## DB / migrations

This app has **no models** and therefore **no database tables**.

No migrations are required unless you later add persistence
(e.g., storing notification history).

---

## File layout (recommended minimal)

```
notifications/
  __init__.py
  apps.py
  consumers.py
  routing.py
  migrations/
    __init__.py
  README.md
```
