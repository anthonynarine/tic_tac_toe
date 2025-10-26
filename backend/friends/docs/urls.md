# 🧩 Module: urls.py

## 📘 Purpose
Registers REST API routes for the Friends system.

---

## ⚙️ Endpoints
| Route | Description |
|--------|--------------|
| `/friends/` | Core friendship API (send, list, accept, decline) |
| `/friends/pending/` | List pending friend requests |
| `/friends/friends/` | List accepted friends |

---

## 💡 Developer Insights
- Uses DRF’s `DefaultRouter` for clean route generation.
- Works seamlessly with React frontend and JWT auth.

---
