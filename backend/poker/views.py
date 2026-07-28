from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from utils.redis.redis_game_lobby_manager import RedisGameLobbyManager
from utils.websockets.ws_groups import scoped_lobby_id

from .models import PokerGame
from .serializers import poker_payload

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
        game = PokerGame.objects.get(pk=game_id)
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
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
            game.apply_action(request.data.get("action"), request.user)
            _resolve_ai_turn(game)
    except PokerGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    except ValidationError as exc:
        return Response({"error": str(exc)}, status=400)
    return Response(poker_payload(game, request.user))
