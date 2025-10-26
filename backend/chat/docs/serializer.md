# 🧩 Module: serializer.py

## 📘 Purpose
Provides REST API access to conversation messages for offline/history sync.

---

## ⚙️ Components

### `DirectMessageSerializer`
Serializes all fields of DirectMessage for frontend rendering.

### `ConversationMessageListView`
Exposes a secure endpoint for message retrieval.

---

## 🔒 Security
- Validates authenticated user.
- Ensures user is a participant in the conversation.
- Returns ordered queryset by timestamp.

---

## Example Endpoint
`GET /api/chat/conversations/<conversation_id>/messages/`

Response:
```json
[
  {
    "id": 1,
    "sender": 5,
    "receiver": 9,
    "content": "Hey, ready to play?",
    "timestamp": "2025-10-25T21:30:00Z",
    "conversation_id": "5__9"
  }
]
```

---
