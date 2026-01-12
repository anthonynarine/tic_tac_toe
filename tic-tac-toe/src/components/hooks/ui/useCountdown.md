# useCountdown

**Source:** `src/hooks/useCountdown.jsx`

Interval-based countdown timer that decrements once per second while active, optionally invoking a callback when it reaches 0.

---


## Signature

`useCountdown(initialValue, isActive, onComplete?) -> number`

- `initialValue: number` — seconds to start from
- `isActive: boolean` — starts/stops the countdown
- `onComplete?: () => void` — optional callback when it reaches 0

## How it works

- Stores `count` state initialized to `initialValue`
- Uses a `timerRef` to keep a stable interval id
- When active:
  - starts a `setInterval` that decrements `count`
  - stops at 0 and calls `onComplete()` (if provided)
- When inactive:
  - resets `count` back to `initialValue`

## Common pitfalls

### 1) `onComplete` identity can restart the effect
Because `onComplete` is in the dependency array, if you pass an inline function, React will treat it as “new” each render and the effect may restart.

**Fix:** wrap `onComplete` in `useCallback(...)` where you define it.

### 2) Reset behavior only when inactive
If `initialValue` changes while `isActive === true`, the hook won’t reset mid-count (which is often correct). If you want “always sync to new initialValue”, remove the `if (!isActive)` guard.

### 3) Cleanup clears interval on every toggle
That’s expected. If you ever want “pause/resume” without resetting, you’ll need a separate “paused” concept.

## Example usage

```jsx
// # Filename: src/components/game/RematchCountdown.jsx
// ✅ New Code

import { useCallback } from "react";
import { useCountdown } from "../../hooks/useCountdown";

export default function RematchCountdown({ isActive, onTimeout }) {
  // Step 1: stable callback
  const handleComplete = useCallback(() => {
    onTimeout();
  }, [onTimeout]);

  // Step 2: run countdown
  const seconds = useCountdown(10, isActive, handleComplete);

  return <div>Rematch expires in: {seconds}s</div>;
}
```
