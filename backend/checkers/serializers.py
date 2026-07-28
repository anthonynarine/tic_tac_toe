from rest_framework import serializers

from .models import CheckersGame, legal_moves_for


class CheckersGameSerializer(serializers.ModelSerializer):
    player_one_id = serializers.IntegerField(read_only=True)
    player_two_id = serializers.IntegerField(read_only=True)
    player_one_name = serializers.SerializerMethodField()
    player_two_name = serializers.SerializerMethodField()
    legal_moves = serializers.SerializerMethodField()

    class Meta:
        model = CheckersGame
        fields = [
            "id",
            "player_one_id",
            "player_two_id",
            "player_one_name",
            "player_two_name",
            "is_ai_game",
            "board",
            "current_turn",
            "forced_piece_index",
            "winner",
            "is_completed",
            "legal_moves",
            "created_at",
            "updated_at",
        ]

    def get_player_one_name(self, obj):
        return obj.player_one.first_name or obj.player_one.email if obj.player_one else None

    def get_player_two_name(self, obj):
        if obj.is_ai_game:
            return "AI"
        return obj.player_two.first_name or obj.player_two.email if obj.player_two else None

    def get_legal_moves(self, obj):
        if obj.is_completed:
            return []
        return legal_moves_for(obj.board, obj.current_turn, obj.forced_piece_index)
