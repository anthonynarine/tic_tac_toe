from rest_framework import serializers
from .models import SudokuPuzzle, SudokuSession


class SudokuPuzzleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SudokuPuzzle
        fields = ["id", "difficulty", "puzzle", "solution"]


class SudokuSessionSerializer(serializers.ModelSerializer):
    puzzle = SudokuPuzzleSerializer(read_only=True)

    class Meta:
        model = SudokuSession
        fields = [
            "id",
            "puzzle",
            "current_board",
            "notes",
            "elapsed_seconds",
            "mistakes",
            "completed",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "puzzle", "created_at", "updated_at"]


class SudokuSessionSaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = SudokuSession
        fields = ["current_board", "notes", "elapsed_seconds", "mistakes", "completed", "completed_at"]
