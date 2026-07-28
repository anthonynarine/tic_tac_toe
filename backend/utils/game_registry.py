# Filename: utils/game_registry.py
"""
Central per-game-type registry used by the invites app and the lobby
consumer so neither has to hardcode TicTacToe-specific model/field names.

Adding a new invite-capable game type means adding one entry here (plus a
create_<game>_game factory function following the same signature/return
shape as the existing ones) -- no changes needed in invites/views.py,
invites/serializers.py, or lobby/lobby_consumer.py.
"""

from django.apps import apps

from game.services.game_factory import create_tictactoe_game
from connect_four.services.game_factory import create_connect_four_game
from checkers.services.game_factory import create_checkers_game

GAME_TYPE_REGISTRY = {
    "tic_tac_toe": {
        "app_label": "game",
        "model_name": "TicTacToeGame",
        "create_fn": create_tictactoe_game,
        # seat label ("X"/"O") -> model FK field name
        "seat_fk_names": {"X": "player_x", "O": "player_o"},
        # seat label -> value to store in current_turn
        "turn_values": {"X": "X", "O": "O"},
    },
    "connect_four": {
        "app_label": "connect_four",
        "model_name": "ConnectFourGame",
        "create_fn": create_connect_four_game,
        "seat_fk_names": {"X": "player_one", "O": "player_two"},
        "turn_values": {"X": 1, "O": 2},
    },
    "checkers": {
        "app_label": "checkers",
        "model_name": "CheckersGame",
        "create_fn": create_checkers_game,
        "seat_fk_names": {"X": "player_one", "O": "player_two"},
        "turn_values": {"X": 1, "O": 2},
    },
}


def get_game_type_config(game_type: str):
    """Returns the registry config for game_type, or None if unknown."""
    return GAME_TYPE_REGISTRY.get(game_type)


def get_model_for(game_type: str):
    """Returns the Django model class for game_type, or None if unknown."""
    cfg = get_game_type_config(game_type)
    if not cfg:
        return None
    return apps.get_model(cfg["app_label"], cfg["model_name"])
