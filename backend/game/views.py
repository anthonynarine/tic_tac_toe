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

class TicTacToeGameViewsets(viewsets.ModelViewSet):
    """
    ViewSet for creating, joining, and updating TicTacToe games.
    Provides operations for managing game instances, such as creating a new game, making a move, and AI interaction.
    """
    queryset = TicTacToeGame.objects.all()
    serializer_class = TicTacToeGameSerializer
    permission_classes = [IsAuthenticated]  # Temporarily disable authentication

    def perform_create(self, serializer):
        """
        Handle the creation of a new TicTacToe game.
        Automatically set Player X to the requesting user and assign Player O based on input (either AI or another user).
        """
        logger.debug("perform_create called")

        # Use the authenticated user from the request (token) as player_x
        player_x = self.request.user
        logger.debug(f"Creating game for Player X: {player_x}")

        if not player_x:
            logger.error("Authenticated user not found.")
            raise ValidationError("Authenticated user not found.")

        player_o_email = self.request.data.get("player_o")  # Get player_o email from frontend
        is_ai_game = self.request.data.get("is_ai_game", False)

        # Set player_o based on the game type (AI or another player)
        if is_ai_game:
            player_o = User.objects.filter(email="ai@example.com").first()
            logger.debug(f"AI player_o set: {player_o}")
        elif player_o_email:
            try:
                player_o = User.objects.get(email=player_o_email)
                logger.debug(f"Player O found: {player_o}")
            except User.DoesNotExist:
                logger.error(f"Player O with email {player_o_email} does not exist.")
                raise ValidationError(f"Player O with email {player_o_email} does not exist.")
        else:
            player_o = None

        # Save the game with player_x and player_o
        logger.debug(f"Saving game with Player X: {player_x} and Player O: {player_o}")
        serializer.save(player_x=player_x, player_o=player_o)
        logger.debug("Game saved successfully")

    @action(detail=True, methods=["post"])
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

    def update(self, request, *args, **kwargs):
        """
        Handle making a move in the game and, if applicable, trigger an AI move.
        
        Args:
            request (HttpRequest): The request containing the position to move.
        """
        logger.debug("update called")
        game = self.get_object()
        position = request.data.get("position")
        player = request.user

        logger.debug(f"Player {player} attempting to make a move at position {position}")

        # Check if it's the player's turn
        if (game.current_turn == "X" and player == game.player_x) or (game.current_turn == "O" and player == game.player_o):
            try:
                # Validate position
                position = int(position)
                if not 0 <= position <= 8 or game.board_state[position] != '_':
                    logger.error("Invalid position or cell is not empty.")
                    return Response({"error": "Invalid position or cell is not empty."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                logger.error("Position must be an integer between 0 and 8.")
                return Response({"error": "Position must be an integer between 0 and 8."}, status=status.HTTP_400_BAD_REQUEST)

            # Make the player's move
            game.make_move(position, "X" if player == game.player_x else "O")
            game.save()
            logger.debug(f"Move made at position {position} by player {player}")

            # Check if the game is over after the player's move
            game.check_winner()
            if game.winner:
                logger.debug(f"Game over. Winner: {game.winner}")
                return Response(self.get_serializer(game).data)  # Return the result if the game is over

            # Check if the AI should make a move (for AI games only)
            if game.player_o and game.player_o.email == "ai@example.com" and game.current_turn == "O":
                logger.debug("AI making a move")
                ai_move = get_best_move(game, "X", "O")
                if ai_move is not None:
                    game.make_move(ai_move, "O")  # AI makes its move
                    game.save()
                    logger.debug(f"AI made a move at position {ai_move}")

                # Check if the game is over after the AI's move
                game.check_winner()
                if game.winner:
                    logger.debug(f"Game over. Winner: {game.winner}")
                    return Response(self.get_serializer(game).data)  # Return the result if the AI has won or drawn

            # Return the updated game state
            return Response(self.get_serializer(game).data)
        else:
            logger.error("It's not the player's turn")
            return Response({"error": "It's not your turn"}, status=status.HTTP_400_BAD_REQUEST)
