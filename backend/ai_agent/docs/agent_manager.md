# 🧩 Module: agent_manager.py

## 📘 Purpose
Manages lifecycle and state of the LangChain agent using a **thread-safe singleton pattern**.  
Ensures the agent is built once and reused across Django requests.

---

## ⚙️ Core Functions

### `get_agent()`
- Checks if `_agent` exists.
- If not, locks the thread and builds a new agent using `build_agent()`.
- Returns the active agent.

### `reset_agent()`
- Forces rebuild (used for debugging or hot reload).

---

## 🧱 Design Notes
- Uses `threading.Lock` to prevent race conditions.
- Global variable `_agent` ensures memory persistence across requests.

---

## 💡 Developer Insights
- Avoids excessive API calls and embedding rebuilds.
- Follows a **lazy initialization** pattern (builds only when needed).

---
