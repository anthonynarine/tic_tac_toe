# Integration Guide

This guide shows a clean way to connect the modules together.

> Goal: **one source of truth** for tokens + safe refresh + consistent Axios usage.

---

## 1) Where tokens are set

After login:

- Store `access_token` and `refresh_token` via `tokenStore.setToken(...)`.
- The storage location is chosen by `authMode.getAuthMode()`.

---

## 2) Axios strategy

### Use `publicAxios` for:
- `/token/`
- `/token/refresh/`
- any endpoint that must never attach Authorization headers

### Use `authAxios` for:
- endpoints that require authentication

---

## 3) Recommended: Auth interceptor

**Where:** a single module like `src/api/authInterceptors.js`

Flow (request):

1. `await ensureFreshAccessToken({ minTtlSeconds: 60 })`
2. `const access = getToken("access_token")`
3. If access exists: attach `Authorization` header
4. Proceed with request

Flow (response):

- If you get a 401 and refresh is possible:
  - refresh once
  - retry once
- If refresh fails:
  - clear tokens
  - redirect to login

---

## 4) WebSocket connect flow

If your WebSocket handshake requires an access token:

1. `await ensureFreshAccessToken({ minTtlSeconds: 60 })`
2. Read `access_token`
3. Build WS URL
4. Connect

This avoids the “connect then immediately close” experience when the token is near expiry.

---

## 5) Recruiter mode UX

When recruiter mode is enabled for the tab:

- `authMode.getAuthMode()` returns `SESSION`
- tokens are stored in sessionStorage
- you can open two tabs, log in as two different users, and both will persist separately

Suggested pattern:
- Provide a dedicated “Recruiter Demo” link that calls `enableRecruiterModeForTab()`
- Optionally display a small badge “Recruiter Mode” somewhere in the UI

