from django.db import models
from django.conf import settings


class SudokuPuzzle(models.Model):
    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("medium", "Medium"),
        ("hard", "Hard"),
        ("expert", "Expert"),
    ]
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default="medium")
    # 81-char string, 0=empty clue cell, 1-9=given digit
    puzzle = models.CharField(max_length=81)
    # 81-char string, full solution
    solution = models.CharField(max_length=81)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SudokuPuzzle({self.difficulty}, id={self.pk})"


class SudokuSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sudoku_sessions",
    )
    puzzle = models.ForeignKey(SudokuPuzzle, on_delete=models.CASCADE, related_name="sessions")
    # JSON array of 81 ints (0=empty, 1-9=player-entered digit)
    current_board = models.JSONField(default=list)
    # JSON: { "idx": [list of candidate ints] }
    notes = models.JSONField(default=dict)
    elapsed_seconds = models.PositiveIntegerField(default=0)
    mistakes = models.PositiveSmallIntegerField(default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"SudokuSession(user={self.user_id}, puzzle={self.puzzle_id}, completed={self.completed})"
