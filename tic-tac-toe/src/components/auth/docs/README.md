# Auth Utilities — Documentation Pack

This folder documents a small auth utility layer used by the React app to support:

- **Multiple token storage strategies** (cookies, localStorage, sessionStorage)
- A **“recruiter mode” tab override** for side-by-side demos in a single browser
- **Safe access-token refresh** before making authenticated requests or opening WebSockets
- Two Axios instances: **public** (no auth header) and **auth** (auth-aware / interceptor-ready)

## Files Covered

- `src/components/auth/authMode.js`
- `src/components/auth/tokenStore.js`
- `src/components/auth/ensureFreshAccessToken.js`
- `src/api/publicAxios.js`
- `src/api/authAxios.js`

## Mental Model

Think of the auth layer as **three stacked decisions**:

1. **Where tokens live** (storage mode)
2. **How requests are made** (public vs auth axios)
3. **When to refresh** (ensure access token is valid before sensitive operations)

### 1) Storage Mode

`authMode.js` decides the mode:

- **SESSION**: per-tab storage (recruiter/demo mode)
- **LOCAL**: localStorage (dev default)
- **COOKIE**: cookies (prod default)

### 2) Request Clients

- `publicAxios`: for endpoints that should not depend on an access token (login, refresh, password reset, public reads).
- `authAxios`: for endpoints that require authentication (typically with an interceptor that attaches `Authorization: Bearer <access>`).

### 3) Freshness Guard

Before:
- opening a WebSocket
- loading a protected route
- sending a critical write (create/join game)

call `ensureFreshAccessToken()` to avoid using a token that is about to expire.

## Suggested Doc Reading Order

1. `authMode.md`
2. `tokenStore.md`
3. `ensureFreshAccessToken.md`
4. `publicAxios.md`
5. `authAxios.md`
6. `integration-guide.md`

