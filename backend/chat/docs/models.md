# 🧩 Module: models.py

## 📘 Purpose
Defines database models for **DirectMessage** and **Conversation**.

---

## ⚙️ DirectMessage
Stores individual private messages.

| Field | Type | Description |
|--------|------|--------------|
| sender | FK(User) | Sender of message |
| receiver | FK(User) | Receiver of message |
| content | TextField | Message text |
| timestamp | DateTime | When message was sent |
| is_read | Boolean | Read status |
| conversation | FK(Conversation) | Parent conversation |

---

## ⚙️ Conversation
Represents unique 1-on-1 chat thread.

| Field | Type | Description |
|--------|------|--------------|
| user1 | FK(User) | Participant A |
| user2 | FK(User) | Participant B |
| created_at | DateTime | Created timestamp |

---

## 💡 Developer Insights
- Deterministic `conversation_id` ensures both users resolve same chat.
- All queries sorted by `timestamp` ascending.
- Supports relational joins through `conversation.messages.all()`. 

---
