from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
import logging
import random

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
        Randomly assign Player X to either the human or the AI (if it's an AI game).
        If the AI starts as Player X, make its first move automatically.
        """
        logger.debug("perform_create called")
        logger.debug(f"Request data received: {self.request.data}")

        # Use the authenticated user from the request as one of the players
        player_x = self.request.user
        logger.debug(f"Creating game for Player X: {player_x}")

        if not player_x:
            logger.error("Authenticated user not found.")
            raise ValidationError("Player X (authenticated user) is missing.")

        # Check if it's an AI game and cast to boolean
        is_ai_game = bool(self.request.data.get("is_ai_game", False))

        # If it's an AI game, assign the AI as one of the players
        player_o = None
        if is_ai_game:
            player_o = User.objects.filter(email="ai@tictactoe.com").first()
            if not player_o:
                logger.error("AI user with email 'ai@tictactoe.com' not found in the database.")
                raise ValidationError("AI user (Player O) is missing.")
            logger.debug(f"AI player_o set: {player_o}")

        # Randomize the starting player
        ai_starts = is_ai_game and random.choice([True, False])  # AI starts if random choice is True
        if ai_starts:
            player_x, player_o = player_o, player_x  # Swap roles if AI starts
            logger.debug("Randomized Player X to AI and Player O to human.")
        else:
            logger.debug("Player X remains the human player.")

        # Initialize default game state
        logger.debug("Initializing default game state for new game")
        game = serializer.save(
            player_x=player_x,
            player_o=player_o,
            is_ai_game=is_ai_game,
            board_state="_________",  # Ensure a fresh board
            current_turn="X",         # Ensure Player X starts
            winner=None               # Clear any winner
        )
        logger.debug(f"Game created successfully with ID: {game.id}")

        # Trigger AI's first move if AI is Player X
        if ai_starts:
            logger.debug("AI is Player X. Making the first move.")
            game.handle_ai_move()  # Call the AI logic to make the first move
            logger.debug(f"AI made its move. Updated board state: {game.board_state}")

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

            game.make_move(position=int(position), player=player_marker)
            logger.debug(f"Move made successfully: Board state = {game.board_state}")

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
        
        # Step 1: Retrieve the game instance using the primary key from the URL
        game = self.get_object()
        
        # Step 2: Extract the winner's marker ('X' or 'O') from the request data
        winner_marker = request.data.get("winner")
        if not winner_marker:
            logger.error("Winner marker not provided")
            return Response(
                {"error": "Winner marker must be provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.debug(f"Winner marker received: {winner_marker}")
        
        # Step 3: Update stats for Player X (if they exist)
        if game.player_x:
            game.player_x.total_games_played += 1  # Increment total games played for Player X
            
            # Increment Player X's wins or losses based on the winner
            if winner_marker == "X":
                game.player_x.wins += 1
            elif winner_marker == "O":
                game.player_x.losses += 1
            
            # Save the updated Player X stats to the database
            game.player_x.save()
        
        # Step 4: Update stats for Player O (if they exist and are not AI)
        if game.player_o and game.player_o.email != "ai@tictactoe.com":  # Ignore AI stats
            game.player_o.total_games_played += 1  # Increment total games played for Player O
            
            # Increment Player O's wins or losses based on the winner
            if winner_marker == "O":
                game.player_o.wins += 1
            elif winner_marker == "X":
                game.player_o.losses += 1
            
            # Save the updated Player O stats to the database
            game.player_o.save()
        
        # Step 5: Mark the game as completed by setting the winner field
        game.winner = winner_marker
        game.save()
        
        logger.debug(f"Game {game.id} marked as completed with winner: {winner_marker}")
        
        # Step 6: Return the updated game data in the response
        return Response(self.get_serializer(game).data, status=status.HTTP_200_OK)

        