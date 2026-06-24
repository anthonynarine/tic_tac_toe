import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError

from .models import ConnectFourGame
from .serializers import ConnectFourGameSerializer

logger = logging.getLogger(__name__)


def _serialize(game, request_user):
    data = ConnectFourGameSerializer(game).data
    if request_user == game.player_one:
        data["my_piece"] = 1
    elif game.player_two and request_user == game.player_two:
        data["my_piece"] = 2
    else:
        data["my_piece"] = None
    return data


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_game(request):
    is_ai = bool(request.data.get("is_ai_game", False))
    game = ConnectFourGame.objects.create(
        player_one=request.user,
        is_ai_game=is_ai,
    )
    return Response(_serialize(game, request.user), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def game_detail(request, game_id):
    try:
        game = ConnectFourGame.objects.get(pk=game_id)
    except ConnectFourGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)
    return Response(_serialize(game, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def join_game(request, game_id):
    try:
        game = ConnectFourGame.objects.get(pk=game_id)
    except ConnectFourGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)

    if game.is_ai_game:
        return Response({"error": "Cannot join an AI game."}, status=400)
    if game.player_two:
        if game.player_two == request.user:
            return Response(_serialize(game, request.user))
        return Response({"error": "Game already has two players."}, status=400)
    if game.player_one == request.user:
        return Response({"error": "You created this game. Share the link with a friend."}, status=400)

    game.player_two = request.user
    game.save()
    return Response(_serialize(game, request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def make_move(request, game_id):
    try:
        game = ConnectFourGame.objects.select_for_update().get(pk=game_id)
    except ConnectFourGame.DoesNotExist:
        return Response({"error": "Game not found."}, status=404)

    col = request.data.get("col")
    if col is None:
        return Response({"error": "col is required."}, status=400)

    try:
        col = int(col)
        game.drop_piece(col, request.user)
    except (ValidationError, ValueError) as e:
        return Response({"error": str(e)}, status=400)

    return Response(_serialize(game, request.user))
