# 🧩 Module: routing.py

## 📘 Purpose
Defines all WebSocket routes for the chat system.

---

## ⚙️ Routes

| Path | Consumer | Description |
|------|-----------|-------------|
| `/ws/chat/lobby/<str:lobby_name>/` | ChatConsumer | Multiplayer lobby chat |
| `/ws/chat/<int:friend_id>/` | DirectMessageConsumer | Private 1-on-1 DMs |
| `/ws/notifications/` | NotificationConsumer | Real-time notifications |

---

## 💡 Developer Insights
- Keeps all consumers modular and easily testable.
- Supports horizontal scaling through Redis-based groups.

---
