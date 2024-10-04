from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import TicTacToeGame
from .serializers import TicTacToeGameSerializer
from django.contrib.auth import get_user_model
from rest_framework.decorators import action
from .ai_logic.ai_logic import get_best_move
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

class TicTacToeGameViewsets(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing TicTacToeGame instances.

    Provides operations to create a new game, retrieve details, and make moves in the game.
    """
    queryset = TicTacToeGame.objects.all()
    serializer_class = TicTacToeGameSerializer
    permission_classes = [IsAuthenticated]

def perform_create(self, serializer):
    logger.debug("Entered perform_create method")  
    logger.debug("Request headers: %s", self.request.headers.get('Authorization'))  # Log the token being sent

    """
    Automatically set player_x (the requesting user) and player_o (provided via email or AI).
    """
    player_x = self.request.user  # The user creating the game is assigned as player_x
    logger.debug("Request user: %s", self.request.user)  # Log the user making the request
    player_o_email = self.request.data.get("player_o")  # Email for player_o if specified
    is_ai_game = self.request.data.get("is_ai_game", False)

    if is_ai_game:
        # Assign AI as player_o if it's an AI game
        player_o = User.objects.filter(email="ai@example.com").first()  # Ensure AI user exists
    elif player_o_email:
        try:
            player_o = User.objects.get(email=player_o_email)  # Get player_o by email
        except User.DoesNotExist:
            return Response({"error": "Player O does not exist"}, status=status.HTTP_400_BAD_REQUEST)
    else:
        player_o = None  # Wait for a second player if not provided

    # Save the game with player_x and player_o (if provided)
    serializer.save(player_x=player_x, player_o=player_o)



@action(detail=True, methods=["post"])
def join_game(self, request, pk=None):
    """
    Allow a second player to join a game that has an open spot.
    """
    game = self.get_object()
    if game.player_o:
        return Response({"error": "Game already has two players"}, status=status.HTTP_400_BAD_REQUEST)

    game.player_o = request.user  # Requesting player becomes player_o
    game.save()

    return Response(self.get_serializer(game).data)

def update(self, request, *args, **kwargs):
    """
    Handle making a move in the game and, if applicable, trigger AI move.

    Args:
        request (HttpRequest): The request containing the position to move. 
    """
    game = self.get_object()
    position = request.data.get("position")
    player = request.user

    # Check if it's the player's turn
    if (game.current_turn == "X" and player == game.player_x) or (game.current_turn == "O" and player == game.player_o):
        try:
            position = int(position)
            if not 0 <= position <= 8 or game.board_state[position] != '_':
                return Response({"error": "Invalid position or cell is not empty."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "Position must be an integer between 0 and 8."}, status=status.HTTP_400_BAD_REQUEST)

        # Make the player's move
        game.make_move(position, "X" if player == game.player_x else "O")
        game.save()

        # Check if the game is over after the player's move
        game.check_winner()
        if game.winner:
            return Response(self.get_serializer(game).data)  # Return the result if the game is over

        # Check if the AI should make a move (for AI games only)
        if game.player_o and game.player_o.email == "ai@example.com" and game.current_turn == "O":  # AI email check
            ai_move = get_best_move(game, "X", "O")
            if ai_move is not None:
                game.make_move(ai_move, "O")  # AI makes its move
                game.save()

            # Check if the game is over after the AI's move
            game.check_winner()
            if game.winner:
                return Response(self.get_serializer(game).data)  # Return the result if the AI has won or drawn

        # Return the updated game state
        return Response(self.get_serializer(game).data)
    else:
        return Response({"error": "It's not your turn"}, status=status.HTTP_400_BAD_REQUEST)

