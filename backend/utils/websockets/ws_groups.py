# Filename: utils/ws_groups.py

def scoped_lobby_id(game_type: str, lobby_id) -> str:
    """
    Builds a game-type-scoped lobby id so TicTacToeGame and ConnectFourGame
    (separate tables with independent auto-increment PKs) never collide in
    Redis keys or Channels group names.

    Note: uses "-" (not ":") as the separator — Channels group names must
    match ^[a-zA-Z0-9\\-_.]+$, which excludes colons.
    """
    return f"{game_type}-{lobby_id}"


def lobby_group(lobby_id: str) -> str:
    # Pre-game control plane: session / roster / start
    return f"lobby_{lobby_id}"

def game_group(game_id: str) -> str:
    # In-game state: moves / game_update / timers
    return f"game_{game_id}"

def chat_lobby_group(lobby_id: str) -> str:
    # Lobby chat (if you use group_send for chat)
    return f"chat_lobby_{lobby_id}"
