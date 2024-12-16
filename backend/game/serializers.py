from rest_framework import serializers
from .models import TicTacToeGame

class TicTacToeGameSerializer(serializers.ModelSerializer):
    player_x = serializers.StringRelatedField()  # This will display the username or string representation of player_x
    player_o = serializers.StringRelatedField()  # This will display the username or string representation of player_o

    class Meta:
        model = TicTacToeGame
        fields = [
            "id",
            "player_x",
            "player_o",
            "is_ai_game",
            "board_state",
            "current_turn",
            "winner",
            "is_completed",  # Add this field to the serializer
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "player_x",
            "player_o",
            "is_ai_game",
            "winner",
            "is_completed",  # Mark as read-only
            "created_at",
            "updated_at",
        ]
