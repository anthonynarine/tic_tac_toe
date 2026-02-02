# useAuth

**Source:** `src/hooks/useAuth.jsx`

Manages **login**, **registration**, and **logout** flows, and keeps application state consistent by updating User + Lobby contexts.

---

## Responsibilities

### 1) Login (normal pipeline)
- POST `/token/` to obtain `{ access, refresh }`.
- Stores tokens via `setToken(...)` (storage is mode-aware via `useAuthAxios` + `tokenStore`).
- GET `/users/profile/` using the newly-issued access token.
- Updates `UserContext` (`setUser`, `setIsLoggedIn`) and navigates to `/`.

### 2) Login with existing tokens (demo / SSO / token-based flows)
- Accepts `{ access, refresh }` from a trusted source (ex: demo endpoint).
- Stores tokens via `setToken(...)`.
- Fetches profile via GET `/users/profile/`.
- Sets `UserContext` (`setUser`, `setIsLoggedIn(true)`).

This is what Recruiter Demo Mode needs, because demo endpoints return tokens directly and **bypass** the normal email/password login flow.

### 3) Register
- POST `/users/` to create a new user.
- On success (HTTP 201), calls `login(...)` to auto-login.

### 4) Logout
- Clears tokens + cookies (through `removeToken` + `resetContext`)
- Resets Lobby context (`RESET_LOBBY`)
- Navigates to `/login`.

---

## Exports

The hook returns:

- `isLoading: boolean`
- `error: string`
- `login({ email, password }): Promise<void>`
- `loginWithTokens({ access, refresh }): Promise<UserProfile>`
- `register({ email, first_name, last_name, password }): Promise<void>`
- `logout(): void`

It also exports a helper:

- `resetContext({ removeToken, setUser, setIsLoggedIn, lobbyDispatch })`

---

## Dependencies

- `useAuthAxios()` — provides `{ authAxios, setToken, removeToken }`
- `useUserContext()` — updates current user + auth status
- `useLobbyContext()` — resets lobby state on logout
- `react-router-dom` — navigation

---

## Common pitfalls

### 1) Demo mode bypasses React auth state
Recruiter/demo login returns tokens, but if you only store tokens and don’t call `setIsLoggedIn(true)` + `setUser(profile)`,
protected routes will still redirect to `/login`.

**Solution:** call `loginWithTokens({ access, refresh })` after demo login returns tokens.

### 2) Duplicate Authorization header logic
`login()` / `loginWithTokens()` may fetch profile using an explicit `Authorization: Bearer <token>` header.

That’s reliable and avoids timing issues.
Once interceptors are stable everywhere, you can optionally rely on axios interceptors to attach headers automatically.

### 3) Logout should reset “app-wide” realtime state
You already reset lobby state. If you have other realtime contexts (DM, Notifications, Friends), consider resetting those too to prevent “ghost UI” after logout.

### 4) Error message consistency
`login()` uses a 401-specific error, `register()` reads `error.response?.data?.message`.
If your API returns errors under different keys (`detail`, `errors`, `non_field_errors`), consider a shared error extractor.

---

## Recommended refactors (optional)

### Split responsibilities
As the app grows, `useAuth` can stay orchestration-only while you move low-level calls into an auth service module:

- `authService.login(authAxios, creds)`
- `authService.register(authAxios, payload)`
- `authService.fetchProfile(authAxios)`

This makes unit testing easier and keeps the hook slimmer.

---

## Example usage

```jsx
// # Filename: src/components/auth/LoginForm.jsx

import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export default function LoginForm() {
  // Step 1: Read auth actions/state
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    // Step 2: Trigger login
    await login({ email, password });
  };

  return (
    <form onSubmit={onSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      <button disabled={isLoading}>Login</button>
      {error && <p>{error}</p>}
    </form>
  );
}
