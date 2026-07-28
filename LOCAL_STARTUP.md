# Local Startup

Three things need to be running at the same time, in this order: **Redis → Backend (ASGI) → Frontend**.

## 1. Redis (required for Channels/WebSockets)

```bash
docker run -p 6379:6379 redis:7
```

Check it's up: `redis-cli ping` should return `PONG`. If you don't have Docker, any local
Redis install on port 6379 works.

## 2. Backend

```bash
cd backend
python -m venv venv          # first time only
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt   # first time only
python manage.py migrate          # first time / after model changes
```

**Then start the server with an ASGI runner — pick one:**

```bash
# Option A: Uvicorn (recommended for dev)
uvicorn ttt_core.asgi:application --host 0.0.0.0 --port 8000 --reload

# Option B: Daphne
daphne -b 0.0.0.0 -p 8000 ttt_core.asgi:application
```

> **Do NOT use `python manage.py runserver`.** It's WSGI-only and cannot upgrade HTTP
> connections to WebSocket — every `/ws/...` path will return a plain `404 Not Found` (you'll
> see it in the access log as `"GET /ws/... HTTP/1.1" 404`), and every real-time feature
> (presence, chat, lobby, live games) will silently fail to connect. This is the single most
> common local setup mistake in this project.

## 3. Frontend

```bash
cd tic-tac-toe
npm install     # first time only
npm start       # opens http://localhost:3000
```

## Verifying everything is wired up correctly

1. Open `http://localhost:3000`, log in.
2. Open the browser DevTools console — you should **not** see repeating `WS closed
   (code=1006)` / `Notification socket error` messages. If you do, the backend is still
   running under `runserver`, not uvicorn/daphne — go back to step 2.
3. Add/check a friend's online status updates live (presence WS).
4. Start a multiplayer Tic-Tac-Toe game from the Home page — you should land in a real
   lobby (`/lobby/tic_tac_toe/<id>`) with a "LIVE" WS status badge, not stuck on
   "CONNECTING".

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `404` on any `/ws/...` URL in the backend access log | Running `runserver` (WSGI-only) | Use uvicorn or daphne instead (step 2) |
| WebSocket connects then immediately closes with code `1006` | Same as above, or Redis not running | Check both: ASGI server + `redis-cli ping` |
| `Address already in use` on port 8000 | An old backend process (often a stray `runserver`) is still bound to the port | Find and stop it before starting uvicorn/daphne (`netstat -ano | findstr :8000` on Windows, then stop that PID) |
| Frontend loads but friends/chat/lobby never go "live" | Backend is up but not ASGI, or Redis is down | Same checklist as the 1006 case above |

## Reference

Full architecture, REST endpoints, WebSocket routes, and env var lists live in
`CLAUDE.md`. Session-specific work-in-progress notes live in `AGENTS.md`.
