from rest_framework import serializers
from .models import TicTacToeGame

class TicTacToeGameSerializer(serializers.ModelSerializer):
    player_x = serializers.StringRelatedField()  # This will display the username or string representation of player_x
    player_o = serializers.StringRelatedField()  # This will display the username or string representation of player_o
    player_role = serializers.SerializerMethodField()  # Add this field

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
            "is_completed",
            "created_at",
            "updated_at",
            "player_role",  # Include the new field
        ]
        read_only_fields = [
            "id",
            "player_x",
            "player_o",
            "is_ai_game",
            "winner",
            "is_completed",
            "created_at",
            "updated_at",
            "player_role",  # Mark as read-only
        ]

    def get_player_role(self, obj):
        """
        Determine the player's role (X, O, or Spectator) for the requesting user.
        """
        request = self.context.get("request")  # Access the request object from the context
        if not request or not request.user.is_authenticated:
            return None

        if obj.player_x == request.user:
            return "X"
        elif obj.player_o == request.user:
            return "O"
        return "Spectator"
