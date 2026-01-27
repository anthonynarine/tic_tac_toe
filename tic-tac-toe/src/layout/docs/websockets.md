# WebSocket Architecture (GameHub)

## Principles
- No WebSockets for guests
- Scope sockets by route + UI state
- Never mount globally

## Provider Scoping

| Provider | Mount Rule |
|--------|------------|
| Notification | Logged-in only |
| Friends | Logged-in only |
| DM | Drawer open only |
| Game | `/games/:id` only |

## DM Drawer Gate

```js
if (!isDMOpenRef.current && !allowWhenClosed) return null;
```

## Common Pitfalls
- Connecting sockets in layouts
- Connecting before authLoaded
