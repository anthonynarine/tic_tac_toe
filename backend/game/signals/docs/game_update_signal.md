# 📘 game_update_signal.py
Triggers broadcast updates on move save.
**Runtime Flow:** Game save → Signal → Redis → Consumers → Frontend.
