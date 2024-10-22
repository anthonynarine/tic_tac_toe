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

        # check if it's an AI game
        is_ai_game = self.request.data.get("is_ai_game", False)

        # If it's an AI game, asign the AI as player_o (make sure to add tis player in the production db)
        if is_ai_game:
            player_o = User.objects.filter(email="ai@tictactoe.com").first()
            
            if not player_o:
                logger.error("AI user with email 'ai@tictactoe.com' not found in the database.")
                raise ValidationError("AI user not found.")
                
            logger.debug(f"AI player_o set: {player_o}")
        else:
        # For multiplayer games, player_o will remain None until anoter user joins
            player_o = None

        # Save the game with player_x and player_o
        logger.debug(f"Saving game with Player X: {player_x} and Player O: {player_o}")
        game = serializer.save(player_x=player_x, player_o=player_o, is_ai_game=is_ai_game)
        logger.debug("Game saved successfully")
        
        return Response(self.get_serializer(game).data, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=["post"], url_path="move")
    def make_move(self, request, pk=None):
        """
        Custom action to handle making a move in the game and triggering an AI move if applicable.
        The URL for this action will be /games/<game_id>/move/
        """
        logger.debug("make_move called")
        game = self.get_object()
        position = request.data.get("position")
        player = request.user

        logger.debug(f"Player {player} attempting to make a move at position {position}")

        # Check if it's the player's turn and that the game is not already over
        if (game.current_turn == "X" and player == game.player_x) or (game.current_turn == "O" and player == game.player_o):
            try:
                # Validate position (ensure it's within bounds and the cell is empty)
                position = int(position)
                if not 0 <= position <= 8 or game.board_state[position] != '_':
                    logger.error("Invalid position or cell is not empty.")
                    return Response({"error": "Invalid position or cell is not empty."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                logger.error("Position must be an integer between 0 and 8.")
                return Response({"error": "Position must be an integer between 0 and 8."}, status=status.HTTP_400_BAD_REQUEST)

            # Log board state before the player's move
            logger.debug(f"Board state before move: {game.board_state}")

            # Make the player's move
            game.make_move(position, "X" if player == game.player_x else "O")
            
            # Log board state after the player's move
            logger.debug(f"Board state after player's move: {game.board_state}")

            # Check if the game is over after the player's move
            game.check_winner()
            if game.winner:
                logger.debug(f"Game over. Winner: {game.winner}")
                return Response(self.get_serializer(game).data)  # Return the result if the game is over

            # Step # 2: Handle AI's Move (if applicable)
            if game.is_ai_game and game.current_turn == "O":
                logger.debug("AI making a move")
                ai_move = self.handle_ai_move(game)  # AI logic separated into its own function

                # Log the returned game state after AI move
                logger.debug(f"Board state after AI's move: {game.board_state}")
                return Response(ai_move)

            # Return the updated game state after the player's move
            logger.debug(f"Returning game state to frontend: {game.board_state}")
            return Response(self.get_serializer(game).data)

        else:
            logger.error("It's not the player's turn")
            return Response({"error": "It's not your turn"}, status=status.HTTP_400_BAD_REQUEST)

    
    def handle_ai_move(self, game):
        """
        AI move handler. This method is called after the player's move if the game is against the AI.
        """
        if game.winner:
            logger.debug("Game already over, AI cannot make a move.")
            return self.get_serializer(game).data

        ai_move = get_best_move(game, "X", "O")
        if ai_move is not None:
            logger.debug(f"AI is making a move at position {ai_move}")
            game.make_move(ai_move, "O")  # AI makes its move
            
            # Check if the game is over after the AI's move
            game.check_winner()
            
            if game.winner:
                logger.debug(f"Game over after AI move. Winner: {game.winner}")
            else:
                # Only switch turn back to player if no winner
                game.current_turn = "X"
                game.save()

        return self.get_serializer(game).data



            
    @action(detail=True, methods=["post"], url_path="reset")
    def reset_game(self, request, pk=None):
        logger.debug("reset_game called")
        game = self.get_object()

        # Reset the game to its initial state
        game.board_state = "_________"  # Reset the board to empty state
        game.current_turn = "X"  # Reset the current turn to Player X
        game.winner = None  # Clear the winner
        game.winning_combination = None  # Clear any winning combination
        game.save()
        
        logger.debug(f"Game {game.id} has been reset")

        return Response(self.get_serializer(game).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="open-games")
    def list_open_games(self, request):
        open_games = TicTacToeGame.objects.filter(player_o__isnull=True, winner__isnull=True, is_ai_game=False)
        serializer = self.get_serializer(open_games, many=True)
        return Response(serializer.data)
