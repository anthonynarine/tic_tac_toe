from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from django.db import transaction
import logging

from .models import TicTacToeGame
from .serializers import TicTacToeGameSerializer
from .ai_logic.ai_logic import get_best_move
from .services.game_factory import create_tictactoe_game
from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager

User = get_user_model()
logger = logging.getLogger(__name__)
logger.warning("This is a manual log line from views.py — should appear when server starts")
class TicTacToeGameViewSet(viewsets.ModelViewSet):
    """
    ViewSet for creating, joining, and updating TicTacToe games.
    Provides operations for managing game instances, such as creating a new game, making a move, and AI interaction.
    """
    queryset = TicTacToeGame.objects.all()
    serializer_class = TicTacToeGameSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        # Step 1: Validate request data shape
        if not isinstance(request.data, dict):
            raise ValidationError({"detail": "Invalid request data."})

        # Step 2: Determine AI mode
        is_ai_game = bool(request.data.get("is_ai_game", False))

        # Step 3: Create game via service
        result = create_tictactoe_game(
            creator_user=request.user,
            is_ai_game=is_ai_game,
            opponent_user=None,
        )
        game = result["game"]
        player_role = result["player_role"]

        # Step 4: Serialize + add player_role (preserve response contract)
        data = self.get_serializer(game).data
        data["player_role"] = player_role

        # Step 5: Mint sessionKey only for MULTIPLAYER (WS games)
        if not is_ai_game:
            lobby_id = str(game.id)
            manager = RedisGameLobbyManager()

            # Step 5a: Create/ensure sessionKey
            session_key = manager.ensure_session_key(lobby_id)

            # Step 5b: Allow-list creator in this lobby session
            manager.add_user_to_session(lobby_id, request.user.id)

            # Step 5c: Include join hints for frontend routing
            data["lobbyId"] = lobby_id
            data["sessionKey"] = session_key

        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="join")
    def join_game(self, request, pk=None):
        """
        Allow a second player to join a game that has an open spot.
        """
        logger.debug("join_game called")
        game = self.get_object()

        # Check if player_o is already set
        if game.player_o:
            logger.error("Game already has two players")
            return Response({"error": "Game already has two players"}, status=status.HTTP_400_BAD_REQUEST)

        # Assign the requesting user as player_o
        game.player_o = request.user
        game.save()
        logger.debug(f"Player O joined the game: {game.player_o}")

        return Response(self.get_serializer(game).data)

    @action(detail=True, methods=["post"], url_path="move")
    def make_move(self, request, pk=None):
        """
        Handles a move in the game.
        The URL for this action is /api/games/<game_id>/move/.

        Workflow:
            1. Extract the position from the request data.
            2. Determine the current player based on the requesting user.
            3. Delegate the move-making logic to the model's `make_move` method.
            4. Handle any errors and return the updated game state.
        """
        logger.debug("make_move called")

        # Retrieve the game instance
        game = self.get_object()
        logger.debug(f"Game object retrieved: {game}")

        # Extract the position and player details from the request
        position = request.data.get("position")
        player = request.user
        logger.debug(f"Player {player} attempting to make a move at position {position}")

        try:
            # Determine the player's marker ('X' or 'O') and call the model's make_move
            player_marker = "X" if player == game.player_x else "O"
            logger.debug(f"Player marker determined: {player_marker}")

            # Make the move
            game.make_move(position=int(position), player=player_marker) # moake move model func
            logger.debug(f"Move made successfully: Board state = {game.board_state}")
            
            # trigger AI move if it's an AI game and it's the AI's turn
            if game.is_ai_game and game.current_turn == ("X" if game.player_x.email == "ai@tictactoe.com" else "O"):
                logger.debug("Triggering AI move after human move.")
                game.handle_ai_move()

        except ValidationError as e:
            logger.error(f"Move failed: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except ValueError:
            logger.error("Position must be an integer between 0 and 8.")
            return Response({"error": "Position must be an integer between 0 and 8."}, status=status.HTTP_400_BAD_REQUEST)

        # Log the game's `is_ai_game` field and the serialized data
        logger.debug(f"is_ai_game value: {game.is_ai_game}")
        logger.debug(f"Serialized game data to be returned: {self.get_serializer(game).data}")

        # Return the updated game state
        return Response(self.get_serializer(game).data)

    @action(detail=True, methods=["post"], url_path="reset")
    def reset_game(self, request, pk=None):
        """
        Resets the game to its initial state.
        The URL for this action is /api/games/<game_id>/reset/.
        """
        logger.debug("reset_game called")
        game = self.get_object()

        # Reset the game to its initial state
        game.board_state = "_________"  # Reset the board to empty state
        game.current_turn = "X"         # Reset the current turn to Player X
        game.winner = None              # Clear the winner
        # Removed: game.winning_combination = None  # This field doesn't exist in the model
        game.save()

        logger.debug(f"Game {game.id} has been reset")

        return Response(self.get_serializer(game).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="open-games")
    def list_open_games(self, request):
        """
        Lists all open multiplayer games that have no Player O and no winner yet.
        """
        open_games = TicTacToeGame.objects.filter(player_o__isnull=True, winner__isnull=True, is_ai_game=False)
        serializer = self.get_serializer(open_games, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"], url_path="complete")
    def complete_game(self, request, pk=None):
        """
        Marks the game as completed and updates the user's gaming stats.
        The URL for this action is /api/games/<game_id>/complete/.
        """
        logger.debug("complete_game called")

        game = self.get_object()

        # Step 2: Prevent duplicate completion
        if game.is_completed:
            logger.info(f"Game {game.id} is already completed. Skipping update.")
            return Response({"detail": "Game is already completed."}, status=status.HTTP_200_OK)

        # Step 3: Validate the winner marker
        winner_marker = request.data.get("winner")
        VALID_WINNER_MARKERS = ["X", "O", "D"]

        if winner_marker not in VALID_WINNER_MARKERS:
            logger.error(f"Invalid winner marker received: {winner_marker}")
            return Response(
                {"error": "Winner marker must be 'X', 'O', or 'D' (Draw)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.debug(f"Winner marker received: {winner_marker}")

        # Ensure atomic updates
        try:
            with transaction.atomic():
                # Update stats for Player X
                if game.player_x:
                    game.player_x.total_games_played += 1

                    if winner_marker == "X":
                        game.player_x.wins += 1
                    elif winner_marker == "O":
                        game.player_x.losses += 1

                    game.player_x.save()
                    logger.debug(f"Player X stats updated: {game.player_x}")

                # Update stats for Player O
                if game.player_o and game.player_o.email != "ai@tictactoe.com":
                    game.player_o.total_games_played += 1

                    if winner_marker == "O":
                        game.player_o.wins += 1
                    elif winner_marker == "X":
                        game.player_o.losses += 1

                    game.player_o.save()
                    logger.debug(f"Player O stats updated: {game.player_o}")

                # Mark the game as completed
                game.winner = winner_marker
                game.is_completed = True
                game.save()
                logger.debug(f"Game {game.id} marked as completed with winner: {winner_marker}")

        except Exception as e:
            logger.error(f"Failed to complete game transaction: {e}")
            return Response({"error": "Failed to complete the game."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Return success response
        return Response(
            {
                "message": "Game marked as completed successfully.",
                "game": self.get_serializer(game).data
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"], url_path="start")
    def start_game(self, request, pk=None):
        """
        Marks the game as ready to start and validates the lobby state.
        The URL for this action is /api/games/<game_id>/start/.
        """
        logger.debug("start_game called")
        
        # Retrieve the game instance
        game = self.get_object()
        
        # Validate that the game has both players
        if not game.player_x or not game.player_o:
            logger.error("Cannot start game: Missing players.")
            return Response(
                {"error": "Both players must be present to start the game."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate that the game hasn't already started
        if game.board_state != "_________":  # Ensure the board is in the initial state
            logger.error("Cannot start game: Game has already started.")
            return Response(
                {"error": "Game has already started."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log the transition to the started state
        logger.info(f"Game {game.id} is now starting. Players: {game.player_x} (X) and {game.player_o} (O).")
        
            # Return the updated game data to indicate it's ready to start
        return Response(
            self.get_serializer(game).data,
            status=status.HTTP_200_OK
        )
