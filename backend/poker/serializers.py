from rest_framework import serializers
from django.utils import timezone

from .models import MIN_RAISE, PokerGame, PokerTournament, PokerTournamentRegistration, evaluate_hand


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
            "table_seats",
            "starting_chips",
            "small_blind",
            "big_blind",
            "turn_timer_seconds",
            "max_players",
            "player_one_chips",
            "player_two_chips",
            "pot",
            "current_bet",
            "player_one_bet",
            "player_two_bet",
            "current_turn",
            "current_turn_started_at",
            "dealer",
            "hand_number",
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
    deadline = game.current_turn_deadline_at()
    data["turn_deadline_at"] = deadline.isoformat() if deadline else None
    data["server_now"] = timezone.now().isoformat()
    my_seat = game.piece_for_user(user)
    if game.table_seats:
        reveal = game.is_completed
        safe_seats = []
        for seat in game.table_seats:
            is_me = str(seat.get("user_id")) == str(getattr(user, "id", None))
            safe = dict(seat)
            if not reveal and not is_me:
                safe["cards"] = ["??", "??"] if safe.get("cards") else []
            safe_seats.append(safe)
        data["table_seats"] = safe_seats
        data["players"] = safe_seats
        data["my_seat"] = my_seat
        data["legal_actions"] = game.legal_actions_for(user)
        data["call_amount"] = 0
        data["min_raise_to"] = None
        data["max_raise_to"] = None
        data["min_raise"] = MIN_RAISE
        data["can_update_settings"] = int(getattr(user, "id", 0)) == int(game.player_one_id) and not game.table_seats
        current = next((s for s in game.table_seats if int(s.get("seat")) == int(my_seat or 0)), None)
        if current:
            my_bet = int(current.get("bet", 0))
            my_chips = int(current.get("chips", 0))
            data["call_amount"] = max(0, game.current_bet - my_bet)
            data["min_raise_to"] = game.current_bet + MIN_RAISE if my_chips >= data["call_amount"] + MIN_RAISE else None
            data["max_raise_to"] = my_bet + my_chips
        return data

    reveal = game.is_completed
    if my_seat != 1 and not reveal:
        data["player_one_cards"] = ["??", "??"] if game.player_one_cards else []
    if my_seat != 2 and not reveal:
        data["player_two_cards"] = ["??", "??"] if game.player_two_cards else []
    data["my_seat"] = my_seat
    data["legal_actions"] = game.legal_actions_for(user)
    data["call_amount"] = 0
    data["min_raise_to"] = None
    data["max_raise_to"] = None
    data["min_raise"] = MIN_RAISE
    data["can_update_settings"] = int(getattr(user, "id", 0)) == int(game.player_one_id) and not game.player_one_cards
    data["player_one_best"] = None
    data["player_two_best"] = None
    if my_seat in (1, 2):
        my_bet = game.player_one_bet if my_seat == 1 else game.player_two_bet
        my_chips = game.player_one_chips if my_seat == 1 else game.player_two_chips
        data["call_amount"] = max(0, game.current_bet - my_bet)
        data["min_raise_to"] = game.current_bet + MIN_RAISE if my_chips >= data["call_amount"] + MIN_RAISE else None
        data["max_raise_to"] = my_bet + my_chips
    if game.is_completed and len(game.community_cards) >= 5:
        data["player_one_best"] = evaluate_hand(game.player_one_cards + game.community_cards)["label"]
        data["player_two_best"] = evaluate_hand(game.player_two_cards + game.community_cards)["label"]
    return data


class PokerTournamentRegistrationSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    name = serializers.SerializerMethodField()
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = PokerTournamentRegistration
        fields = ["id", "user_id", "name", "status", "is_me", "created_at", "updated_at"]

    def get_name(self, obj):
        return obj.user.first_name or obj.user.email

    def get_is_me(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and obj.user_id == request.user.id)


class PokerTournamentSerializer(serializers.ModelSerializer):
    creator_id = serializers.IntegerField(source="creator.id", read_only=True)
    creator_name = serializers.SerializerMethodField()
    registered_count = serializers.SerializerMethodField()
    available_seats = serializers.SerializerMethodField()
    is_creator = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    my_registration_status = serializers.SerializerMethodField()
    game_id = serializers.IntegerField(source="game.id", read_only=True)
    registrations = serializers.SerializerMethodField()

    class Meta:
        model = PokerTournament
        fields = [
            "id",
            "creator_id",
            "creator_name",
            "title",
            "scheduled_start",
            "max_players",
            "starting_chips",
            "small_blind",
            "big_blind",
            "turn_timer_seconds",
            "status",
            "registered_count",
            "available_seats",
            "is_creator",
            "is_registered",
            "my_registration_status",
            "game_id",
            "registrations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "creator_id",
            "creator_name",
            "status",
            "registered_count",
            "available_seats",
            "is_creator",
            "is_registered",
            "my_registration_status",
            "game_id",
            "registrations",
            "created_at",
            "updated_at",
        ]

    def get_creator_name(self, obj):
        return obj.creator.first_name or obj.creator.email

    def get_registered_count(self, obj):
        return obj.registered_count()

    def get_available_seats(self, obj):
        return max(0, obj.max_players - obj.registered_count())

    def get_is_creator(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and obj.creator_id == request.user.id)

    def _my_registration(self, obj):
        request = self.context.get("request")
        if not request or not request.user:
            return None
        return next(
            (registration for registration in obj.registrations.all() if registration.user_id == request.user.id),
            None,
        )

    def get_is_registered(self, obj):
        registration = self._my_registration(obj)
        return bool(registration and registration.status == PokerTournamentRegistration.STATUS_REGISTERED)

    def get_my_registration_status(self, obj):
        registration = self._my_registration(obj)
        return registration.status if registration else None

    def get_registrations(self, obj):
        request = self.context.get("request")
        if not request:
            return []
        registrations = obj.registrations.select_related("user").order_by("created_at", "id")
        if obj.creator_id != request.user.id:
            registrations = registrations.filter(status=PokerTournamentRegistration.STATUS_REGISTERED)
        return PokerTournamentRegistrationSerializer(
            registrations,
            many=True,
            context=self.context,
        ).data

    def validate_title(self, value):
        value = str(value or "").strip()
        if len(value) < 3:
            raise serializers.ValidationError("Tournament title must be at least 3 characters.")
        return value

    def validate_max_players(self, value):
        if int(value) < 2 or int(value) > 9:
            raise serializers.ValidationError("Max players must be between 2 and 9.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        tournament = PokerTournament(creator=request.user, **validated_data)
        tournament.full_clean()
        tournament.save()
        PokerTournamentRegistration.objects.create(tournament=tournament, user=request.user)
        tournament.sync_registration_status()
        return tournament
