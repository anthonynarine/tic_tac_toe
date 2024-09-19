from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

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
        created_at (DateTimeField): Timestamp when the game was created.
        updated_at (DateTimeField): Timestamp when the game was last updated.
    """

    player_x = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        related_name="player_x_games",
        on_delete=models.CASCADE,
        help_text="The player assigned to 'X' in the game."
    )
    player_o = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="player_o_games",
        on_delete=models.CASCADE,
        help_text="The player assigned to 'O' in the game."
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
        Updates the board state when a move is made by one of the players.

        This method updates the `board_state` with the player's move at the specified position,
        and checks if there is a winner after the move. It also switches the turn to the other player.

        Args:
            position (int): The index on the board (0-8) where the player is making their move. 
                The board is represented as a 9-character string, where each character represents a cell.
            player (str): The player making the move ('X' or 'O').
        
        Raises:
            ValidationError: If the position is already occupied or if it is not the player's turn.

        Example:
            If `board_state` is 'XOX_O____' and `position` is 4, then the board will be updated to 'XOXOX____'
            if it's 'X's turn.
        """
        if self.board_state[position] == "_" and self.current_turn == player:
            board = list(self.board_state)  # Convert board_state to list for easy modification
            board[position] = player  # Update the board with the player's move
            self.board_state = "".join(board)  # Convert the list back to a string
            self.current_turn = "O" if player == "X" else "X"  # Switch turn to the other player
            self.check_winner()  # Check if the move results in a win or draw
        else:
            raise ValidationError("Invalid move. The position is either occupied or it's not the player's turn.")

    def check_winner(self):
        """
        Checks the board for a winning combination or a draw.

        The board is checked against predefined winning combinations (rows, columns, diagonals). 
        If a player has completed a winning combination, the `winner` field is updated with 'X' or 'O'.
        If all cells are filled and no one has won, the game is marked as a draw with 'D'.

        Winning combinations:
        - Rows: (0, 1, 2), (3, 4, 5), (6, 7, 8)
        - Columns: (0, 3, 6), (1, 4, 7), (2, 5, 8)
        - Diagonals: (0, 4, 8), (2, 4, 6)

        Example:
            If `board_state` is 'XXX_O_O__', the game will detect a win for 'X'.
        """
        winning_combinations = [
            (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
            (0, 3, 6), (1, 4, 7), (2, 5, 8),  # columns
            (0, 4, 8), (2, 4, 6)              # diagonals
        ]
        for combo in winning_combinations:
            if self.board_state[combo[0]] == self.board_state[combo[1]] == self.board_state[combo[2]] != '_':
                self.winner = self.board_state[combo[0]]  # Declare the winner ('X' or 'O')
                return
        if "_" not in self.board_state:
            self.winner = "D"  # If all spaces are filled and there's no winner, it's a draw

    def __str__(self):
        """
        Returns a string representation of the game instance.

        The string contains the usernames (or email if no username) of the two players in the game.

        Returns:
            str: A string representing the game.

        Example:
            "Game between player_x and player_o"
        """
        return f"Game between {self.player_x} and {self.player_o}"
