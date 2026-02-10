# Backend Master Guide (Django + DRF + Channels + Redis)

This document explains the **entire backend** for the project: how HTTP + WebSockets work together, which apps own which responsibilities, and the exact WS routes you can hit in development or production.

---

## 1) What this backend provides

- **REST APIs (DRF)** for authentication, profiles, and data that should be fetched via HTTP.
- **WebSockets (Django Channels)** for real-time features:
  - presence (online/offline)
  - lobby chat
  - direct messages (DMs)
  - **global notifications** (invites + badges + presence fanout)
  - gameplay
- **Redis** as the Channels **channel layer** (and optionally caching).

---

## 2) How traffic enters the backend (HTTP vs WebSocket)

### HTTP (REST)
HTTP requests are served through Django, wrapped for ASGI so the same server can handle both HTTP and WebSockets.

### WebSockets
WebSockets are routed through Channels via a top-level ASGI router:

- **ProtocolTypeRouter** splits `"http"` vs `"websocket"`
- **AllowedHostsOriginValidator** enforces allowed hosts/origin checks
- **JWTWebSocketMiddleware** authenticates the WS connection (attaches `scope["user"]`)
- **URLRouter** maps `/ws/...` paths to specific consumers

---

## 3) ASGI is required (why `/ws/...` can 404)

If you run only WSGI (or a server that doesn't load ASGI routing), Django will treat `/ws/...` like normal HTTP and return **404**.

✅ Correct: run an **ASGI server** (uvicorn/daphne) so the WebSocket router is active.

---

## 4) Quick Start (local dev)

### Prereqs
- Python 3.11+
- Redis running (Docker Desktop is fine)
- Node installed for frontend (not covered in detail here)

### Redis (Docker)
```bash
docker run -p 6379:6379 redis:7
```

### Backend (venv)
```bash
# Step 1: create venv
python -m venv venv

# Step 2: activate
# mac/linux
source venv/bin/activate
# windows
# venv\Scripts\activate

# Step 3: install
pip install -r requirements.txt

# Step 4: migrate
python manage.py migrate
```

### Run HTTP + WebSockets (ASGI)
Pick one server:

#### Option A: Daphne
```bash
daphne -b 0.0.0.0 -p 8000 ttt_core.asgi:application
```

#### Option B: Uvicorn
```bash
uvicorn ttt_core.asgi:application --host 0.0.0.0 --port 8000 --reload
```

> If you run `python manage.py runserver` and your WS features fail, switch to daphne/uvicorn.

---

## 5) Authentication (REST + WebSocket)

### REST JWT (SimpleJWT)
Typical endpoints:
- `POST /api/token/` → `{ access, refresh }`
- `POST /api/token/refresh/` → `{ access }`
- `GET /api/users/profile/` (protected; requires `Authorization: Bearer <access>`)

### WebSocket JWT authentication
Your WS connections are authenticated by **JWTWebSocketMiddleware**.

**Token sources supported:**
1) Authorization header:
   - `Authorization: Bearer <token>`
2) Querystring:
   - `/ws/.../?token=<token>`

After validation, middleware attaches the Django user to:
- `scope["user"]`

If token is missing/invalid:
- user becomes **AnonymousUser** and consumers typically close the socket.

---

## 6) WebSocket routes (exact)

These are the WS URLs your frontend should connect to.

### notifications app routes (global user socket)
- **Global notifications (single per user)**
  - `/ws/notifications/`

> This is the **single, authenticated user socket** used for:
> - invite lifecycle events (create/accept/decline/cancel/expire)
> - unread badges (DM + invites)
> - presence fanout events (online/offline)

### chat app routes
- **Lobby chat**
  - `/ws/chat/lobby/<lobby_name>/`
- **Direct messages**
  - `/ws/chat/<friend_id>/`

> Direct-message sockets should be treated as **message-only** channels.
> (Invites do not ride on the DM socket.)

### friends app routes (presence)
- `/ws/friends/status/`

### game app routes (gameplay)
- `/ws/game/<game_id>/`

---

## 7) App responsibilities (who owns what)

### notifications app
**Owns:**
- the **global user socket** (`/ws/notifications/`)
- forwarding server events to the client (transport only)

**Does NOT own:**
- invite business logic
- DM persistence
- presence logic
- DB writes

**Key model:**
- There are **no models** by default (no DB tables required).

---

### invites app
**Owns:**
- invite creation and lifecycle via **HTTP** (server-authoritative)
- inbox rehydration endpoint (pending invites list)

**Produces notification events to:**
- `user_<to_user_id>` (receiver)
- optionally `user_<from_user_id>` (sender acknowledgements)

---

### friends app
**Owns:**
- friend requests / friendship graph (REST)
- presence state (WS)
  - on connect/disconnect: mark online/offline
  - notify accepted friends (usually by emitting events to their `user_<id>` groups)

---

### chat app
**Owns:**
- lobby chat (WS)
- direct messages (WS + DB persistence)

**Direct messaging responsibilities:**
- validate friendship
- persist messages
- broadcast to both users
- optionally emit a lightweight **badge ping** through the notifications channel

---

### game app
**Owns:**
- gameplay consumer(s) and game-state synchronization (WS)
- uses Redis/channel layer for broadcasts to game groups

---

## 8) Channels groups (mental model)

Channels uses **groups** to broadcast to multiple clients.

Common patterns in this backend:
- `user_<id>` — personal group for notifications/presence targeted at a single user
- `lobby_<name>` — lobby group for chat + lobby state
- `dm_<sorted_user_ids>` — DM group so both users share the same room
- `game_<id>` — game group to broadcast moves/state

---

## 9) Troubleshooting (fast fixes)

### A) `/ws/...` returns 404
**Where:** Browser devtools WS handshake fails with 404  
**Why:** ASGI router not running (WSGI server only)  
**Fix:** run `daphne ... asgi:application` or `uvicorn ... asgi:application`

### B) WebSocket connects but closes immediately
**Where:** connect → immediate close code  
**Why:** user is Anonymous (JWT missing/invalid)  
**Fix:** ensure token is sent (header or `?token=`) and not expired

### C) Presence updates don't arrive
**Why:** friends are not `is_accepted=True`, or receiver not connected to a socket that receives presence fanout  
**Fix:** confirm friendship accepted + both users have active WS connections:
- presence socket (`/ws/friends/status/`)
- and/or global notifications socket (`/ws/notifications/`) depending on your fanout design

### D) DMs send but receiver doesn't see them
**Why:** receiver not connected to the DM route for that friend, or group naming mismatch  
**Fix:** ensure the frontend connects to `/ws/chat/<friend_id>/` for the active friend thread

### E) Notifications don't appear
**Why:** notification socket `/ws/notifications/` isn't connected on the frontend  
**Fix:** connect once globally after login and keep it alive

---

## 10) What to document next (recommended)
To make recruiter onboarding effortless, add:
- a **WS Events Catalog** (message types + payload shapes per consumer)
- a **REST endpoints map** (routes, auth required, request/response examples)
- a **deployment runbook** (ASGI + Redis + allowed hosts + env vars)

---

## Appendix: Where the WS routing is composed

At the project ASGI level, websocket routing is assembled by combining patterns from:
- `notifications.routing.websocket_urlpatterns`
- `game.routing.websocket_urlpatterns`
- `chat.routing.websocket_urlpatterns`
- `friends.routing.websocket_urlpatterns`

and wrapped with `JWTWebSocketMiddleware` + `AllowedHostsOriginValidator`.
