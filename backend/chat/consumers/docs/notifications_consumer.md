# 🧩 Module: notifications_consumer.py

## 📘 Purpose
Maintains **one global WebSocket connection per user** for all notification types.

---

## ⚙️ Responsibilities
- Authenticates user and joins `user_{id}` group.
- Receives notification events (DMs, invites, friend requests).
- Sends structured payloads to frontend’s `NotificationProvider`.

---

## 🔄 Event Flow

```
DMConsumer → group_send("user_<friend_id>", {"type": "notify", "payload": {...}})
↓
NotificationConsumer.notify()
↓
Frontend → shows red badge or toast
```

---

## 💡 Developer Insights
- Prevents the need for multiple sockets across components.
- Each WebSocket message is a **normalized notification object** (type, sender, payload).
- Extensible — can easily include system alerts, status updates, etc.

---
