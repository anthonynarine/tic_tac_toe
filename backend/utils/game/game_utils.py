import random
from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import BaseChannelLayer
from game.models import TicTacToeGame, DEFAULT_BOARD_STATE
from users.models import CustomUser
import logging

logger = logging.getLogger(__name__)


class GameUtils:
    """
    Utility class for managing game-specific database operations
    such as fetching game instances, randomizing turns, and creating games.
    """

    @staticmethod
    def get_game_instance(game_id: int):
        """Retrieve a game instance by ID or raise an error."""
        try:
            return TicTacToeGame.objects.get(id=game_id)
        except TicTacToeGame.DoesNotExist:
            raise ValueError(f"Game with ID {game_id} does not exist")

    @staticmethod
    async def async_get_game_intance(game_id: int):
        """Async version of get_game_instance."""
        try:
            return await sync_to_async(TicTacToeGame.objects.get)(id=game_id)
        except TicTacToeGame.DoesNotExist:
            raise ValueError(f"Game with ID {game_id} does not exist")

    @staticmethod
    def randomize_turn(players: list) -> tuple:
        """
        Randomly selects a starting player and assigns roles (X/O).

        Args:
            players (list): List of player dicts with "id" and "first_name".

        Returns:
            tuple: (starting_turn, player_x_dict, player_o_dict)
        """
        if len(players) != 2:
            raise ValueError("Exactly two players are required to start the game.")

        starting_turn = random.choice(["X", "O"])
        if starting_turn == "X":
            player_x, player_o = players[0], players[1]
        else:
            player_x, player_o = players[1], players[0]

        logger.debug(f"Randomized starting turn: {starting_turn}")
        return starting_turn, player_x, player_o

    @staticmethod
    def create_game(player_x_id: int, player_o_id: int, starting_turn: str) -> TicTacToeGame:
        """Create a new TicTacToe game record."""
        try:
            player_x = CustomUser.objects.get(id=player_x_id)
            player_o = CustomUser.objects.get(id=player_o_id)
        except CustomUser.DoesNotExist as e:
            raise ValueError(f"Player not found: {e}")

        game = TicTacToeGame.objects.create(
            player_x=player_x,
            player_o=player_o,
            current_turn=starting_turn,
            board_state=DEFAULT_BOARD_STATE,
            is_ai_game=False
        )
        return game

    @staticmethod
    def initialize_game(game_id: int, player_x: dict, player_o: dict, starting_turn: str) -> TicTacToeGame:
        """Update an existing game with the given player data and turn info."""
        try:
            player_x_instance = CustomUser.objects.get(pk=player_x["id"])
            player_o_instance = CustomUser.objects.get(pk=player_o["id"])
        except CustomUser.DoesNotExist as e:
            raise ValueError(f"User does not exist: {e}")

        try:
            game = TicTacToeGame.objects.get(id=game_id)
            game.player_x = player_x_instance
            game.player_o = player_o_instance
            game.current_turn = starting_turn
            game.board_state = DEFAULT_BOARD_STATE
            game.save()
        except TicTacToeGame.DoesNotExist as e:
            raise ValueError(f"Game does not exist: {e}")

        return game

    @staticmethod
    def get_ai_user() -> CustomUser:
        """Return the AI user instance (or None if not found)."""
        ai_user = CustomUser.objects.filter(email="ai@tictactoe.com").first()
        if not ai_user:
            logger.warning("AI user with email ai@tictactoe.com does not exist.")
        return ai_user

    @staticmethod
    def determine_player_role(user: CustomUser, game: TicTacToeGame) -> str:
        """
        Determine the role of the user in the game (X, O, or Spectator).

        Note: Redis-based lobbies should use RedisGameLobbyManager.assign_player_role()
        instead of this method.

        Returns:
            str: One of "X", "O", or "Spectator".
        """
        if not game.player_x or not game.player_o:
            logger.warning("Game is incomplete; waiting for players to join.")
            return "Spectator"

        if user == game.player_x:
            return "X"
        elif user == game.player_o:
            return "O"
        return "Spectator"

    @staticmethod
    def serialize_game_state(game) -> dict:
        """
        Step 1: Return a stable, client-safe snapshot of game state.
        Step 2: Keep keys consistent across versions.
        Step 3: Do NOT include secrets or server-only fields.
        """
        # Adjust field names below to match your Game model.
        # These getattr calls make it resilient if you refactor model fields later.
        board = getattr(game, "board", None)
        current_turn = getattr(game, "current_turn", None)
        winner = getattr(game, "winner", None)
        status = getattr(game, "status", None)

        # Optional extras if they exist in your model
        is_completed = getattr(game, "is_completed", None)
        winning_line = getattr(game, "winning_line", None)

        return {
            "board": board,
            "currentTurn": current_turn,
            "winner": winner,
            "status": status,
            "isCompleted": is_completed,
            "winningLine": winning_line,
        }