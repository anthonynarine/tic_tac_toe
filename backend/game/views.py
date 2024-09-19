from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import TicTacToeGame
from .serializers import TicTacToeGameSerializer
from django.contrib.auth import get_user_model

User = get_user_model()


class TicTacToeGameViewsets(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing TicTacToeGame instances.

    Provides operations to create a new game, retrieve details, and make moves in the game.
    """
    queryset = TicTacToeGame.objects.all()
    serializer_class = TicTacToeGameSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        """
        Automatically set player_x (the requesting user) and player_o (provided via username) when creating a game. 

        Args:
            serializer (ModelSerializer): The serializer instance used to create the game.

        Returns:
            Response: An error message if player_o does not exist, or proceeds to save the game. 
        """
        player_x = self.request.user  # Corrected typo here
        player_o_username = self.request.data.get("player_o")

        try:
            player_o = User.objects.get(username=player_o_username)
        except User.DoesNotExist:
            return Response({"error": "Player O does not exist"}, status=status.HTTP_400_BAD_REQUEST)

        # Save the game with both players
        serializer.save(player_x=player_x, player_o=player_o)  # Corrected the save call

    def update(self, request, *args, **kwargs):
        """
        Handle making a move in the game.

        Args:
            request (HttpRequest): The request containing the position to move. 
        """
        game = self.get_object()  # get the current game instance
        position = request.data.get("position")  # Get the move position from request data
        player = request.user  # The player making the request

        # Check if it's the player's turn
        if (game.current_turn == "X" and player == game.player_x) or (game.current_turn == "O" and player == game.player_o):
            try:
                # Ensure the position is valid
                position = int(position)
                if not 0 <= position <= 8:
                    return Response({"error": "Position must be an integer between 0 and 8."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({"error": "Invalid position"}, status=status.HTTP_400_BAD_REQUEST)

            # Make the move and save the game
            game.make_move(position, "X" if player == game.player_x else "O")
            game.save()

            # Return the updated game state
            return Response(self.get_serializer(game).data)
        else:
            return Response({"error": "It's not your turn"}, status=status.HTTP_400_BAD_REQUEST)

