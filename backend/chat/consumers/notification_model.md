User A (Sender)
│
├── Connects to DirectMessageConsumer (/ws/chat/{friend_id}/)
│     └── Sends message to User B
│
├── Does NOT join notification group (not needed)
│
└── DirectMessageConsumer (A's socket)
      └── Saves message to DB
      └── Broadcasts message to:
           ├─ DM group: dm_A__B → updates DM drawer (if open)
           └─ Notification group: user_B
                 └─ Sends badge alert to NotificationConsumer for User B


User B (Receiver)
│
├── Connects to NotificationConsumer (/ws/notifications/)
│     └── Joins group: user_B
│
├── Does NOT need to open DM drawer
│
└── NotificationConsumer (B's socket)
      └── Waits for group messages from backend
      └── On `notify`:
           └── Sends JSON payload to frontend
                 └── UI shows red badge or toast via NotificationProvider


Frontend: React
│
├── <DirectMessageProvider>
│     └── Only handles direct message thread (per friend)
│
├── <NotificationProvider>
│     └── Single socket to /ws/notifications/
│     └── Listens for: dm, game_invite, friend_request, etc.
│     └── Dispatches:
│           ├─ INCREMENT_UNREAD (shows badge)
│           ├─ SHOW_TOAST (optional)
│           └─ STORE_NOTIFICATION (future enhancement)
│
└── <FriendsSidebar>
      └── Reads unreadCounts[friendId]
      └── Shows red badge next to friend