from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from game.ai_logic.ai_logic import get_best_move
import logging

logger = logging.getLogger(__name__)

class TicTacToeGame(models.Model):
    """
    Represents a Tic-Tac-Toe game between two players.
    
    Attributes:
        player_x (ForeignKey): The user who plays as 'X'.
        player_o (ForeignKey): The user who plays as 'O'.
        board_state (CharField): A 9-character string representing the 3x3 game board.
            Each position in the string is either '_', 'X', or 'O'.
        current_turn (CharField): A character indicating whose turn it is ('X' or 'O').
        winner (CharField): A character indicating the winner of the game. It can be 'X', 'O', or 'D' (for draw).
        is_ai_game (BooleanField): Indicates whether the game is being played against an AI.
        created_at (DateTimeField): Timestamp when the game was created.
        updated_at (DateTimeField): Timestamp when the game was last updated.
    """

    player_x = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        related_name="player_x_games",
        on_delete=models.CASCADE,
        help_text="The user who created the game is automatically assigned as Player X."
    )
    player_o = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="player_o_games",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Player O can either be an AI or a second human player. If not provided, the game waits for a second player to join."
    )
    is_ai_game = models.BooleanField(
        default=False,
        help_text="Indicates if the game is played against an AI opponent. "
                "Set to True for AI games and False for multiplayer games."
    )
    board_state = models.CharField(
        max_length=9,
        default="_________",
        help_text="Represents the current state of the 3x3 grid using '_' for empty spots."
    )   
    current_turn = models.CharField(
        max_length=1,
        default="X",
        help_text="Tracks whose turn it is, either 'X' or 'O'."
    ) 
    winner = models.CharField(
        max_length=1,
        null=True, 
        blank=True,
        help_text="Stores the winner of the game: 'X', 'O', or 'D' for draw."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="The time the game was created."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="The last time the game was updated."
    )

    def make_move(self, position, player):
        """
        Executes a move by updating the board state and switching the turn.

        Args:
            position (int): The index (0-8) where the player wants to place their marker.
            player (str): The player making the move ('X' or 'O').

        Raises:
            ValidationError: If the move is invalid (e.g., position is occupied, wrong player's turn, or game over).
        """
        if self.winner:
            raise ValidationError("Invalid move: The game is already over.")

        if not isinstance(position, int) or not (0 <= position < 9):
            raise ValidationError("Invalid move: Position must be an integer between 0 and 8.")

        if self.board_state[position] != "_":
            raise ValidationError("Invalid move: The position is already occupied.")

        if self.current_turn != player:
            raise ValidationError("Invalid move: It's not your turn.")

        # Update the board state with the player's marker
        board = list(self.board_state)
        board[position] = player
        self.board_state = "".join(board)

        # Check for a winner or draw
        self.check_winner()

        if not self.winner:  # If the game is not over, switch turns
            self.current_turn = "O" if player == "X" else "X"

        # Save the updated game state
        self.save()

        # Trigger AI move if applicable
        if self.is_ai_game and self.current_turn == "O":
            self.handle_ai_move()

    def check_winner(self):
        """
        Determines if there is a winner or if the game has ended in a draw.

        Winning conditions:
            - Three markers of the same type ('X' or 'O') appear in a row, column, or diagonal.
            - If no winning condition is met and all cells are filled, the game is declared a draw.

        Logs:
            - The board state being checked.
            - The winner, if found, or a draw condition.

        Updates:
            - Sets `self.winner` to 'X', 'O', or 'D' based on the result.
        """
        logger.debug(f"Checking winner for board state: {self.board_state}")
        
        winning_combinations = [
            (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
            (0, 3, 6), (1, 4, 7), (2, 5, 8),  # columns
            (0, 4, 8), (2, 4, 6)              # diagonals
        ]
        
        for combo in winning_combinations:
            if self.board_state[combo[0]] == self.board_state[combo[1]] == self.board_state[combo[2]] != '_':
                logger.debug(f"Winner found: {self.board_state[combo[0]]} for combination {combo}")
                self.winner = self.board_state[combo[0]]
                return
        
        if "_" not in self.board_state:
            logger.debug("All spaces are filled. Declaring a draw.")
            self.winner = "D"

    def handle_ai_move(self):
        """
        Handles the AI's turn by calculating and applying the optimal move.

        Workflow:
            1. Checks if the game has already ended.
            2. Uses the AI logic (`get_best_move`) to determine the best move for the AI.
            3. Executes the move using the `make_move` method.

        Logs:
            - The AI's chosen position.
            - If the AI cannot find a valid move, the game ends in a draw.
        """
        logger.debug("Handling AI move")
        if self.winner:
            logger.debug("Game already has a winner or is a draw. Cannot make move.")
            return

        ai_move = get_best_move(self, "X", "O")
        if ai_move is not None:
            logger.debug(f"AI chooses position {ai_move}")
            self.make_move(ai_move, "O")
        else:
            logger.debug("AI cannot find a valid move. Declaring a draw.")

    def __str__(self):
        """
        Returns a string representation of the game.

        Format:
            "Game between <Player X> and <Player O>"

        Handles cases where usernames may not be set by falling back to email addresses.
        """
        return f"Game between {self.player_x.username or self.player_x.email} and {self.player_o.username or self.player_o.email}"
