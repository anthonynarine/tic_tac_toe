# useAuthAxios

**Source:** `src/hooks/useAuthAxios.jsx`

Provides a shared `authAxios` client with request/response interceptors to attach access tokens, store tokens from auth endpoints, and refresh access tokens on `401` (single-flight).

---


## Responsibilities

### 1) Decide credential behavior (cookie-mode)
`shouldSendCredentials()` returns `true` only when `getAuthMode() === AUTH_MODES.COOKIE`.

This is used during refresh so cookie-mode can send/receive cookies safely.

### 2) Request interceptor (outgoing)
- Ensures headers exist.
- Skips auth for:
  - `POST /token/`
  - `POST /token/refresh/`
  - `POST /users/` (registration)
  - any request with `config.skipAuth === true`
- Otherwise attaches:

`Authorization: Bearer <access_token>`

### 3) Response interceptor (incoming)
- If response is from `/token/` or `/token/refresh/`, stores returned tokens:
  - `access` → `access_token`
  - `refresh` → `refresh_token`
- If response is `/logout/`, clears tokens + cookies.

### 4) Response error interceptor (401 refresh)
- Never refresh for “public endpoints” or `skipAuth` requests (prevents loops).
- If refresh endpoint itself fails, it logs out.
- For other 401s:
  - Uses a **module-level `refreshTokenPromise`** so only one refresh request runs at a time.
  - On success, stores the new access token, retries the original request with updated Authorization.
  - On failure, clears auth state and navigates to `/login`.

## Exports

Returns:

- `authAxios` — axios instance
- `setToken(key, value, opts?)`
- `getToken(key)`
- `removeToken(key)`

## Security notes

### Token in cookies vs local/session
This hook supports both:
- cookie-mode (server-managed cookies)
- storage-mode (local/session tokens)

Make sure your refresh endpoint behavior matches your chosen mode.

### Query params for WS tokens are visible
This hook doesn’t do WS itself, but other hooks use `?token=...`. If you want to tighten security:
- prefer `wss://`
- keep access tokens short-lived
- consider sending token as the first WS message instead of query string (still not perfect, but avoids URL logging)

## Common pitfalls

### 1) `isPublicRequest` path matching drift
If your API base changes (e.g. prefix `/api/`), keep the `isPublicRequest` paths in sync:
- `/api/token/`
- `/api/token/refresh/`
- `/api/users/`

### 2) Refresh token missing
If `refresh_token` is missing in your current auth mode, any 401 on protected endpoints will force logout. That’s correct behavior, but it can surprise you during dev if you’re switching modes frequently.

### 3) “Stale interceptor” behavior
Because interceptors are attached inside a `useEffect`, make sure the hook is mounted early (typically inside an app-level provider or at least before major API calls).

## Recommended refactors (optional)

### Extract public route config
As your API grows, treat the “public route list” as config:

- `auth/publicRoutes.js`
- `auth/isPublicRequest(config)`

This prevents auth logic from getting scattered across hooks.

### Add telemetry hooks
When refresh fails, emitting a structured event (log, toast, analytics) can help debug silent token issues.

### Example usage

```jsx
// # Filename: src/components/profile/ProfilePage.jsx
// ✅ New Code

import { useEffect, useState } from "react";
import useAuthAxios from "../../hooks/useAuthAxios";

export default function ProfilePage() {
  const { authAxios } = useAuthAxios();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const run = async () => {
      // Step 1: fetch protected data (Authorization auto-attached)
      const { data } = await authAxios.get("/users/profile/");
      setProfile(data);
    };

    run();
  }, [authAxios]);

  return <pre>{profile ? JSON.stringify(profile, null, 2) : "Loading..."}</pre>;
}
```
