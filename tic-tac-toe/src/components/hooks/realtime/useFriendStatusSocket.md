# useFriendStatusSocket

**Source:** `src/hooks/useFriendStatusSocket.jsx`

Creates and manages a WebSocket connection to the backend FriendStatusConsumer to receive real-time friend presence updates with automatic reconnect.

---

## Signature

`useFriendStatusSocket(user, dispatch)`

- `user` — authenticated user object (expects `user.id`)
- `dispatch` — dispatch function for your friends reducer/context

---

## Responsibilities

- Ensures a **fresh access token** exists before opening the socket:
  - Uses `ensureFreshAccessToken(...)` to refresh using `refresh_token` when needed.
- Connects to:

`/ws/friends/status/?token=<access_token>`

- Listens for:

`{ type: "status_update", ... }`

and dispatches:

`dispatch({ type: "STATUS_UPDATE", payload: data })`

---

## Reconnect behavior

- On disconnect:
  - schedules a reconnect (with your reconnect strategy)
  - **re-validates the access token before reconnecting**
- If the socket closes due to auth failure (expired/invalid token):
  - refreshes the token via `ensureFreshAccessToken(...)`
  - reconnects using the refreshed token

---

## Common pitfalls / improvements

### 1) Token-in-URL exposure
Passing tokens in query params can show up in:
- browser history
- server logs / reverse proxy logs
- network tooling

Mitigations:
- always use **`wss://`** in production
- keep access tokens short-lived
- consider sending token as the first WS message (if your backend supports it), then close if auth fails

### 2) WebSocket token refresh mental model
HTTP requests can refresh tokens during a request/response cycle (axios interceptors).
WebSockets authenticate at **handshake time**, so token freshness must be ensured **before** creating the socket URL.

### 3) Reconnect backoff strategy (production hardening)
A fixed reconnect interval is okay for dev.
For production hardening, consider exponential backoff with a cap to reduce server load during outages.

---

## Example usage

```jsx
// # Filename: src/context/friends/FriendsProvider.jsx


import { useReducer } from "react";
import useFriendStatusSocket from "../../hooks/useFriendStatusSocket";
import { useUserContext } from "../userContext";
import friendsReducer, { initialFriendsState } from "./friendsReducer";

export default function FriendsProvider({ children }) {
  const { user } = useUserContext();
  const [state, dispatch] = useReducer(friendsReducer, initialFriendsState);

  // Step 1: start presence socket when logged in
  useFriendStatusSocket(user, dispatch);

  return (
    <FriendsContext.Provider value={{ state, dispatch }}>
      {children}
    </FriendsContext.Provider>
  );
}
