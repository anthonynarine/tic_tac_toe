# 🧩 Module: views.py

## 📘 Purpose
Provides the **REST API endpoints** for managing friend requests and listings.

---

## ⚙️ Endpoints Overview

| Action | HTTP | Description |
|--------|------|--------------|
| `/friends/` | GET | List all friendships |
| `/friends/` | POST | Send a new friend request |
| `/friends/friends/` | GET | List accepted friends |
| `/friends/pending/` | GET | List pending requests |
| `/friends/{id}/accept/` | POST | Accept a request |
| `/friends/{id}/decline/` | DELETE | Decline a request |

---

## 🧩 Example Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant B as User B
    participant API

    A->>API: POST /friends/ { to_user_email: "b@email.com" }
    API->>DB: Create Friendship(from_user=A, to_user=B)
    B->>API: POST /friends/{id}/accept/
    API->>DB: is_accepted=True
    API-->>A,B: Response: {"message": "Friend request accepted."}
```

---

## 💡 Developer Insights
- Uses `@action` decorators for clear API grouping.
- Permission-restricted to authenticated users.
- Modular — can be paired with notification triggers.

---
