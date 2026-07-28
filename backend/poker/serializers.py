from rest_framework import serializers

from .models import PokerGame


class PokerGameSerializer(serializers.ModelSerializer):
    player_one_id = serializers.IntegerField(read_only=True)
    player_two_id = serializers.IntegerField(read_only=True)
    player_one_name = serializers.SerializerMethodField()
    player_two_name = serializers.SerializerMethodField()

    class Meta:
        model = PokerGame
        fields = [
            "id",
            "player_one_id",
            "player_two_id",
            "player_one_name",
            "player_two_name",
            "is_ai_game",
            "community_cards",
            "player_one_cards",
            "player_two_cards",
            "player_one_chips",
            "player_two_chips",
            "pot",
            "current_bet",
            "player_one_bet",
            "player_two_bet",
            "current_turn",
            "dealer",
            "phase",
            "last_action",
            "winner",
            "winning_label",
            "is_completed",
            "created_at",
            "updated_at",
        ]

    def get_player_one_name(self, obj):
        return obj.player_one.first_name or obj.player_one.email if obj.player_one else None

    def get_player_two_name(self, obj):
        if obj.is_ai_game:
            return "AI"
        return obj.player_two.first_name or obj.player_two.email if obj.player_two else None


def poker_payload(game, user):
    data = PokerGameSerializer(game).data
    my_seat = game.piece_for_user(user)
    reveal = game.is_completed
    if my_seat != 1 and not reveal:
        data["player_one_cards"] = ["??", "??"] if game.player_one_cards else []
    if my_seat != 2 and not reveal:
        data["player_two_cards"] = ["??", "??"] if game.player_two_cards else []
    data["my_seat"] = my_seat
    data["legal_actions"] = game.legal_actions_for(user)
    return data
