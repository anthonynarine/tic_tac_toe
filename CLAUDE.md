# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

### Frontend (React, CRA with Tailwind + Framer Motion)
```bash
cd tic-tac-toe
npm install
npm start          # Start dev server (port 3000)
npm run build      # Production build
npm test           # Run tests
```

### Backend (Django 5.1 + DRF + Channels)
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # WSGI only - WebSockets won't work!
```

### Backend ASGI (Required for WebSockets)
Pick **one** ASGI server:
```bash
# Option A: Uvicorn (recommended for dev)
uvicorn ttt_core.asgi:application --host 0.0.0.0 --port 8000 --reload

# Option B: Daphne (Django native)
daphne -b 0.0.0.0 -p 8000 ttt_core.asgi:application
```

### Redis (Required for Channels)
```bash
docker run -p 6379:6379 redis:7
```
On Windows without Docker Desktop, Memurai can be used as the local Redis-compatible
server. Confirm Redis/Memurai with `redis-cli ping` or `netstat -ano | Select-String
":6379"`.

### Running Tests
```bash
# Backend tests (pytest)
cd backend
pytest invites/tests game/tests -v

# Frontend tests (Jest via CRA)
cd tic-tac-toe
npm test
```

---

## Architecture Overview

### System Design Principle
- **REST (DRF)** = authoritative state, fetch/store operations
- **WebSockets (Channels)** = live updates, real-time coordination, presence, badges

### Tech Stack
| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React 18, CRA, Tailwind CSS | UI/state management via Context |
| Backend | Django 5.1, DRF 3.15 | REST API, user auth, game logic |
| Real-time | Django Channels 4, Redis 4.6 | WebSocket connections, presence, chat |
| Auth | SimpleJWT 5.3 | JWT tokens (20min access, 1day refresh) |
| AI Agent | LangChain 0.3, FAISS, OpenAI | RAG system for Trinity assistant |
| Database | SQLite (dev) / PostgreSQL (prod) | Game state, users, messages |

### Frontend Architecture

**Provider Hierarchy** (in `src/App.js`):
```
UserProvider
  └─ UIProvider
      └─ AuthedProviders (conditional on authLoaded + isLoggedIn)
          ├─ InviteProvider
          ├─ NotificationProvider
          │   └─ FriendsProvider
          │       └─ DirectMessageProvider
          └─ AppRoutes
```

**Key Contexts** (in `src/context/`):
- `userContext.jsx` - Current user, auth state, token refresh logic
- `uiContext.jsx` - Global UI state (drawers, modals)
- `friendsContext.jsx` - Friend list, pending requests, presence WS
- `directMessageContext.jsx` - DM conversations, messages by friendId, unread counts
- `notificatonContext.jsx` - Global notifications socket, unread badges
- `gameContext.jsx` - Game state reducer
- `lobbyContext.jsx` - Lobby chat and game invites

**Layout** (in `src/layout/`):
- `ResponsiveLayout.jsx` - Desktop (sidebar + main + drawer) / Mobile (sidebar overlay)
- `AppShell.jsx` - Mounts TrinityDrawer globally (AI assistant)
- `LayoutFrame.jsx`, `PublicAuthLayout.jsx` - Page wrapper components

**Authentication** (in `src/auth/`):
- `tokenStore.js` - Token storage (mode-aware: cookie/localStorage/sessionStorage)
- `authMode.js` - Auth mode selection (production=cookie, dev=localStorage, recruiter=sessionStorage)
- `authAxios.js` - Axios with JWT interceptor, single-flight token refresh
- `ensureFreshAccessToken.js` - Manual token refresh when needed

### Backend Architecture

**Django Apps** (in `backend/`):
| App | Purpose |
|-----|---------|
| `users` | CustomUser (email login), profiles, avatars |
| `game` | TicTacToeGame model, move logic, AI opponent |
| `friends` | Friendship, friend requests, presence WS |
| `chat` | Conversations, messages, DM WebSocket consumer |
| `invites` | Game invites (v2 redesign), generic across game types via `game_type` |
| `lobby` | Pre-game lobby WS (roster, chat, start-game handshake) — generic across game types via `utils/game_registry.py` |
| `connect_four` | ConnectFourGame model, REST create/join/move, in-game WS (`ws/c4/<id>/`) |
| `poker` | Texas Hold'em model/rules, table settings, AI and multiplayer REST, in-game WS (`ws/poker/<id>/`) |
| `notifications` | Global notification socket, unread logic |
| `ai_agent` | LangChain RAG agent, Trinity endpoint |

**REST Endpoints** (all under `/api/`):
```
/token/                    POST   JWT issue (email + password)
/token/refresh/           POST   Refresh access token
/users/profile/           GET    Current user (protected)
/users/                   GET    List users (protected)
/friends/                 GET    List friends, pending requests (protected)
/games/                   POST/GET  Create game, list games (protected)
/games/<id>/move/         POST   Make move in game (protected)
/games/<id>/complete/     POST   Mark game complete (protected)
/poker/                   POST   Create poker game/table (protected)
/poker/<id>/              GET    Poker table detail (protected)
/poker/<id>/settings/     PATCH  Update poker table setup before start (host only)
/poker/<id>/join/         POST   Join legacy heads-up poker game
/poker/<id>/action/       POST   Poker action: check/call/raise/fold/all_in
/poker/<id>/next-hand/    POST   Start next poker hand after completion
/chat/conversations/<id>/messages/   GET  Message history (protected)
/chat/conversation-with/<friend_id>/ GET  Get or create conversation (protected)
/chat/conversations/<id>/mark-read/  POST Mark conversation as read (protected)
/trinity/                 POST   Ask AI agent (protected)
```

**WebSocket Routes** (all under `/ws/`, require token in query or Authorization header):
```
/ws/notifications/                     Global socket - DM + invite + presence notifications
/ws/friends/status/                    Presence updates (online/offline)
/ws/chat/<friend_id>/                  Direct messages with specific friend
/ws/lobby/<game_type>/<lobby_id>/      Pre-game lobby: roster, start-game handshake (generic per game_type)
/ws/chat/lobby/<lobby_name>/           Game lobby chat (frontend namespaces lobby_name as "<gameType>_<lobbyId>")
/ws/game/<game_id>/                    Tic-Tac-Toe gameplay updates, move validation, rematch signals
/ws/c4/<game_id>/                      Connect Four gameplay updates (no lobby/session gating - DB participant check only)
/ws/poker/<game_id>/                   Poker gameplay updates, actions, turn timers, next-hand sync
```

**Multi-game-type dispatch** (`utils/game_registry.py`):
- `GAME_TYPE_REGISTRY` maps each `game_type` string (`"tic_tac_toe"`, `"connect_four"`) to
  its model, create-function, and seat("X"/"O")→field-name mapping. Consumed by
  `invites/views.py`, `invites/serializers.py`, and `lobby/lobby_consumer.py` so neither
  hardcodes TicTacToe field names. Adding a new invite-capable game = one registry entry
  + a `create_<game>_game` factory function with the same signature/return shape as
  `game/services/game_factory.py::create_tictactoe_game`.
- `utils/websockets/ws_groups.py::scoped_lobby_id(game_type, lobby_id)` → `"{game_type}-
  {lobby_id}"` — feed this into every Redis key / Channels group name during the lobby
  phase, since `TicTacToeGame` and `ConnectFourGame` are separate tables with
  independently auto-incrementing PKs (a bare numeric id would collide between them).

**WebSocket Authentication** (`ttt_core/middleware.py`):
- `JWTWebSocketMiddleware` extracts token from query string or Authorization header
- Validates JWT, caches user for 60 seconds
- Falls back to AnonymousUser if invalid/expired

**ASGI Routing** (`ttt_core/asgi.py`):
- Routes HTTP to Django WSGI app
- Routes WebSocket to JWT middleware → URLRouter → app-specific consumers
- Order matters: notifications, lobby, game, chat, friends (first match wins)

---

## Key Design Patterns & Flows

### Auth Flow (JWT + Mode-Aware Storage)
1. User logs in → `POST /api/token/` with email/password
2. Backend returns `{access, refresh}` tokens
3. Frontend stores via `setToken()` (respects auth mode)
4. All REST requests include `Authorization: Bearer <access>`
5. Token refresh on 401: single-flight lock prevents race conditions

**Important**: Production uses secure cookies; dev/recruiter use localStorage/sessionStorage.

### Presence (Friends Online/Offline)
1. User connects WS to `/ws/friends/status/?token=...`
2. Consumer joins Redis group
3. When user goes online/offline, broadcasts `{type: "status_update", friend_id, is_online}`
4. FriendsProvider updates friend list in real-time

### Direct Messages (REST preload + WS live)
1. Opening DM: connect WS → `GET /api/chat/conversation-with/<friendId>` → `GET /api/chat/messages/<convo_id>`
2. Incoming WS message updates state; increments unread if drawer not open
3. Sending: POST to REST, WS broadcasts to recipient
4. Unread logic: global notification socket keeps badge counts fresh even when DM drawer closed

### Game Flow (REST state + WS signaling)
1. Create game: `POST /api/games/` with `{is_ai_game: true/false}`
2. Make move: `POST /api/games/<id>/move/` with `{position, player}`
3. Backend validates, updates DB
4. Game consumer broadcasts move to both players via `/ws/game/<game_id>/`
5. Rematch: player sends `{type: "rematch_request"}` → consumer broadcasts → accept → new game created

### Poker Flow
1. Create table: `POST /api/poker/` with `{is_ai_game}`. Non-AI creation returns
   `lobbyId` + `sessionKey` so the shared lobby can invite/start like other games.
2. Lobby setup can configure starting chips, blinds, turn timer, and max players before
   table start. Current max is 9 players.
3. Start table from `/lobby/poker/<id>`; backend initializes `table_seats`, posts blinds,
   deals hole cards, and sets `current_turn`.
4. Gameplay uses `/ws/poker/<id>/`. Legal actions are server-derived; frontend sends
   `{type: "action", action, amount?}`.
5. The backend automatically advances streets when betting closes: preflop → flop → turn
   → river → showdown/completed. Turn timers auto-check when checking is valid and
   auto-fold when facing a bet.
6. After a completed hand, the frontend queues `next_hand` after a short result window.
   In multiplayer only the table owner sends that message to avoid duplicate starts;
   the explicit Next Hand button remains as a fallback.

Poker UI conventions:
- Player seats are compact square/rectangular plates: name, chip stack, cards, active dot.
- Bets appear above the player's seat plate when active, not inside the seat.
- Dealer button is a separate table marker near the player seat, not inside the plate.
- Pot/phase/blinds/timer rail should sit above the community cards with visible spacing;
  do not let it overlap the card row.
- On mobile, remove unnecessary headers and keep the table-first layout compact.

### Friend Invite → Lobby → Start (generic across game types)
1. Trigger: a friend row's invite icon (pick a game from the small popover) or a game's
   "vs Friend" home button (creates its own lobby first, no recipient chosen yet).
2. `POST /api/invites/` with `{to_user_id, game_type, lobby_id?}` — creates the
   underlying game row up front (via the `game_registry` dispatch) and a `GameInvite` row;
   recipient is notified over `/ws/notifications/` (`invite_created` event). This step is
   already 100% game-type-agnostic on the frontend (`api/inviteApi.jsx`, `InviteCard.jsx`,
   `InvitePanel*.jsx` never branch on game_type).
3. Recipient accepts (`POST /api/invites/<id>/accept/`) → navigates to
   `/lobby/<gameType>/<lobbyId>?invite=<id>` (`invites/InviteNavigation.js`).
4. Both clients connect to `/ws/lobby/<gameType>/<lobbyId>/` — roster fills in real time
   (`update_player_list`), lobby chat works via `/ws/chat/lobby/<gameType>_<lobbyId>/`.
5. First joiner (seat "X") sends `{type: "start_game"}` → `lobby_consumer.py` persists the
   right FK fields for that game_type (via the registry) → broadcasts
   `game_start_acknowledgment` with `game_type` + `game_id` + `sessionKey`.
6. Both clients navigate to the game_type's own route (`/games/<id>` for Tic-Tac-Toe,
   `/games/connect-four/<id>` for Connect Four) and connect to that game's own WS.

### Trinity AI Agent (RAG)
1. Frontend sends `POST /api/trinity/` with `{question}`
2. Backend `AgentManager` (singleton) builds LangChain RetrievalQA on first run
3. Indexes repo docs using FAISS + OpenAI embeddings
4. Returns `{answer}` from LLM based on indexed knowledge
5. **First question is slow** (index build ~5-10s); subsequent queries faster

**Requirements**:
- `OPENAI_API_KEY` must be set in backend `.env`
- Indexed docs from `ai_agent/docs/` (auto-indexed on first query)

---

## Frontend-Backend Communication

### Axios Setup (`authAxios.js`)
- Intercepts requests, adds JWT to Authorization header
- On 401, locks request queue, refreshes token once, retries request
- Returns fresh access token to UI via global state

### WebSocket Helpers (`websocket/getWebsocketURL.jsx`)
- Automatically picks `ws://` (dev) or `wss://` (prod)
- Constructs base URL from config: `ws://localhost:8000/ws` or `wss://<backend>/ws`
- Appends token to query string: `?token=<access>`

### Environment Variables
**Frontend** (`tic-tac-toe/.env` and `.env.production`):
```
REACT_APP_DEV_URL=http://localhost:8000/api
REACT_APP_BACKEND_WS=localhost:8000  (dev) or tic-tac-toe-server-XXX.herokuapp.com (prod)
REACT_APP_DEBUG=true
```

**Backend** (`backend/.env`):
```
SECRET_KEY=<django-secret>
DEBUG=True (dev only)
REDIS_URL=redis://localhost:6379 (or rediss:// for Heroku SSL)
OPENAI_API_KEY=sk-...
DEMO_MODE=true  (enables /api/demo/ endpoints for recruiter testing)
```

---

## Common Development Tasks

### Run Full Stack Locally
1. Start Redis: `docker run -p 6379:6379 redis:7`
2. Start Backend: `uvicorn ttt_core.asgi:application --host 0.0.0.0 --port 8000 --reload`
3. Start Frontend: `cd tic-tac-toe && npm start`
4. Go to `http://localhost:3000`

### Debug WebSocket Issues
- **404 on `/ws/...`**: You're running WSGI-only (runserver). Switch to uvicorn/daphne.
- **Connection refused**: Redis not running or backend not listening.
- **Token issues**: Check `JWTWebSocketMiddleware` logs, verify token in query string.
- **Message not received**: Check consumer routing order in `ttt_core/asgi.py` (first match wins).

### Add a New REST Endpoint
1. Create/update `serializers.py` in app
2. Create `ViewSet` in `views.py`, use DRF DefaultRouter
3. Register in `urls.py`
4. Frontend: use `authAxios` instance (auto-includes JWT)

### Add a New WebSocket Consumer
1. Create `consumers.py` (or `consumers/consumer_name.py`)
2. Extend `AsyncWebsocketConsumer`
3. Implement `connect()`, `disconnect()`, `receive_json()`, `send_json()`
4. Register path in `routing.py`
5. Add pattern to `ttt_core/asgi.py` websocket_urlpatterns

### Run a Single Test
```bash
# Backend
cd backend
pytest invites/tests/test_invite_workflow.py::test_create_invite -v

# Frontend
cd tic-tac-toe
npm test -- --testNamePattern="should render login form"
```

---

## Deployment Notes

### Heroku (Production)
- `Procfile`: runs `daphne` for ASGI, `migrate` on release
- `REDIS_URL` auto-detected (with `rediss://` SSL support)
- Frontend built on Netlify, static files served from CDN
- WS requires ASGI server (standard on Heroku)

### Netlify (Frontend)
- Build: `npm run build` (CRA outputs to `build/`)
- Environment variables: `REACT_APP_BACKEND_WS`, `REACT_APP_API_BASE_URL`
- Static files cached aggressively; use cache busting for updates

### Local SQLite → Production PostgreSQL
- Dev uses `db.sqlite3` in `backend/`
- Prod uses `DATABASE_URL` env var (auto-detected via `dj-database-url`)
- Migration: `python manage.py migrate` runs on Heroku release

---

## Important Files & Locations

### Frontend Key Files
- `src/App.js` - Provider hierarchy and root routes
- `src/config.js` - API/WS URL resolution
- `src/context/*` - Global state providers
- `src/hooks/ui/` - Reusable hooks (useAuthAxios, useWebSocket, etc.)
- `src/routes/AppRoutes.jsx` - All route definitions
- `src/layout/ResponsiveLayout.jsx` - Main layout frame
- `tic-tac-toe/src/components/trinity/` - AI assistant UI

### Backend Key Files
- `ttt_core/asgi.py` - ASGI router (HTTP + WebSocket)
- `ttt_core/urls.py` - REST endpoint registration
- `ttt_core/middleware.py` - JWT WebSocket authentication
- `ttt_core/settings.py` - Django config, Channels, Redis, JWT
- `*/routing.py` - WebSocket URL patterns per app
- `*/consumers.py` - WebSocket message handlers
- `game/models.py` - TicTacToeGame model, move validation
- `connect_four/models.py` - ConnectFourGame model, move/win validation
- `poker/models.py` - PokerGame model, Hold'em rules, betting, side pots, timers
- `poker/consumers.py` - Poker websocket actions, sync, turn timeout scheduler
- `poker/serializers.py` - Poker payload masking, legal actions, timer metadata
- `tic-tac-toe/src/components/poker/` - Poker table, lobby/game pages, hooks, cards
- `utils/game_registry.py` - per-game-type dispatch (model, factory fn, seat→field mapping)
- `utils/websockets/ws_groups.py` - `scoped_lobby_id()` + Channels group name builders
- `utils/redis/redis_game_lobby_manager.py` - lobby roster/session/rematch Redis ops (keys are opaque strings — caller supplies scoping)
- `ai_agent/agent_manager.py` - LangChain singleton
- `ai_agent/langchain_agent.py` - FAISS + OpenAI setup

### Documentation
- `README.md` - Full system guide, flows, troubleshooting
- `BACKEND_OVERVIEW.md` - Backend-specific deep dive
- `AUTH_STORAGE_ARCHITECTURE.md` - Mode-aware auth design
- `tic-tac-toe/src/context/direct-messaging-architecture.md` - DM socket patterns

---

## Testing Strategy

### Backend Tests
- Located in `<app>/tests/`
- Use `pytest` with Django plugin (`pytest-django`)
- Config in `pytest.ini`
- Run: `pytest <app>/tests -v`

### Frontend Tests
- Jest + React Testing Library (CRA default)
- Run: `npm test`
- Config in `package.json` (CRA standard)

---

## Git & Workflow

- Main branch is primary; feature branches are used for development
- Commits auto-signed (may prompt for permission first time)
- No force-push without explicit user request
- Always create new commits, not amendments (unless explicitly requested)

---

## Performance & Optimization Notes

- **Token caching**: WebSocket middleware caches user for 60s (Redis or in-memory)
- **AI indexing**: Trinity's FAISS index built on first query; consider pre-warming in production
- **Presence updates**: All friends in same Redis group; fanout can be slow with many online friends
- **Message history**: Paginated to prevent loading thousands of messages at once
- **Avatar uploads**: Auto-resized on save; stored in `backend/media/`
