# useGameServices

**Source:** `src/hooks/useGameServices.jsx`

A larger hook that groups many game-related REST operations (fetching games, making moves, completing games) and some convenience flows (play again).

---


## What this hook manages

### Local state
- `gameData` — list or object of games fetched for the user
- `joinableGames` — list of open/joinable games
- `loading` — request loading state
- `error` — last error message

### External dependencies
- `useAuthAxios()` → `authAxios`
- `useGameWebSocketContext()` → `dispatch` (used for state resets and completion flags)
- `useNavigate()` → redirect into newly created games

## API methods exposed

### Fetching
- `fetchGame(gameId)` → GET `/games/{gameId}/`
- `fetchJoinableGames()` → GET `/games/open-games/`
- `fetchUserGames()` → GET `/games/`

### Mutations
- `createNewGame(player_o=null, isAIGame=false)` → POST `/games/`
- `makeMove(gameId, position)` → POST `/games/{gameId}/move/`
- `resetGame(gameId)` → POST `/games/{gameId}/reset/`
- `completeGame(gameId, winner)` → POST `/games/{gameId}/complete/`

### Flow helpers
- `finalizeGame(gameId, winner, isCompleted=false)`:
  - prevents duplicate completion calls
  - calls `completeGame(...)`
  - dispatches `SET_GAME` with updated game

### Play again helpers
- `playAgainAI()`:
  - dispatches `RESET_GAME_STATE`
  - creates new AI game and navigates to it

- `playAgainMultiplayer()`:
  - creates new multiplayer game and navigates to it

## Common pitfalls

### 1) This file is doing *a lot*
This hook is a mix of:
- API client methods
- UI-side state
- WebSocket dispatching
- navigation side effects

That’s convenient short-term, but it tends to get long and harder to test.

### 2) Duplicate error extraction utilities
There is an internal `extractErrorMessage()` here, but other parts of the project already use a shared utility (`extractErrorMessage` in `utils/error/Error`).

Standardizing error handling makes debugging faster.

### 3) Loading state across parallel calls
Because there’s a single `loading` boolean for the entire hook, parallel requests can stomp each other’s loading state.

If you ever need multiple simultaneous requests, consider:
- separate loading flags per action, or
- return request functions without global loading, and let the calling component manage UI loading.

## Recommended refactor (strongly recommended)

### Split into a service layer + thin hooks

**Option A: Service module**
```text
src/
  services/
    games/
      gameApi.js
      gameFlows.js
  hooks/
    game/
      useGameApi.js
      useGameFlows.js
```

- `gameApi.js` → pure API calls (no React, no state)
- `useGameApi` → wraps API and handles loading/error
- `useGameFlows` → playAgain / finalizeGame / navigation side effects

This lets you reuse game APIs in non-React places (tests, scripts) and keeps each file focused.

## Example usage (fetch + move)

```jsx
// # Filename: src/pages/GamePage.jsx
// ✅ New Code

import { useEffect } from "react";
import useGameServices from "../hooks/useGameServices";

export default function GamePage({ gameId }) {
  const { fetchGame, makeMove, loading, error } = useGameServices();

  useEffect(() => {
    const run = async () => {
      // Step 1: load game
      await fetchGame(gameId);
    };
    run();
  }, [fetchGame, gameId]);

  const onCellClick = async (position) => {
    // Step 2: make a move
    await makeMove(gameId, position);
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <button onClick={() => onCellClick(0)}>Move 0</button>
    </div>
  );
}
```
