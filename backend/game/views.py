from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
import logging

from .models import TicTacToeGame
from .serializers import TicTacToeGameSerializer
from .ai_logic.ai_logic import get_best_move

User = get_user_model()
logger = logging.getLogger(__name__)
class TicTacToeGameViewSet(viewsets.ModelViewSet):
    """
    ViewSet for creating, joining, and updating TicTacToe games.
    Provides operations for managing game instances, such as creating a new game, making a move, and AI interaction.
    """
    queryset = TicTacToeGame.objects.all()
    serializer_class = TicTacToeGameSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        """
        Handle the creation of a new TicTacToe game.
        Automatically set Player X to the requesting user and assign Player O based on input (either AI or another user).
        """
        logger.debug("perform_create called")
        logger.debug(f"Request data received: {self.request.data}")


        # Use the authenticated user from the request as player_x
        player_x = self.request.user
        logger.debug(f"Creating game for Player X: {player_x}")

        if not player_x:
            logger.error("Authenticated user not found.")
            raise ValidationError("Authenticated user not found.")

        # Check if it's an AI game
        is_ai_game = self.request.data.get("is_ai_game", False)

        # If it's an AI game, assign the AI as player_o
        if is_ai_game:
            player_o = User.objects.filter(email="ai@tictactoe.com").first()

            if not player_o:
                logger.error("AI user with email 'ai@tictactoe.com' not found in the database.")
                raise ValidationError("AI user not found.")

            logger.debug(f"AI player_o set: {player_o}")
        else:
            # For multiplayer games, player_o will remain None until another user joins
            player_o = None

        # Save the game with player_x and player_o
        logger.debug(f"Saving game with Player X: {player_x} and Player O: {player_o}")
        game = serializer.save(player_x=player_x, player_o=player_o, is_ai_game=is_ai_game)
        logger.debug("Game saved successfully")

        # Return the serialized game data
        return Response(self.get_serializer(game).data, status=status.HTTP_201_CREATED)

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
        game = self.get_object()
        position = request.data.get("position")
        player = request.user

        logger.debug(f"Player {player} attempting to make a move at position {position}")

        try:
            # Determine the player's marker ('X' or 'O') and call the model's make_move
            player_marker = "X" if player == game.player_x else "O"
            game.make_move(position=int(position), player=player_marker)
        except ValidationError as e:
            logger.error(f"Move failed: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            logger.error("Position must be an integer between 0 and 8.")
            return Response({"error": "Position must be an integer between 0 and 8."}, status=status.HTTP_400_BAD_REQUEST)

        # Return the updated game state
        logger.debug(f"Returning updated game state: {game.board_state}")
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