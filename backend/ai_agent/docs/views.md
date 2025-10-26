# 🧩 Module: views.py

## 📘 Purpose
Defines the REST API endpoint that connects frontend questions to the LangChain backend agent.

---

## ⚙️ Endpoint Overview
**POST /api/ai_agent/trinity/**

### Request Example
```json
{
  "question": "How does the multiplayer WebSocket system work?"
}
```

### Response Example
```json
{
  "answer": "The multiplayer system uses Django Channels and Redis..."
}
```

---

## 🧠 Flow Summary
1. Receives JSON payload with `"question"`.
2. Calls `get_agent()` to fetch (or build) the LangChain agent.
3. Runs `agent.run(question)` to get an intelligent answer.
4. Returns response or error message.

---

## 🧱 Error Handling
- Returns `400` if `question` is missing.
- Returns `500` if LangChain or OpenAI raises exceptions.
- Logs all errors and request data for debugging.

---

## 💡 Developer Insights
- Built with Django REST Framework’s `APIView`.
- Uses `AllowAny` permissions for easy testing.
- Can be secured later with authentication tokens or JWTs.

---
