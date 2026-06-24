from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

ROWS = 6
COLS = 7
EMPTY_BOARD = "0" * (ROWS * COLS)


def _drop(board, col, piece):
    """Return new board string after dropping piece into col, or None if full."""
    cells = list(board)
    for row in range(ROWS - 1, -1, -1):
        idx = row * COLS + col
        if cells[idx] == "0":
            cells[idx] = str(piece)
            return "".join(cells)
    return None


def _check_winner(board):
    """Return 1, 2, or None."""
    b = board
    for piece in ("1", "2"):
        # horizontal
        for r in range(ROWS):
            for c in range(COLS - 3):
                if all(b[r * COLS + c + i] == piece for i in range(4)):
                    return int(piece)
        # vertical
        for c in range(COLS):
            for r in range(ROWS - 3):
                if all(b[(r + i) * COLS + c] == piece for i in range(4)):
                    return int(piece)
        # diagonal \
        for r in range(ROWS - 3):
            for c in range(COLS - 3):
                if all(b[(r + i) * COLS + c + i] == piece for i in range(4)):
                    return int(piece)
        # diagonal /
        for r in range(3, ROWS):
            for c in range(COLS - 3):
                if all(b[(r - i) * COLS + c + i] == piece for i in range(4)):
                    return int(piece)
    return None


class ConnectFourGame(models.Model):
    # player_one always plays piece=1, player_two plays piece=2
    player_one = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="c4_games_as_one",
    )
    player_two = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="c4_games_as_two",
        null=True,
        blank=True,
    )
    is_ai_game = models.BooleanField(default=False)
    board = models.CharField(max_length=42, default=EMPTY_BOARD)
    current_turn = models.IntegerField(default=1)  # 1 or 2
    # winner: 1=player_one, 2=player_two, 0=draw, null=ongoing
    winner = models.IntegerField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def drop_piece(self, col, user):
        if self.is_completed:
            raise ValidationError("Game is already over.")
        if not (0 <= col < COLS):
            raise ValidationError("Invalid column.")

        # determine piece for this user
        if user == self.player_one:
            piece = 1
        elif self.player_two and user == self.player_two:
            piece = 2
        else:
            raise ValidationError("You are not a participant in this game.")

        if piece != self.current_turn:
            raise ValidationError("It is not your turn.")

        new_board = _drop(self.board, col, piece)
        if new_board is None:
            raise ValidationError("That column is full.")

        self.board = new_board
        winner = _check_winner(self.board)
        if winner:
            self.winner = winner
            self.is_completed = True
        elif "0" not in self.board:
            self.winner = 0
            self.is_completed = True
        else:
            self.current_turn = 2 if self.current_turn == 1 else 1

        self.save()

    def __str__(self):
        p1 = getattr(self.player_one, "first_name", "?") if self.player_one else "?"
        p2 = getattr(self.player_two, "first_name", "AI") if self.player_two else "Waiting"
        return f"C4: {p1} vs {p2}"
