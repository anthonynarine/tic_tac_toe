# 🧩 Module: routing.py

## 📘 Purpose
Defines WebSocket routes for the Friends system.

---

## ⚙️ Routes
| Path | Consumer | Description |
|------|-----------|--------------|
| `/ws/friends/status/` | FriendStatusConsumer | Tracks online/offline presence |

---

## 💡 Developer Insights
- Centralized route for all presence-based updates.
- Can be scaled by sharding users across Redis clusters if needed.

---
