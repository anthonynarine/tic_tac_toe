# 🧩 Module: serializers.py

## 📘 Purpose
Handles serialization and validation logic for friendship creation and display.

---

## ⚙️ Features
- Prevents duplicate or reciprocal requests.
- Displays friend details relative to the authenticated user.
- Supports sending requests via email lookup.

---

## 🔍 Computed Fields

| Field | Description |
|--------|--------------|
| `friend_id` | ID of the other user |
| `friend_name` | Display name of the friend |
| `friend_status` | Online/offline status |
| `from_user_name` | Legacy support for pending request UI |
| `to_user_email` | Email input for creating request |

---

## 🔒 Validation Flow

```mermaid
graph TD
A[User sends POST /friends/] --> B[Serializer validates email]
B --> C[Checks if user exists]
C --> D[Checks if friendship already exists]
D --> E[Creates new Friendship(from_user, to_user)]
```

---

## 💡 Developer Insights
- Handles **symmetrical friendship checks** using `Q()` queries.
- Prevents sending requests to oneself.
- Designed for extensibility (block list, pending notifications, etc).

---
