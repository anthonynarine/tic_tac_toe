
# Step 1: Standard libs
import random
from typing import Optional, TypedDict

# Step 2: Django imports
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import ValidationError

# Step 3: Local imports
from game.models import TicTacToeGame, DEFAULT_BOARD_STATE

User = get_user_model()


class CreateGameResult(TypedDict):
    game: TicTacToeGame
    player_role: str


@transaction.atomic
def create_tictactoe_game(
    *,
    creator_user,
    is_ai_game: bool,
    opponent_user: Optional[User] = None,
) -> CreateGameResult:
    """
    Create a TicTacToe game in a server-authoritative way.

    Args:
        creator_user: Authenticated user creating the game (Player X).
        is_ai_game: Whether the opponent is AI.
        opponent_user: Required for invite-created multiplayer games. The receiver becomes Player O.

    Returns:
        CreateGameResult: dict containing the created game and creator player's role.
    """
    # Step 1: Validate creator
    if not creator_user or not getattr(creator_user, "id", None):
        raise ValidationError({"detail": "Authenticated user is missing."})

    # Step 2: Resolve Player O
    ai_user = None
    if is_ai_game:
        ai_user = User.objects.filter(email="ai@tictactoe.com").first()
        if not ai_user:
            raise ValidationError(
                {"detail": "AI user (ai@tictactoe.com) is missing. Create it in the DB."}
            )
        player_o = ai_user
    else:
        # Phase 1 multiplayer:
        # - Normal create endpoint (non-invite) can leave player_o empty (join later)
        # - Invite-created game should reserve player_o immediately
        player_o = opponent_user

    # Step 3: Create game
    randomized_turn = random.choice(["X", "O"])

    game = TicTacToeGame.objects.create(
        player_x=creator_user,
        player_o=player_o,
        is_ai_game=is_ai_game,
        board_state=DEFAULT_BOARD_STATE,
        current_turn=randomized_turn,
        winner=None,
        is_completed=False,
    )

    # Step 4: AI first move if AI starts
    if is_ai_game and game.current_turn in ["X", "O"]:
        ai_is_x = game.current_turn == "X" and game.player_x_id == ai_user.id
        ai_is_o = game.current_turn == "O" and game.player_o_id == ai_user.id
        if ai_is_x or ai_is_o:
            game.handle_ai_move()
            game.refresh_from_db()

    # Step 5: Creator role
    player_role = "X"

    return {"game": game, "player_role": player_role}
