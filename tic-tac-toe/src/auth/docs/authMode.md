# `authMode.js`

## Purpose

Centralizes **how the app decides where auth tokens should be stored**.

This module enables:

- A **default mode** based on environment (dev vs prod)
- A **tab-only override** (“recruiter mode”) so multiple users can test multiplayer in one browser

## Exports

### `AUTH_MODES`

- `COOKIE`: cookie-based storage (production default)
- `LOCAL`: localStorage (development default)
- `SESSION`: sessionStorage (recruiter mode)

### `getAuthMode()`

Decision order:

1. **Recruiter override**: if this tab set `ttt_auth_mode=session`, return `SESSION`
2. **Development**: return `LOCAL`
3. **Otherwise**: return `COOKIE`

This keeps your old behavior intact while enabling tab-only session storage.

### `enableRecruiterModeForTab()`

Sets `sessionStorage["ttt_auth_mode"] = "session"`

### `disableRecruiterModeForTab()`

Removes the override key from `sessionStorage`.

### `isRecruiterMode()`

Convenience helper: returns `true` when recruiter mode is active.

## Why This Exists

When doing recruiter demos, you often need “Player 1” and “Player 2” in a single machine.

Cookies and localStorage are **shared across tabs**, so two tabs would stomp each other’s tokens.

sessionStorage is **scoped per tab**, so each tab can behave like a separate user session.

## Common Usage

- A special “Recruiter Demo” link enables recruiter mode before routing into the app.
- Tabs opened from that link will store tokens in sessionStorage, allowing parallel demo accounts.

