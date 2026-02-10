
# Filename: utils/ws_groups.py

def lobby_group(lobby_id: str) -> str:
    # Pre-game control plane: session / roster / start
    return f"lobby_{lobby_id}"

def game_group(game_id: str) -> str:
    # In-game state: moves / game_update / timers
    return f"game_{game_id}"

def chat_lobby_group(lobby_id: str) -> str:
    # Lobby chat (if you use group_send for chat)
    return f"chat_lobby_{lobby_id}"
