import random
from typing import Optional, TypedDict

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import ValidationError

from connect_four.models import ConnectFourGame, EMPTY_BOARD

User = get_user_model()


class CreateGameResult(TypedDict):
    game: ConnectFourGame
    player_role: str


@transaction.atomic
def create_connect_four_game(
    *,
    creator_user,
    is_ai_game: bool,
    opponent_user: Optional[User] = None,
) -> CreateGameResult:
    """
    Create a Connect Four game in a server-authoritative way, mirroring
    game.services.game_factory.create_tictactoe_game.

    Args:
        creator_user: Authenticated user creating the game (seat "X" / player_one).
        is_ai_game: Whether the opponent is AI (handled by the existing
            connect_four AI creation path; kept here only for signature parity).
        opponent_user: Required for invite-created multiplayer games. The
            receiver becomes player_two (seat "O").

    Returns:
        CreateGameResult: dict containing the created game and creator's seat label.
    """
    if not creator_user or not getattr(creator_user, "id", None):
        raise ValidationError({"detail": "Authenticated user is missing."})

    game = ConnectFourGame.objects.create(
        player_one=creator_user,
        player_two=opponent_user,
        is_ai_game=is_ai_game,
        board=EMPTY_BOARD,
        current_turn=random.choice([1, 2]),
        winner=None,
        is_completed=False,
    )

    return {"game": game, "player_role": "X"}
