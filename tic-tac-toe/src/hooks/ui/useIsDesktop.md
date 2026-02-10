# useIsDesktop

**Source:** `src/hooks/useIsDesktop.jsx`

Returns `true` when the viewport is at/above a desktop breakpoint using `window.matchMedia`.

---


## Signature

`useIsDesktop() -> boolean`

## How it works

- Initializes state using `window.innerWidth >= 1000`
- Subscribes to a media query: `(min-width: 1200px)`
- Updates state on breakpoint changes.

## Important note: breakpoint mismatch
The initial state uses **1000px**, but the media query uses **1200px**.

That means:
- on first render, screens between 1000 and 1199 will return `true`
- then after effect runs + mediaQuery emits, it may flip to `false`

### Fix
Make them consistent. Pick one breakpoint:

- If desktop is 1200px (as the docstring says), then initialize with 1200 too.

## Example usage

```jsx
// # Filename: src/components/layout/SidebarGate.jsx
// ✅ New Code

import useIsDesktop from "../../hooks/useIsDesktop";

export default function SidebarGate({ children }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? <aside>{children}</aside> : null;
}
```
