# Routing & Transport Architecture

This document explains how routing works in the GameHub application, how transport layers (HTTP vs WebSocket) are enforced, and why this structure exists. The goal is to prevent accidental WebSocket usage, avoid state leakage, and keep the system extensible for future games (Connect 4, Chess, etc.).

---

## High‑Level Mental Model

There are **three distinct layers** involved in routing:

1. **Global App Shell & Auth Gating** – decides whether the user sees the authenticated app or guest layout
2. **Main Route Switch** – selects pages and attaches the correct providers
3. **Transport‑Specific Pages** – AI (HTTP‑only) vs Multiplayer (WebSocket‑backed)

These layers must never be mixed.

---

## 1. App Entry Point (`App.jsx`)

`App.jsx` is the root of the entire application. Its responsibilities are:

- Mount global UI providers (UI, User, Notifications, DM, Invites)
- Mount the toast system
- Provide **one explicit escape hatch** for fully isolated pages

### Isolated Routes

```txt
/technical-paper
```

This route bypasses **all providers**, layout, and WebSockets. This pattern exists so that documentation, marketing pages, or static demos can render with zero side effects.

> Rule: Any page that must not trigger auth, sockets, or layout goes here.

---

## 2. Auth‑Aware Layout (`AppRoutes.jsx`)

`AppRoutes` decides **which shell to render** based on authentication state.

### Guest Mode

Providers mounted:
- LobbyProvider (minimal)

Layout:
- AppShell
- Navbar
- ResponsiveLayout (guest)

No friends, no DMs, no notifications.

### Authenticated Mode

Providers mounted:
- LobbyProvider
- FriendsProvider

Layout:
- AppShell
- Navbar
- ResponsiveLayout (full app)

> Important: **No game logic or WebSockets live here.** This layer only controls layout + global social state.

---

## 3. Page Routing (`MainRoutes.jsx`)

This is where **transport rules are enforced**.

### Public Routes

```txt
/
/login
/register
/recruiter
```

No WebSockets. No game state.

---

## 4. Game Routing & Transport Enforcement

This is the most critical part of the architecture.

### A. AI Games (HTTP‑only)

```txt
/games/ai/:id
```

Mounted Providers:
- GameProvider

**Not Mounted:**
- GameWebSocketProvider

Why:
- AI games use REST only
- No real‑time sync
- No sessions, invites, or rematch sockets

This route renders:
- `AIGamePage`
- `AIGameManager`

> Rule: AI pages must never import or call WebSocket hooks.

---

### B. Multiplayer Lobby (WebSocket‑backed)

```txt
/lobby/:id
```

Mounted Providers:
- GameWebSocketProvider
- GameProvider

Responsibilities:
- Validate sessionKey / invite
- Initialize Redis lobby state
- Assign roles
- Transition players into the game

This page is the **only valid entry point** for multiplayer games.

---

### C. Multiplayer Game (WebSocket‑backed)

```txt
/games/:id
```

Mounted Providers:
- GameWebSocketProvider
- GameProvider

Rendered Page:
- `GamePage`
- `MultiplayerGameManager`

Rules:
- This route assumes a WebSocket is already active
- It must be entered *from the lobby*
- Direct entry is guarded and redirected back to `/lobby/:id`

> Rule: Multiplayer pages may assume WS exists; AI pages may not.

---

## 5. Why This Separation Exists

### Problems This Architecture Solves

- ❌ AI games accidentally opening WebSockets
- ❌ Invite / DM state leaking into gameplay
- ❌ Render storms from unused providers
- ❌ Confusing navigation flows

### What It Enables

- Adding new games without rewriting routing
- Mixing AI and multiplayer modes safely
- Clean debugging (transport bugs surface immediately)
- Strong guarantees about where WebSockets may exist

---

## 6. Invariants (Non‑Negotiable Rules)

1. AI routes never mount WebSocket providers
2. Multiplayer routes always go through the lobby
3. Game managers are transport‑specific
4. Providers are mounted as high as necessary, no higher
5. Routes define transport, not components

Breaking any of these rules re‑introduces the bugs that were just fixed.

---

## 7. Extending the System (Connect 4, Chess, etc.)

To add a new game:

- Reuse `/lobby/:id` for multiplayer
- Add `/games/ai/:id` variant if AI exists
- Plug in a new GameManager implementation
- Keep routing identical

The routing system does not change — only managers do.

---

## Summary

This routing architecture enforces **clear boundaries** between:

- Layout vs Logic
- HTTP vs WebSocket
- AI vs Multiplayer

Those boundaries are the reason the system is now stable, predictable, and extensible.

---

## Visual Diagrams

### 1. High-Level Routing Flow

```
┌───────────────┐
│   App.jsx     │
│ (Global Root) │
└───────┬───────┘
        │
        ▼
┌──────────────────┐
│  AppRoutes.jsx   │
│ Auth / Guest     │
│ Layout Decision  │
└───────┬──────────┘
        │
        ▼
┌──────────────────┐
│ MainRoutes.jsx   │
│ Page + Transport │
│ Enforcement      │
└───────┬──────────┘
        │
        ▼
┌──────────────────────────────┐
│ Transport-Specific Pages     │
│                              │
│  /games/ai/:id  → HTTP only  │
│  /lobby/:id     → WS         │
│  /games/:id     → WS         │
└──────────────────────────────┘
```

---

### 2. AI Game Flow (HTTP-only)

```
Home Page
   │
   ▼
POST /api/games/ai
   │
   ▼
Navigate → /games/ai/:id
   │
   ▼
AIGamePage
   │
   ▼
AIGameManager
   │
   ▼
REST (HTTP) only
(no WebSocket providers mounted)
```

**Guarantees**
- No WebSocket connection
- No lobby
- No invites
- Safe to refresh

---

### 3. Multiplayer Game Flow (WebSocket-backed)

```
Home / Friends / Invite
        │
        ▼
POST /api/games/multiplayer
        │
        ▼
Navigate → /lobby/:id?sessionKey=...
        │
        ▼
LobbyPage
(GameWebSocketProvider mounted)
        │
        ▼
Validate session / invite
Assign roles
Initialize Redis lobby
        │
        ▼
Navigate → /games/:id
        │
        ▼
GamePage
MultiplayerGameManager
(WebSocket already active)
```

**Guarantees**
- WS exists before game renders
- Roles are assigned
- Redis state initialized
- No direct game entry

---

### 4. Provider Mounting Diagram

```
App.jsx
 ├─ UIProvider
 ├─ UserProvider
 ├─ NotificationProvider
 ├─ InviteProvider
 ├─ DirectMessageProvider
 └─ AppRoutes

AppRoutes.jsx
 └─ ResponsiveLayout
    └─ MainRoutes

MainRoutes.jsx
 ├─ /games/ai/:id
 │   └─ GameProvider
 │      └─ AIGamePage
 │
 ├─ /lobby/:id
 │   └─ GameWebSocketProvider
 │      └─ GameProvider
 │         └─ LobbyPage
 │
 └─ /games/:id
     └─ GameWebSocketProvider
        └─ GameProvider
           └─ GamePage
```

---

## Common Failure Modes (and Why This Architecture Prevents Them)

### ❌ AI game opens WebSocket
**Cause:** Rendering a component that calls `useGameWebSocketContext`

**Prevention:**
- AI routes never mount `GameWebSocketProvider`
- AI managers never import WS hooks

---

### ❌ Multiplayer game skips lobby
**Cause:** Navigating directly to `/games/:id`

**Prevention:**
- Home page routes multiplayer to `/lobby/:id`
- GamePage guards redirect back to lobby if entered incorrectly

---

### ❌ Context crash (`must be used within provider`)
**Cause:** Provider mounted conditionally or too low

**Prevention:**
- Providers mounted only at route level
- Pages assume providers based on route, not props

---

## Drag-and-Drop Usage

This file is safe to:
- Drag into `/docs/architecture/`
- Link from README.md
- Share with collaborators
- Reference during refactors

No code examples in this file depend on local imports.

---

## Final Takeaway

Routing is not navigation — it is **transport enforcement**.

This architecture makes illegal states unrepresentable:
- AI cannot accidentally use WebSockets
- Multiplayer cannot skip the lobby
- Providers cannot leak across modes

That is why the system is now stable.
