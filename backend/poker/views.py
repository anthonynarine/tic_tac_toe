from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from friends.models import Friendship
from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager
from utils.websockets.ws_groups import scoped_lobby_id

from .models import PokerGame, PokerTournament, PokerTournamentRegistration
from .serializers import PokerTournamentSerializer, poker_payload

User = get_user_model()


def _ai_user():
    user, _ = User.objects.get_or_create(
        email="ai@example.com",
        defaults={"first_name": "AI", "last_name": "Player"},
    )
    return user


def _resolve_ai_turn(game):
    guard = 0
    while game.is_ai_game and game.current_turn == 2 and not game.is_completed and guard < 8:
        game.apply_ai_action()
        guard += 1


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_game(request):
    is_ai = bool(request.data.get("is_ai_game", False))
    game = PokerGame.objects.create(
        player_one=request.user,
        player_two=_ai_user() if is_ai else None,
        is_ai_game=is_ai,
    )
    if is_ai:
        game.ensure_dealt()
        _resolve_ai_turn(game)

    data = poker_payload(game, request.user)
    if not is_ai:
        lobby_id = str(game.id)
        manager = RedisGameLobbyManager()
        scoped_id = scoped_lobby_id("poker", lobby_id)
        session_key = manager.ensure_session_key(scoped_id)
        manager.add_user_to_session(scoped_id, request.user.id)
        data["lobbyId"] = lobby_id
        data["sessionKey"] = session_key
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def game_detail(request, game_id):
    try:
        with transaction.atomic():
            game = PokerGame.objects.select_for_update().get(pk=game_id)
            game.enforce_turn_timeout()
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    return Response(poker_payload(game, request.user))


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def table_settings(request, game_id):
    try:
        game = PokerGame.objects.get(pk=game_id)
        game.update_table_settings(request.user, request.data)
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    except (TypeError, ValueError):
        return Response({"error": "Invalid poker settings."}, status=400)
    except ValidationError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response(poker_payload(game, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def join_game(request, game_id):
    try:
        game = PokerGame.objects.get(pk=game_id)
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    if game.is_ai_game:
        return Response({"error": "Cannot join an AI game."}, status=400)
    if game.player_two:
        if game.player_two == request.user:
            return Response(poker_payload(game, request.user))
        return Response({"error": "Game already has two players."}, status=400)
    if game.player_one == request.user:
        return Response({"error": "You created this game. Share the link with a friend."}, status=400)

    game.player_two = request.user
    game.ensure_dealt()
    game.save()
    return Response(poker_payload(game, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def action(request, game_id):
    try:
        with transaction.atomic():
            game = PokerGame.objects.select_for_update().get(pk=game_id)
            game.enforce_turn_timeout()
            game.apply_action(request.data.get("action"), request.user, request.data.get("amount"))
            _resolve_ai_turn(game)
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    except ValidationError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response(poker_payload(game, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def next_hand(request, game_id):
    try:
        with transaction.atomic():
            game = PokerGame.objects.select_for_update().get(pk=game_id)
            game.start_next_hand(request.user)
            _resolve_ai_turn(game)
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    except ValidationError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response(poker_payload(game, request.user))


def _friend_ids_for(user):
    friendships = Friendship.objects.filter(is_accepted=True).filter(
        Q(from_user=user) | Q(to_user=user)
    ).select_related("from_user", "to_user")
    return {
        friendship.get_other_user(user).id
        for friendship in friendships
        if friendship.get_other_user(user)
    }


def _visible_tournament_queryset(user):
    visible_creator_ids = _friend_ids_for(user) | {user.id}
    return (
        PokerTournament.objects
        .filter(Q(creator_id__in=visible_creator_ids) | Q(registrations__user=user))
        .select_related("creator", "game")
        .prefetch_related("registrations__user")
        .distinct()
    )


def _serialize_tournament(tournament, request, response_status=status.HTTP_200_OK):
    tournament = (
        PokerTournament.objects
        .select_related("creator", "game")
        .prefetch_related("registrations__user")
        .get(pk=tournament.pk)
    )
    return Response(
        PokerTournamentSerializer(tournament, context={"request": request}).data,
        status=response_status,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def tournaments(request):
    if request.method == "GET":
        qs = _visible_tournament_queryset(request.user)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = PokerTournamentSerializer(qs, many=True, context={"request": request})
        return Response({"results": serializer.data})

    serializer = PokerTournamentSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    try:
        tournament = serializer.save()
    except ValidationError as exc:
        return Response({"error": str(exc)}, status=400)
    return _serialize_tournament(tournament, request, status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tournament_detail(request, tournament_id):
    try:
        tournament = _visible_tournament_queryset(request.user).get(pk=tournament_id)
    except PokerTournament.DoesNotExist:
        return Response({"error": "Tournament not found."}, status=404)
    return Response(PokerTournamentSerializer(tournament, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tournament_register(request, tournament_id):
    try:
        with transaction.atomic():
            tournament = PokerTournament.objects.select_for_update().get(pk=tournament_id)
            if tournament.creator_id != request.user.id and tournament.creator_id not in _friend_ids_for(request.user):
                return Response({"error": "Tournament not found."}, status=404)
            if tournament.status != PokerTournament.STATUS_OPEN:
                return Response({"error": "Registration is closed."}, status=400)
            if tournament.registered_count() >= tournament.max_players:
                tournament.sync_registration_status()
                return Response({"error": "Tournament is full."}, status=400)
            registration, _ = PokerTournamentRegistration.objects.get_or_create(
                tournament=tournament,
                user=request.user,
                defaults={"status": PokerTournamentRegistration.STATUS_REGISTERED},
            )
            if registration.status != PokerTournamentRegistration.STATUS_REGISTERED:
                registration.status = PokerTournamentRegistration.STATUS_REGISTERED
                registration.save(update_fields=["status", "updated_at"])
            tournament.sync_registration_status()
    except PokerTournament.DoesNotExist:
        return Response({"error": "Tournament not found."}, status=404)
    return _serialize_tournament(tournament, request)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tournament_withdraw(request, tournament_id):
    try:
        with transaction.atomic():
            tournament = PokerTournament.objects.select_for_update().get(pk=tournament_id)
            if tournament.status in {PokerTournament.STATUS_IN_PROGRESS, PokerTournament.STATUS_COMPLETED}:
                return Response({"error": "Tournament has already started."}, status=400)
            if tournament.creator_id == request.user.id:
                return Response({"error": "Tournament creator cannot withdraw."}, status=400)
            registration = PokerTournamentRegistration.objects.get(tournament=tournament, user=request.user)
            registration.status = PokerTournamentRegistration.STATUS_WITHDRAWN
            registration.save(update_fields=["status", "updated_at"])
            tournament.sync_registration_status()
    except PokerTournament.DoesNotExist:
        return Response({"error": "Tournament not found."}, status=404)
    except PokerTournamentRegistration.DoesNotExist:
        return Response({"error": "You are not registered for this tournament."}, status=400)
    return _serialize_tournament(tournament, request)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tournament_remove_registration(request, tournament_id, registration_id):
    try:
        with transaction.atomic():
            tournament = PokerTournament.objects.select_for_update().get(pk=tournament_id)
            if tournament.creator_id != request.user.id:
                return Response({"error": "Only the tournament creator can manage the roster."}, status=403)
            if tournament.status in {PokerTournament.STATUS_IN_PROGRESS, PokerTournament.STATUS_COMPLETED}:
                return Response({"error": "Tournament has already started."}, status=400)
            registration = PokerTournamentRegistration.objects.get(pk=registration_id, tournament=tournament)
            if registration.user_id == tournament.creator_id:
                return Response({"error": "The creator cannot be removed from their tournament."}, status=400)
            registration.status = PokerTournamentRegistration.STATUS_REMOVED
            registration.save(update_fields=["status", "updated_at"])
            tournament.sync_registration_status()
    except PokerTournament.DoesNotExist:
        return Response({"error": "Tournament not found."}, status=404)
    except PokerTournamentRegistration.DoesNotExist:
        return Response({"error": "Registration not found."}, status=404)
    return _serialize_tournament(tournament, request)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tournament_start(request, tournament_id):
    try:
        with transaction.atomic():
            tournament = PokerTournament.objects.select_for_update().get(pk=tournament_id)
            if tournament.creator_id != request.user.id:
                return Response({"error": "Only the tournament creator can start it."}, status=403)
            game = tournament.start()
    except PokerTournament.DoesNotExist:
        return Response({"error": "Tournament not found."}, status=404)
    except ValidationError as exc:
        return Response({"error": str(exc)}, status=400)

    return Response(
        {
            "tournament": PokerTournamentSerializer(tournament, context={"request": request}).data,
            "gameId": game.id,
            "gameUrl": f"/games/poker/{game.id}",
        }
    )
