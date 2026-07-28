import random

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


EMPTY = "0"
P1_MAN = "1"
P2_MAN = "2"
P1_KING = "3"
P2_KING = "4"


def initial_board():
    cells = [EMPTY] * 64
    for row in range(8):
        for col in range(8):
            if (row + col) % 2 == 0:
                continue
            idx = row * 8 + col
            if row <= 2:
                cells[idx] = P2_MAN
            elif row >= 5:
                cells[idx] = P1_MAN
    return "".join(cells)


def _rc(index):
    return divmod(index, 8)


def _idx(row, col):
    return row * 8 + col


def _inside(row, col):
    return 0 <= row < 8 and 0 <= col < 8


def _owner(piece):
    if piece in (P1_MAN, P1_KING):
        return 1
    if piece in (P2_MAN, P2_KING):
        return 2
    return None


def _is_king(piece):
    return piece in (P1_KING, P2_KING)


def _directions(piece):
    if _is_king(piece):
        return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    if piece == P1_MAN:
        return [(-1, -1), (-1, 1)]
    if piece == P2_MAN:
        return [(1, -1), (1, 1)]
    return []


def legal_moves_for(board, player, forced_piece_index=None):
    captures = []
    quiet = []
    for index, piece in enumerate(board):
        if _owner(piece) != player:
            continue
        if forced_piece_index is not None and index != forced_piece_index:
            continue

        row, col = _rc(index)
        for dr, dc in _directions(piece):
            mid_row, mid_col = row + dr, col + dc
            to_row, to_col = row + (dr * 2), col + (dc * 2)
            if _inside(mid_row, mid_col) and _inside(to_row, to_col):
                mid = _idx(mid_row, mid_col)
                to = _idx(to_row, to_col)
                if _owner(board[mid]) in (1, 2) and _owner(board[mid]) != player and board[to] == EMPTY:
                    captures.append({"from": index, "to": to, "capture": mid})

            step_row, step_col = row + dr, col + dc
            if forced_piece_index is None and _inside(step_row, step_col):
                to = _idx(step_row, step_col)
                if board[to] == EMPTY:
                    quiet.append({"from": index, "to": to, "capture": None})

    return captures if captures else quiet


def _promote(piece, to_index):
    row, _ = _rc(to_index)
    if piece == P1_MAN and row == 0:
        return P1_KING
    if piece == P2_MAN and row == 7:
        return P2_KING
    return piece


def _winner(board, current_turn, forced_piece_index=None):
    p1_has = any(piece in (P1_MAN, P1_KING) for piece in board)
    p2_has = any(piece in (P2_MAN, P2_KING) for piece in board)
    if not p1_has:
        return 2
    if not p2_has:
        return 1
    if not legal_moves_for(board, current_turn, forced_piece_index):
        return 2 if current_turn == 1 else 1
    return None


class CheckersGame(models.Model):
    player_one = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="checkers_games_as_one",
    )
    player_two = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="checkers_games_as_two",
        null=True,
        blank=True,
    )
    is_ai_game = models.BooleanField(default=False)
    board = models.CharField(max_length=64, default=initial_board)
    current_turn = models.IntegerField(default=1)
    forced_piece_index = models.IntegerField(null=True, blank=True)
    winner = models.IntegerField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def piece_for_user(self, user):
        if user == self.player_one:
            return 1
        if self.player_two and user == self.player_two:
            return 2
        return None

    def apply_move(self, from_index, to_index, user):
        if self.is_completed:
            raise ValidationError("Game is already over.")

        player = self.piece_for_user(user)
        if player is None:
            raise ValidationError("You are not a participant in this game.")
        if player != self.current_turn:
            raise ValidationError("It is not your turn.")

        try:
            from_index = int(from_index)
            to_index = int(to_index)
        except (TypeError, ValueError):
            raise ValidationError("Invalid move.")

        moves = legal_moves_for(self.board, player, self.forced_piece_index)
        selected = next((m for m in moves if m["from"] == from_index and m["to"] == to_index), None)
        if not selected:
            raise ValidationError("Illegal move.")

        cells = list(self.board)
        piece = cells[from_index]
        cells[from_index] = EMPTY
        if selected["capture"] is not None:
            cells[selected["capture"]] = EMPTY
        cells[to_index] = _promote(piece, to_index)
        self.board = "".join(cells)

        if selected["capture"] is not None:
            more_captures = [
                move for move in legal_moves_for(self.board, player, to_index)
                if move["capture"] is not None
            ]
            if more_captures:
                self.forced_piece_index = to_index
            else:
                self.forced_piece_index = None
                self.current_turn = 2 if self.current_turn == 1 else 1
        else:
            self.forced_piece_index = None
            self.current_turn = 2 if self.current_turn == 1 else 1

        winner = _winner(self.board, self.current_turn, self.forced_piece_index)
        if winner:
            self.winner = winner
            self.is_completed = True
            self.forced_piece_index = None

        self.save()

    def apply_ai_move(self):
        if self.is_completed or not self.is_ai_game or self.current_turn != 2:
            return
        moves = legal_moves_for(self.board, 2, self.forced_piece_index)
        if not moves:
            self.winner = 1
            self.is_completed = True
            self.save()
            return
        move = random.choice(moves)
        self.apply_move(move["from"], move["to"], self.player_two)

    def __str__(self):
        p1 = getattr(self.player_one, "first_name", "?") if self.player_one else "?"
        p2 = getattr(self.player_two, "first_name", "AI") if self.player_two else "Waiting"
        return f"Checkers: {p1} vs {p2}"
