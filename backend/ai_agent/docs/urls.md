# 🧩 Module: urls.py

## 📘 Purpose
Defines URL routing for the AI Agent endpoints.

---

## ⚙️ Endpoint
| Path | View | Name |
|------|------|------|
| `/trinity/` | `AskAgentView.as_view()` | `trinity-agent` |

---

## 💡 Developer Insights
- Simple, isolated routing — keeps AI agent modular.
- Can easily be extended to multiple endpoints (e.g., `/train/`, `/status/`).

---
