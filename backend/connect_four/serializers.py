from rest_framework import serializers
from .models import ConnectFourGame


class ConnectFourGameSerializer(serializers.ModelSerializer):
    player_one_name = serializers.SerializerMethodField()
    player_two_name = serializers.SerializerMethodField()

    class Meta:
        model = ConnectFourGame
        fields = [
            "id",
            "player_one_name",
            "player_two_name",
            "is_ai_game",
            "board",
            "current_turn",
            "winner",
            "is_completed",
            "created_at",
            "updated_at",
        ]

    def get_player_one_name(self, obj):
        if obj.player_one:
            return obj.player_one.first_name or obj.player_one.email
        return None

    def get_player_two_name(self, obj):
        if obj.is_ai_game:
            return "AI"
        if obj.player_two:
            return obj.player_two.first_name or obj.player_two.email
        return None
