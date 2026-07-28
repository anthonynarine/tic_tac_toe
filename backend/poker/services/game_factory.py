import random
from typing import Optional, TypedDict

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import ValidationError

from poker.models import PokerGame

User = get_user_model()


class CreateGameResult(TypedDict):
    game: PokerGame
    player_role: str


@transaction.atomic
def create_poker_game(
    *,
    creator_user,
    is_ai_game: bool,
    opponent_user: Optional[User] = None,
) -> CreateGameResult:
    if not creator_user or not getattr(creator_user, "id", None):
        raise ValidationError({"detail": "Authenticated user is missing."})

    game = PokerGame.objects.create(
        player_one=creator_user,
        player_two=opponent_user,
        is_ai_game=is_ai_game,
        dealer=random.choice([1, 2]) if opponent_user else 1,
    )
    if opponent_user:
        game.ensure_dealt()
    return {"game": game, "player_role": "X"}
