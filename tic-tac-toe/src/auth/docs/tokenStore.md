# `tokenStore.js`

## Purpose

A single set of helpers that read/write/remove tokens based on the **current auth mode**
(from `authMode.js`).

This prevents auth logic from being scattered across components.

## Functions

### `setToken(name, value, options = {})`

Writes the token to:

- `sessionStorage` when mode is `SESSION`
- `localStorage` when mode is `LOCAL`
- **cookies** when mode is `COOKIE`

Cookie defaults:

- `secure: true`
- `sameSite: "None"`
- refresh token gets `expires: 7` days
- accepts overrides via `options`

### `getToken(name)`

Reads the token from the correct store based on mode.

### `removeToken(name)`

Deletes the token from the correct store based on mode.

### `clearAuthCookies()`

Optional cleanup helper for legacy Django cookie bits (`csrftoken`, `sessionid`).

## Design Notes

### Why wrap token access?

If you ever add new modes (e.g., IndexedDB, encrypted storage),
or change cookie options, you update one module instead of 50 components.

### Cookie security expectations

For `sameSite: "None"` to work, cookies must be `Secure`, and your site must be served over HTTPS.

If you are doing cross-site cookie auth, you also need correct backend CORS + cookie settings.

