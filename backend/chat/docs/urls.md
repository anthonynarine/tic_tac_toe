# 🧩 Module: urls.py

## 📘 Purpose
Provides REST API routes for message retrieval and conversation lookup.

---

## ⚙️ Endpoints

| Route | Method | Description |
|--------|---------|-------------|
| `/conversations/<int:conversation_id>/messages/` | GET | Fetch all messages in conversation |
| `/conversation-with/<int:friend_id>/` | GET | Retrieve or create conversation between two users |

---

## 💡 Developer Insights
- Complements WebSocket flow for persistence and recovery.
- Allows frontend to load historical messages before opening WebSocket. 

---
