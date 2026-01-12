# useGameCreation

**Source:** `src/hooks/useGameCreation.jsx`

Small hook that exposes a `createNewGame(isAIGame)` function using `createNewGameService(authAxios, isAIGame)`.

---


## Responsibilities

- Obtains `authAxios` from `useAuthAxios()`.
- Exposes `createNewGame(isAIGame=false)`:
  - sets `loading=true`
  - calls `createNewGameService(authAxios, isAIGame)`
  - on error: extracts a human message + shows toast, then re-throws
  - always resets `loading=false`

## Exports

- `createNewGame(isAIGame?: boolean): Promise<any>`
- `loading: boolean`
- `error: string | null`

## Common pitfalls

### 1) Duplicate functionality with `useGameServices.createNewGame`
You currently have game creation logic in *two places*:
- `useGameCreation`
- `useGameServices`

Pick one of these patterns and standardize:
- **Small single-purpose hooks** (preferred)
- **One big “services” hook** (works, but can grow fast)

### 2) `error` is set but not consistently used
The hook sets `error` only when `authAxios` is missing. All other errors are toasted + thrown, but `error` state remains unchanged.

You can either:
- set `error` for all failures, or
- remove `error` state and rely on thrown errors + toasts

## Example usage

```jsx
// # Filename: src/components/game/CreateButtons.jsx
// ✅ New Code

import useGameCreation from "../../hooks/useGameCreation";

export default function CreateButtons() {
  const { createNewGame, loading } = useGameCreation();

  const createAi = async () => {
    // Step 1: create AI game
    const game = await createNewGame(true);
    console.log("AI game:", game);
  };

  const createMulti = async () => {
    // Step 1: create multiplayer game
    const game = await createNewGame(false);
    console.log("Multiplayer game:", game);
  };

  return (
    <div>
      <button disabled={loading} onClick={createAi}>Play AI</button>
      <button disabled={loading} onClick={createMulti}>Create Multiplayer</button>
    </div>
  );
}
```
