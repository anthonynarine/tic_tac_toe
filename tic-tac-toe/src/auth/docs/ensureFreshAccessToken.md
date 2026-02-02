# `ensureFreshAccessToken.js`

## Purpose

Guarantees you have an access token that is valid for at least **N seconds**.

This is especially useful **right before**:

- opening WebSocket connections (so the handshake doesn’t fail)
- calling protected endpoints after a long idle
- performing critical actions (create game, accept invite, save profile)

## High-Level Behavior

1. Read `access_token`
2. If missing → try refresh using `refresh_token`
3. If present → decode JWT payload and check `exp`
4. If token expires soon (TTL < `minTtlSeconds`) → refresh
5. If refresh fails → clear tokens and return `null`

## Key Functions

### `decodeJwtPayload(token)`

Safely extracts the JWT payload by base64url-decoding the middle segment.

Returns parsed JSON or `null`.

### `refreshAccessToken()`

- Reads `refresh_token`
- POSTs to `/token/refresh/` using `publicAxios`
- Stores the new `access_token` via `tokenStore.setToken(...)`
- If refresh fails → removes both tokens (prevents infinite retry loops)

### `ensureFreshAccessToken({ minTtlSeconds = 60 } = {})`

Main entry point.

Returns:
- a fresh `access_token` string
- or `null` if refresh is not possible

## Recommended Call Sites

### Before WebSocket connect

Call this before creating the WebSocket URL that includes the access token.

### Before “protected route” bootstrap

If you have a route guard, call this when entering protected areas to avoid a burst of 401s.

## Common Failure Mode This Prevents

A stale access token causes:

- `401 Unauthorized` on protected REST calls
- WebSocket handshake reject / immediate close

Refreshing ahead of time reduces these errors.

