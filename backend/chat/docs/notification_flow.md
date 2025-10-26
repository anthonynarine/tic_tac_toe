# 🔔 Notification System Flow

```
User A (Sender)
│
├── Connects to DirectMessageConsumer (/ws/chat/{friend_id}/)
│     └── Sends message to User B
│
├── DirectMessageConsumer (A's socket)
│     └── Saves message to DB
│     └── Broadcasts message to:
│           ├─ DM group: dm_A__B → updates DM drawer (if open)
│           └─ Notification group: user_B
│                 └─ Sends badge alert to NotificationConsumer for User B


User B (Receiver)
│
├── Connects to NotificationConsumer (/ws/notifications/)
│     └── Joins group: user_B
│
└── NotificationConsumer (B's socket)
      └── Waits for group messages from backend
      └── On `notify`:
           └── Sends JSON payload to frontend
                 └── UI shows red badge or toast via NotificationProvider
```

---

## 💡 Developer Insights
This system decouples **DM transport** from **notification delivery**, allowing:
- Offline badge updates
- Lightweight persistent socket for alerts
- Seamless scaling with Channels + Redis

---
